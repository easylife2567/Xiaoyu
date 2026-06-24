import assert from 'node:assert/strict'
import test from 'node:test'
import {
  SENTIMENT3_LABELS,
  foldSentiment5to3,
  normalizeSentiment5,
  buildPolarityContext,
  getPolaritySummary,
  getPolarityItems,
  getPolarityPlatforms,
  filterItems,
  paginate,
  aggregatePolarity,
} from '../src/public-opinion/polarity.js'

const SAMPLES = {
  getModMediaNumberByTime: [
    ['谷歌全网', '2', '3', '10', '1', '4'],
    ['Twitter', '1', '0', '6', '2', '5'],
  ],
  getSpanTimeMediaInfo: [
    {
      platform: '谷歌全网',
      title: 'A',
      keyWord: '北京',
      risk: true,
      emotionValue: '1', // 正面
      pubTime: '2026-06-20 08:00',
      Url: 'https://x/1',
    },
    {
      platform: 'Twitter',
      title: 'B',
      keyWord: '',
      risk: false,
      emotionValue: '3', // 偏正面 → 折叠后 正面
      pubTime: '2026-06-20 09:00',
      Url: 'https://x/2',
    },
    {
      platform: '微博',
      title: 'C',
      keyWord: '召回',
      risk: true,
      emotionValue: '4', // 偏负面 → 折叠后 负面
      pubTime: '2026-06-20 10:00',
      Url: 'https://x/3',
    },
    {
      platform: 'Twitter',
      title: 'D',
      keyWord: '',
      risk: false,
      emotionValue: '0', // 中立
      pubTime: '2026-06-20 11:00',
      Url: 'https://x/4',
    },
    {
      platform: 'Twitter',
      title: 'E',
      keyWord: '',
      risk: false,
      emotionValue: '2', // 负面
      pubTime: '2026-06-20 12:00',
      Url: 'https://x/5',
    },
  ],
}

function fakeClient(overrides = {}) {
  return {
    async call(endpoint, params) {
      if (endpoint in overrides) {
        const v = overrides[endpoint]
        if (v instanceof Error) throw v
        return typeof v === 'function' ? v(params) : v
      }
      return SAMPLES[endpoint]
    },
  }
}

// ───────────── foldSentiment5to3 ─────────────

test('foldSentiment5to3 把 5 档映射到 3 档', () => {
  assert.equal(foldSentiment5to3('正面'), '正面')
  assert.equal(foldSentiment5to3('偏正面'), '正面')
  assert.equal(foldSentiment5to3('中立'), '中立')
  assert.equal(foldSentiment5to3('偏负面'), '负面')
  assert.equal(foldSentiment5to3('负面'), '负面')
})

test('foldSentiment5to3 兜底未知 / null 为中立', () => {
  assert.equal(foldSentiment5to3(null), '中立')
  assert.equal(foldSentiment5to3(undefined), '中立')
  assert.equal(foldSentiment5to3('unknown'), '中立')
  assert.equal(foldSentiment5to3(''), '中立')
})

test('SENTIMENT3_LABELS 是固定三档', () => {
  assert.deepEqual(SENTIMENT3_LABELS, ['正面', '中立', '负面'])
})

test('normalizeSentiment5 把 legacy 编码映射到 5 档中文', () => {
  assert.equal(normalizeSentiment5('0'), '中立')
  assert.equal(normalizeSentiment5('1'), '正面')
  assert.equal(normalizeSentiment5('2'), '负面')
  assert.equal(normalizeSentiment5('3'), '偏正面')
  assert.equal(normalizeSentiment5('4'), '偏负面')
  assert.equal(normalizeSentiment5(null), '中立')
})

// ───────────── buildPolarityContext ─────────────

test('buildPolarityContext 默认 7 天窗口', () => {
  const ctx = buildPolarityContext({ now: new Date('2026-06-24T08:00:00') })
  assert.equal(ctx.endDay, '2026-06-24')
  assert.equal(ctx.startDay, '2026-06-18')
  assert.equal(ctx.endTime, '2026-06-24')
})

test('buildPolarityContext 接受显式 start / end', () => {
  const ctx = buildPolarityContext({ start: '2026-06-01', end: '2026-06-10' })
  assert.equal(ctx.startDay, '2026-06-01')
  assert.equal(ctx.endDay, '2026-06-10')
})

// ───────────── getPolaritySummary ─────────────

test('getPolaritySummary 按列求和并折叠 3 档', async () => {
  const ctx = buildPolarityContext({ start: '2026-06-18', end: '2026-06-24' })
  const summary = await getPolaritySummary(fakeClient(), ctx)
  // 正面 = 2+1, 偏正面 = 3+0, 中立 = 10+6, 偏负面 = 1+2, 负面 = 4+5
  // → positive 3+3=6, neutral 16, negative 9+3=12
  assert.equal(summary.positive, 6)
  assert.equal(summary.neutral, 16)
  assert.equal(summary.negative, 12)
  assert.equal(summary.total, 34)
  assert.deepEqual(summary.sentiment5, {
    正面: 3,
    偏正面: 3,
    中立: 16,
    偏负面: 3,
    负面: 9,
  })
})

// ───────────── getPolarityItems ─────────────

test('getPolarityItems 同时输出 sentiment5 与 sentiment3', async () => {
  const ctx = buildPolarityContext({ start: '2026-06-18', end: '2026-06-24' })
  const items = await getPolarityItems(fakeClient(), ctx, { page: 1, pageSize: 10 })
  assert.equal(items.length, 5)
  assert.equal(items[0].sentiment5, '正面')
  assert.equal(items[0].sentiment3, '正面')
  assert.equal(items[1].sentiment5, '偏正面')
  assert.equal(items[1].sentiment3, '正面')
  assert.equal(items[2].sentiment5, '偏负面')
  assert.equal(items[2].sentiment3, '负面')
  // 字段完整
  assert.equal(items[0].platform, '谷歌全网')
  assert.equal(items[0].risk, true)
  assert.equal(items[0].keyword, '北京')
  assert.equal(items[0].url, 'https://x/1')
})

test('getPolarityItems 把 page/pageSize 透传给 ASMX', async () => {
  let lastParams = null
  const client = fakeClient({
    getSpanTimeMediaInfo: (params) => {
      lastParams = params
      return SAMPLES.getSpanTimeMediaInfo
    },
  })
  await getPolarityItems(client, { startDay: 'a', endDay: 'b' }, { page: 3, pageSize: 20 })
  assert.equal(lastParams.page, 3)
  assert.equal(lastParams.number, 20)
})

// ───────────── filterItems & getPolarityPlatforms ─────────────

test('filterItems 按 sentiment3 过滤', async () => {
  const ctx = buildPolarityContext({ start: 'a', end: 'b' })
  const items = await getPolarityItems(fakeClient(), ctx, { page: 1, pageSize: 10 })
  const onlyPos = filterItems(items, { sentiment3: '正面' })
  assert.equal(onlyPos.length, 2)
  assert.ok(onlyPos.every((i) => i.sentiment3 === '正面'))
})

test('filterItems 按 platform 过滤', async () => {
  const ctx = buildPolarityContext({ start: 'a', end: 'b' })
  const items = await getPolarityItems(fakeClient(), ctx, { page: 1, pageSize: 10 })
  const onlyTw = filterItems(items, { platform: 'Twitter' })
  assert.equal(onlyTw.length, 3)
  assert.ok(onlyTw.every((i) => i.platform === 'Twitter'))
})

test('filterItems 同时按情感与平台过滤', async () => {
  const ctx = buildPolarityContext({ start: 'a', end: 'b' })
  const items = await getPolarityItems(fakeClient(), ctx, { page: 1, pageSize: 10 })
  const both = filterItems(items, { sentiment3: '负面', platform: 'Twitter' })
  assert.equal(both.length, 1)
  assert.equal(both[0].title, 'E')
})

test('filterItems 全部值是直通', async () => {
  const ctx = buildPolarityContext({ start: 'a', end: 'b' })
  const items = await getPolarityItems(fakeClient(), ctx, { page: 1, pageSize: 10 })
  assert.equal(filterItems(items, { sentiment3: '全部', platform: '全部' }).length, 5)
})

test('getPolarityPlatforms 按 items 频次降序', async () => {
  const ctx = buildPolarityContext({ start: 'a', end: 'b' })
  const items = await getPolarityItems(fakeClient(), ctx, { page: 1, pageSize: 10 })
  const platforms = getPolarityPlatforms(items)
  // Twitter 3, 谷歌全网 1, 微博 1
  assert.equal(platforms[0].key, 'Twitter')
  assert.equal(platforms[0].count, 3)
  assert.equal(platforms.length, 3)
})

// ───────────── paginate ─────────────

test('paginate 切片并报告总数', () => {
  const items = Array.from({ length: 23 }, (_, i) => ({ i }))
  const p1 = paginate(items, { page: 1, pageSize: 10 })
  assert.equal(p1.slice.length, 10)
  assert.equal(p1.total, 23)
  assert.equal(p1.page, 1)
  const p3 = paginate(items, { page: 3, pageSize: 10 })
  assert.equal(p3.slice.length, 3)
})

test('paginate 兜底非法 page/pageSize', () => {
  const items = [1, 2, 3]
  const p = paginate(items, { page: 0, pageSize: -10 })
  assert.equal(p.page, 1)
  assert.ok(p.pageSize >= 1)
})

// ───────────── aggregatePolarity ─────────────

test('aggregatePolarity 全成功返回完整 payload', async () => {
  const payload = await aggregatePolarity(fakeClient(), {
    page: 1,
    pageSize: 10,
    range: { start: '2026-06-18', end: '2026-06-24' },
  })
  assert.equal(payload.configured, true)
  assert.equal(payload.range.start, '2026-06-18')
  assert.equal(payload.summary.total, 34)
  assert.equal(payload.items.length, 5)
  assert.equal(payload.pagination.total, 5)
  assert.equal(payload.pagination.page, 1)
  assert.equal(payload.platforms.length, 3)
  assert.deepEqual(payload.errors, {})
})

test('aggregatePolarity summary 失败仍返回 items + errors.summary', async () => {
  const client = fakeClient({ getModMediaNumberByTime: new Error('boom') })
  const payload = await aggregatePolarity(client, {
    page: 1,
    pageSize: 10,
    range: { start: '2026-06-18', end: '2026-06-24' },
  })
  assert.equal(payload.summary, null)
  assert.match(payload.errors.summary, /boom/)
  assert.equal(payload.items.length, 5)
})

test('aggregatePolarity items 失败仍返回 summary + errors.items', async () => {
  const client = fakeClient({ getSpanTimeMediaInfo: new Error('feed-fail') })
  const payload = await aggregatePolarity(client, {
    page: 1,
    pageSize: 10,
    range: { start: '2026-06-18', end: '2026-06-24' },
  })
  assert.equal(payload.summary.total, 34)
  assert.equal(payload.items.length, 0)
  assert.match(payload.errors.items, /feed-fail/)
})

test('aggregatePolarity 应用 sentiment3 与 platform 过滤后 total 同步', async () => {
  const payload = await aggregatePolarity(fakeClient(), {
    sentiment3: '正面',
    platform: '全部',
    page: 1,
    pageSize: 10,
    range: { start: 'a', end: 'b' },
  })
  assert.equal(payload.pagination.total, 2)
  assert.equal(payload.items.length, 2)
  assert.ok(payload.items.every((i) => i.sentiment3 === '正面'))
})
