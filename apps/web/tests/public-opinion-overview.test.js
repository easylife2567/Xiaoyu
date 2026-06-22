import assert from 'node:assert/strict'
import test from 'node:test'
import {
  EMOTION_LABELS,
  buildOverviewContext,
  getKpis,
  getWeeklyTrend,
  getTodayHourly,
  getSentimentDistribution,
  getMediaShare,
  getMediaSentimentMatrix,
  getTodayPlatformShare,
  getWarnings,
  getLatestNews,
  getTopHotNews,
  aggregateOverview,
} from '../src/public-opinion/overview.js'

/**
 * 归一化层单测 — 输入为探针抓取的真实 legacy 响应形状,断言映射为稳定 DTO。
 * 不触网:用 fakeClient 按 endpoint 返回固化样例。
 */

// 真实响应样例(取自探针,数值简化)
const SAMPLES = {
  getDayNumber: { totalNumbe: 6, timeData: ['00', '02', '04'], dayNumber: [1, 0, 5] },
  getWeekNumber: {
    totalNumbe: 67,
    timeData: ['6-14', '6-15', '6-16', '6-17', '6-18', '6-19', '6-20'],
    WeekdayNumber: [7, 19, 21, 14, 6, 0, 0],
  },
  getOneDayAllInfoNumber: { 谷歌全网: 3, Twitter: 2, 微博: 0 },
  getModMediaNumberByTime: [
    ['谷歌全网', '0', '2', '14', '0', '0'],
    ['Twitter', '1', '6', '7', '4', '0'],
  ],
  getEachMediaNumber: { 谷歌全网: 16, Twitter: 18, 微博: 0, 知乎: 0 },
  getSpanTimeTop10MediaInfo: [
    { platform: '谷歌全网', title: 'A', hotValue: '100', emotionValue: '0', pubTime: '2026/6/18 11:18:11', Url: 'https://x/1' },
    { platform: 'Twitter', title: '', hotValue: '90', emotionValue: '0.5', pubTime: '2026/6/18 11:18:02', Url: 'https://x/2' },
  ],
  getYujing: { total: 3, wordFreq: { 北京: 5, 治理: 2 } },
  getYujingZhongda: { total: 1, wordFreq: {} },
  getSpanTimeMediaInfo: [
    { platform: '谷歌全网', title: 'N1', keyWord: '北京', risk: true, emotionValue: '0', pubTime: '2026/6/20 23:35:16', Url: 'https://x/n1' },
    { platform: 'Twitter', title: '', keyWord: '', risk: false, emotionValue: '0.5', pubTime: '2026/6/20 10:00:00', Url: 'https://x/n2' },
  ],
}

function fakeClient(overrides = {}) {
  return {
    async call(endpoint) {
      if (endpoint in overrides) {
        const v = overrides[endpoint]
        if (v instanceof Error) throw v
        return v
      }
      return SAMPLES[endpoint]
    },
  }
}

const ctx = buildOverviewContext(new Date('2026-06-20T08:00:00'))

test('buildOverviewContext 给出今天 + 近 7 天窗口', () => {
  assert.equal(ctx.day, '2026-06-20')
  assert.equal(ctx.endTime, '2026-06-20')
  assert.equal(ctx.startTime, '2026-06-14')
})

test('getKpis 合并今日量/本周量/当日信息量', async () => {
  const kpis = await getKpis(fakeClient(), ctx)
  assert.deepEqual(kpis, { todayCount: 6, weekCount: 67, todayInfoCount: 5 })
})

test('getWeeklyTrend 取 getWeekNumber 的每日分桶', async () => {
  const trend = await getWeeklyTrend(fakeClient())
  assert.equal(trend.total, 67)
  assert.equal(trend.points.length, 7)
  assert.deepEqual(trend.points[0], { label: '6-14', count: 7 })
  assert.deepEqual(trend.points[2], { label: '6-16', count: 21 })
})

test('getSentimentDistribution 按列求和映射到 5 模态', async () => {
  const dist = await getSentimentDistribution(fakeClient(), ctx)
  assert.deepEqual(
    dist.map((d) => d.label),
    EMOTION_LABELS,
  )
  // 列求和:正面 0+1=1, 偏正面 2+6=8, 中立 14+7=21, 偏负面 0+4=4, 负面 0+0=0
  assert.deepEqual(
    dist.map((d) => d.count),
    [1, 8, 21, 4, 0],
  )
})

test('getMediaShare 过滤 0 值并按量降序, 派生 share 占比', async () => {
  const media = await getMediaShare(fakeClient(), ctx)
  assert.equal(media.length, 2)
  assert.equal(media[0].media, 'Twitter')
  assert.equal(media[0].count, 18)
  assert.ok(Math.abs(media[0].share + media[1].share - 1) < 1e-9, 'share 之和应为 1')
  assert.ok(media[0].share > media[1].share, '主项占比应更高')
})

test('getTopHotNews 映射热文字段并派生 share', async () => {
  const hot = await getTopHotNews(fakeClient(), ctx)
  assert.equal(hot.length, 2)
  assert.equal(hot[0].platform, '谷歌全网')
  assert.equal(hot[0].title, 'A')
  assert.equal(hot[0].hotValue, 100)
  assert.equal(hot[0].url, 'https://x/1')
  // share 之和应为 1(全部 hotValue 归一化)
  const totalShare = hot.reduce((s, e) => s + e.share, 0)
  assert.ok(Math.abs(totalShare - 1) < 1e-9)
})

test('getTodayHourly 取 getDayNumber 的分时分桶', async () => {
  const hourly = await getTodayHourly(fakeClient(), ctx)
  assert.equal(hourly.total, 6)
  assert.deepEqual(hourly.points, [
    { label: '00', count: 1 },
    { label: '02', count: 0 },
    { label: '04', count: 5 },
  ])
})

test('getMediaSentimentMatrix 给出各平台 5 模态明细并过滤全 0', async () => {
  const matrix = await getMediaSentimentMatrix(fakeClient(), ctx)
  assert.equal(matrix.length, 2)
  // 谷歌全网 total 16 > Twitter total 18? 谷歌=0+2+14+0+0=16, Twitter=1+6+7+4+0=18 → Twitter 在前
  assert.equal(matrix[0].media, 'Twitter')
  assert.equal(matrix[0].total, 18)
  assert.equal(matrix[0]['中立'], 7)
  assert.equal(matrix[1].media, '谷歌全网')
  assert.equal(matrix[1]['中立'], 14)
})

test('getTodayPlatformShare 过滤 0 并降序', async () => {
  const share = await getTodayPlatformShare(fakeClient(), ctx)
  assert.deepEqual(share, [
    { media: '谷歌全网', count: 3 },
    { media: 'Twitter', count: 2 },
  ])
})

test('getWarnings 汇总预警量与高频词', async () => {
  const warnings = await getWarnings(fakeClient(), ctx)
  assert.equal(warnings.warningTotal, 3)
  assert.equal(warnings.majorTotal, 1)
  assert.deepEqual(warnings.topWords[0], { word: '北京', count: 5 })
})

test('getWarnings 在空数据时优雅返回零', async () => {
  const warnings = await getWarnings(fakeClient({ getYujing: { total: 0, wordFreq: {} }, getYujingZhongda: { total: 0, wordFreq: {} } }), ctx)
  assert.deepEqual(warnings, { warningTotal: 0, majorTotal: 0, topWords: [] })
})

test('getLatestNews 映射信息流并标记风险', async () => {
  const feed = await getLatestNews(fakeClient(), ctx)
  assert.equal(feed.length, 2)
  assert.equal(feed[0].risk, true)
  assert.equal(feed[0].keyword, '北京')
  assert.equal(feed[1].risk, false)
})

test('aggregateOverview 全成功时返回全部模块且 errors 为空', async () => {
  const payload = await aggregateOverview(fakeClient(), ctx)
  assert.equal(payload.configured, true)
  assert.deepEqual(payload.errors, {})
  for (const key of [
    'kpis',
    'weeklyTrend',
    'todayHourly',
    'sentimentDistribution',
    'mediaShare',
    'mediaSentimentMatrix',
    'todayPlatformShare',
    'warnings',
    'topHotNews',
    'latestNews',
  ]) {
    assert.ok(payload[key] != null, `${key} 应有数据`)
  }
})

test('aggregateOverview 单接口失败时只降级该块,其余照常', async () => {
  const client = fakeClient({ getEachMediaNumber: new Error('media boom') })
  const payload = await aggregateOverview(client, ctx)
  assert.equal(payload.mediaShare, null)
  assert.match(payload.errors.mediaShare, /media boom/)
  // 其余块不受影响
  assert.ok(payload.weeklyTrend != null)
  assert.ok(payload.sentimentDistribution != null)
  assert.equal(payload.topHotNews.length, 2)
})
