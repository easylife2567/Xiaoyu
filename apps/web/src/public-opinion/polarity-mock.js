// 「正负面舆情」mock — 沿用 mock-payload.js 同款 seeded LCG,
// 模块加载即冻结,与生产 DTO 形状一致 (含 sentiment5 与 sentiment3 双字段)。
//
// 触发开关与 /api/public-opinion/overview 一致:
//   dev: `?mock=1`;prod: `PUBLIC_OPINION_MOCK=1`。

import { foldSentiment5to3 } from './polarity.js'

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const EMOTION_LABELS = ['正面', '偏正面', '中立', '偏负面', '负面']
const MEDIAS = ['谷歌全网', 'Twitter', '微博', 'Telegram', 'Facebook', 'Reddit']

const SAMPLE_TITLES = [
  '新一代政策出台获多方解读,经济专家普遍看好后市',
  '某品牌质量舆情发酵,客服回应引争议',
  '体育赛事破收视纪录,品牌赞助讨论度激增',
  '教育减负落地满月,家长群体观点分化',
  '科技公司发布突破性专利,业界关注度爆棚',
  '环保倡议在社交平台扩散,网友自发参与',
  '城市交通新规首日,通勤效率讨论热烈',
  '楼市调控显效,二手房成交结构变化',
  '医疗改革推进,基层服务能力评价分化',
  '乡村振兴成果展,数字农业获积极反馈',
  '文旅市场升温,特色小镇游客点评呈现两极',
  '数字经济新业态密集涌现,监管空白受关注',
  '社区养老服务受好评,人力短缺仍是隐忧',
  '食品安全抽检结果公布,部分品牌引讨论',
  '网络安全法新规执行,平台合规成本议题热',
  'AI 大模型发布会引爆话题,中外评测对比走红',
  '海外热议某科技峰会,中国厂商表现获关注',
  '气候议题在国际社交平台扩散,各国民间反应不一',
  '电商大促数据出炉,海外渠道增量显著',
  '加密资产监管动向,推特/Twitter 讨论极化',
  '某网红事件持续发酵,平台审核机制再受讨论',
  '本地小型品牌出海受关注,跨境营销话题升温',
  '体育明星言论引连锁反应,国际媒体跟进报道',
  '某行业白皮书发布,Reddit 与微博讨论方向分化',
]

const SAMPLE_KEYWORDS = ['政策', '召回', '质量', '投诉', '维权', '事故', '抗议', '审查']

const RISK_INDEXES = new Set([3, 9, 17, 25, 31, 44])

function pad(n) {
  return String(n).padStart(2, '0')
}

function buildBasePool() {
  const rand = seededRandom(42)
  return Array.from({ length: 50 }, (_, i) => {
    void rand()
    const sentiment5 = EMOTION_LABELS[i % EMOTION_LABELS.length]
    const platform = MEDIAS[i % MEDIAS.length]
    const title = SAMPLE_TITLES[i % SAMPLE_TITLES.length]
    const hasKeyword = i % 3 === 0
    const minute = pad((i * 7 + 3) % 60)
    const hour = pad((6 + (i % 16)) % 24)
    const dayOffset = Math.floor(i / 12)
    return {
      platform,
      title,
      keyword: hasKeyword ? SAMPLE_KEYWORDS[i % SAMPLE_KEYWORDS.length] : '',
      risk: RISK_INDEXES.has(i),
      sentiment5,
      sentiment3: foldSentiment5to3(sentiment5),
      pubTime: `2026-06-${pad(22 - dayOffset)} ${hour}:${minute}`,
      url: `https://example.com/po/${i + 1}`,
    }
  })
}

const BASE_POOL = buildBasePool()

function filterPool({ sentiment3, platform }) {
  let pool = BASE_POOL
  if (sentiment3 && sentiment3 !== '全部') {
    pool = pool.filter((item) => item.sentiment3 === sentiment3)
  }
  if (platform && platform !== '全部') {
    pool = pool.filter((item) => item.platform === platform)
  }
  return pool
}

function deriveSummary(pool) {
  const sentiment5 = EMOTION_LABELS.reduce((acc, label) => {
    acc[label] = 0
    return acc
  }, {})
  let positive = 0
  let neutral = 0
  let negative = 0
  for (const item of pool) {
    sentiment5[item.sentiment5] += 1
    if (item.sentiment3 === '正面') positive += 1
    else if (item.sentiment3 === '负面') negative += 1
    else neutral += 1
  }
  return {
    positive,
    neutral,
    negative,
    total: positive + neutral + negative,
    sentiment5,
  }
}

function derivePlatforms() {
  const counter = new Map()
  for (const item of BASE_POOL) {
    counter.set(item.platform, (counter.get(item.platform) ?? 0) + 1)
  }
  return Array.from(counter, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count,
  )
}

/**
 * 构造 polarity 路由的 mock payload。
 * 形状与 `aggregatePolarity` 完全一致;过滤 + 分页在 mock 内做。
 */
export function buildPolarityMock({
  sentiment3 = '全部',
  platform = '全部',
  page = 1,
  pageSize = 10,
  range,
} = {}) {
  const pool = filterPool({ sentiment3, platform })
  const summary = deriveSummary(pool)
  const platforms = derivePlatforms()
  const p = Math.max(1, Number(page) || 1)
  const size = Math.max(1, Math.min(1000, Number(pageSize) || 10))
  const start = (p - 1) * size
  const slice = pool.slice(start, start + size)
  return {
    configured: true,
    mock: true,
    range: range ?? { start: '2026-06-18', end: '2026-06-24' },
    summary,
    platforms,
    items: slice,
    pagination: { page: p, pageSize: size, total: pool.length },
    errors: {},
  }
}

/**
 * 导出路由的 mock — 不分页,返回过滤后的完整集合。
 */
export function buildPolarityExportMock({
  sentiment3 = '全部',
  platform = '全部',
  ids,
  range,
} = {}) {
  let pool = filterPool({ sentiment3, platform })
  if (Array.isArray(ids) && ids.length) {
    const idSet = new Set(ids.map(String))
    pool = pool.filter((_, i) => idSet.has(String(i)))
  }
  return {
    configured: true,
    mock: true,
    range: range ?? { start: '2026-06-18', end: '2026-06-24' },
    items: pool,
  }
}

export const POLARITY_MOCK_TOTAL = BASE_POOL.length
