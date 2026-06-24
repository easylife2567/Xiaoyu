// 「正负面舆情」归一化层 — 把 ASMX 信息流 / 模态计数映射到稳定 DTO,
// 并把 5 档情感 (正面/偏正面/中立/偏负面/负面) 折叠到 3 档 (正面/中立/负面)。
//
// 折叠规则在此处独占实现 — 前端组件、mock、测试都只消费输出,绝不重写。
//
// DTO 形状:
//   {
//     configured: true,
//     range: { start, end },
//     summary: { positive, neutral, negative, total, sentiment5: {...} },
//     platforms: [{ key, count }],
//     items:    [{ platform, title, keyword, risk, sentiment5, sentiment3, pubTime, url }],
//     pagination: { page, pageSize, total },
//     errors: {}
//   }

import { EMOTION_LABELS } from './overview.js'

export const SENTIMENT3_LABELS = ['正面', '中立', '负面']

const EMOTION_VALUE_MAP = {
  '0': '中立',
  '1': '正面',
  '2': '负面',
  '3': '偏正面',
  '4': '偏负面',
  正面: '正面',
  偏正面: '偏正面',
  中立: '中立',
  偏负面: '偏负面',
  负面: '负面',
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * 把 5 档情感折叠到 3 档。
 *  正面 ∪ 偏正面 → 正面
 *  中立          → 中立
 *  负面 ∪ 偏负面 → 负面
 * 未知 / null / undefined / 异常字符串 兜底为「中立」。
 */
export function foldSentiment5to3(label5) {
  if (label5 === '正面' || label5 === '偏正面') return '正面'
  if (label5 === '负面' || label5 === '偏负面') return '负面'
  return '中立'
}

/**
 * 把 legacy `emotionValue` (0..4 或中文) 归一为 5 档中文标签。
 * 与 `overview.js` 内 `toSentiment` 同源,迁出来便于复用与测试。
 */
export function normalizeSentiment5(value) {
  if (value == null) return '中立'
  const key = String(value)
  return EMOTION_VALUE_MAP[key] ?? '中立'
}

/**
 * 构造调用 ASMX 用的时间窗口。
 *  - start / end 显式传入则尊重之 (YYYY-MM-DD 字符串)
 *  - 都为空 → 默认 7 天窗口 (含今天)
 *  - 只给 end → start 推 6 天前;只给 start → end 取今天
 */
export function buildPolarityContext({ start, end, now = new Date() } = {}) {
  const today = toDateString(now)
  let endDay = end || today
  let startDay = start
  if (!startDay) {
    const endDate = new Date(endDay)
    const startDate = new Date(endDate.getTime() - 6 * 86_400_000)
    startDay = toDateString(startDate)
  }
  return {
    startDay,
    endDay,
    startTime: startDay,
    endTime: endDay,
  }
}

/**
 * `getModMediaNumberByTime` 返回 [media, n_正面, n_偏正面, n_中立, n_偏负面, n_负面] 二维数组。
 * 把它聚合为 3 档 summary,并保留 5 档明细供占比横条 hover 用。
 */
export async function getPolaritySummary(client, ctx) {
  const rows = await client.call('getModMediaNumberByTime', {
    startTime: ctx.startTime,
    endTime: ctx.endTime,
  })
  const totals5 = [0, 0, 0, 0, 0]
  for (const row of rows ?? []) {
    for (let i = 0; i < 5; i += 1) {
      totals5[i] += num(row[i + 1])
    }
  }
  const sentiment5 = EMOTION_LABELS.reduce((acc, label, i) => {
    acc[label] = totals5[i]
    return acc
  }, {})
  const positive = sentiment5['正面'] + sentiment5['偏正面']
  const neutral = sentiment5['中立']
  const negative = sentiment5['负面'] + sentiment5['偏负面']
  return {
    positive,
    neutral,
    negative,
    total: positive + neutral + negative,
    sentiment5,
  }
}

/**
 * `getSpanTimeMediaInfo` 返回信息流条目。
 * 每条同时输出 sentiment5 (原始 5 档) 与 sentiment3 (折叠 3 档),
 * 行首 4px 色条用前者、chip 过滤用后者。
 */
export async function getPolarityItems(client, ctx, { page, pageSize }) {
  const list = await client.call('getSpanTimeMediaInfo', {
    startDay: ctx.startDay,
    endDay: ctx.endDay,
    page,
    number: pageSize,
  })
  return (list ?? []).map((item) => {
    const sentiment5 = normalizeSentiment5(item.emotionValue)
    return {
      platform: item.platform ?? '',
      title: item.title ?? '',
      keyword: item.keyWord ?? '',
      risk: Boolean(item.risk),
      sentiment5,
      sentiment3: foldSentiment5to3(sentiment5),
      pubTime: item.pubTime ?? '',
      url: item.Url ?? '',
    }
  })
}

/**
 * 在 items 集合内统计平台 chip 的数量徽章。
 * 当 summary 未提供 platform breakdown 时,以 items 频次作退化估计。
 */
export function getPolarityPlatforms(items) {
  const counter = new Map()
  for (const item of items) {
    const key = item.platform || '未知'
    counter.set(key, (counter.get(key) ?? 0) + 1)
  }
  return Array.from(counter, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count,
  )
}

/**
 * 在归一化层内做 sentiment3 / platform 过滤 — 集中规则,前端不重写。
 * 过滤后才计算 pagination.total,保证「N 条」与列表一致。
 */
export function filterItems(items, { sentiment3, platform }) {
  let next = items
  if (sentiment3 && sentiment3 !== '全部') {
    next = next.filter((item) => item.sentiment3 === sentiment3)
  }
  if (platform && platform !== '全部') {
    next = next.filter((item) => item.platform === platform)
  }
  return next
}

export function paginate(items, { page, pageSize }) {
  const p = Math.max(1, Number(page) || 1)
  const size = Math.max(1, Math.min(1000, Number(pageSize) || 10))
  const start = (p - 1) * size
  return {
    page: p,
    pageSize: size,
    total: items.length,
    slice: items.slice(start, start + size),
  }
}

/**
 * 聚合「正负面舆情」全部 widget。
 *
 * 与 overview.js 同一范式:单 widget 失败置 null + 记 errors,其余照常返回。
 *
 * `pageSize` 上限 1000;导出路由通过传入大 pageSize (例如 10000) 拉满。
 */
export async function aggregatePolarity(
  client,
  {
    sentiment3 = '全部',
    platform = '全部',
    page = 1,
    pageSize = 10,
    range = {},
  } = {},
) {
  const ctx = buildPolarityContext(range)
  // 列表先按"大页"拉,过滤后再前端分页,保证 platforms 与 summary 计数一致。
  // 上限 1000 避免压垮 ASMX。
  const fetchSize = Math.min(1000, Math.max(pageSize, 200))
  const settled = await Promise.allSettled([
    getPolaritySummary(client, ctx),
    getPolarityItems(client, ctx, { page: 1, pageSize: fetchSize }),
  ])
  const errors = {}
  const summary = settled[0].status === 'fulfilled' ? settled[0].value : null
  if (settled[0].status === 'rejected') {
    errors.summary = String(settled[0].reason?.message ?? settled[0].reason)
  }
  const rawItems = settled[1].status === 'fulfilled' ? settled[1].value : []
  if (settled[1].status === 'rejected') {
    errors.items = String(settled[1].reason?.message ?? settled[1].reason)
  }
  const filtered = filterItems(rawItems, { sentiment3, platform })
  const platforms = getPolarityPlatforms(rawItems)
  const pagination = paginate(filtered, { page, pageSize })
  return {
    configured: true,
    range: { start: ctx.startDay, end: ctx.endDay },
    summary,
    platforms,
    items: pagination.slice,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
    },
    errors,
  }
}
