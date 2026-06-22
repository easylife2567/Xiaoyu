// 舆情总览归一化层 — 把 legacy overView 接口的真实响应映射为稳定 DTO。
// 响应字段名只在此层出现;上游 BFF 与看板组件只消费 DTO。

export const EMOTION_LABELS = ['正面', '偏正面', '中立', '偏负面', '负面']

function pad(n) {
  return String(n).padStart(2, '0')
}

export function toDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function buildOverviewContext(now = new Date()) {
  const day = toDateString(now)
  // KPI 用「今日」;内容 widget(情感/媒体/热文)用近 7 天窗口,与本周趋势一致。
  const weekAgo = toDateString(new Date(now.getTime() - 6 * 86_400_000))
  return {
    day,
    startTime: weekAgo,
    endTime: day,
    startDay: weekAgo,
    endDay: day,
  }
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function getKpis(client, ctx) {
  const [dayData, weekData, infoMap] = await Promise.all([
    client.call('getDayNumber', { day: ctx.day }),
    client.call('getWeekNumber', {}),
    client.call('getOneDayAllInfoNumber', { oneday: ctx.day }),
  ])
  const todayInfoCount = Object.values(infoMap ?? {}).reduce((sum, v) => sum + num(v), 0)
  return {
    todayCount: num(dayData?.totalNumbe),
    weekCount: num(weekData?.totalNumbe),
    todayInfoCount,
  }
}

// 本周舆情趋势 — 直接取 getWeekNumber 的每日分桶(干净、快速的真实时间序列)。
export async function getWeeklyTrend(client) {
  const data = await client.call('getWeekNumber', {})
  const labels = data?.timeData ?? []
  const counts = data?.WeekdayNumber ?? []
  return {
    total: num(data?.totalNumbe),
    points: labels.map((label, i) => ({ label, count: num(counts[i]) })),
  }
}

export async function getSentimentDistribution(client, ctx) {
  const rows = await client.call('getModMediaNumberByTime', {
    startTime: ctx.startTime,
    endTime: ctx.endTime,
  })
  const totals = [0, 0, 0, 0, 0]
  for (const row of rows ?? []) {
    for (let i = 0; i < 5; i += 1) {
      totals[i] += num(row[i + 1])
    }
  }
  return EMOTION_LABELS.map((label, i) => ({ label, count: totals[i] }))
}

export async function getMediaShare(client, ctx) {
  const map = await client.call('getEachMediaNumber', {
    startTime: ctx.startTime,
    endTime: ctx.endTime,
  })
  const entries = Object.entries(map ?? {})
    .map(([media, count]) => ({ media, count: num(count) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
  const total = entries.reduce((sum, e) => sum + e.count, 0)
  return entries.map((e) => ({ ...e, share: total > 0 ? e.count / total : 0 }))
}

export async function getTopHotNews(client, ctx) {
  const list = await client.call('getSpanTimeTop10MediaInfo', {
    startDay: ctx.startDay,
    endDay: ctx.endDay,
  })
  const items = (list ?? []).slice(0, 10).map((item) => ({
    platform: item.platform ?? '',
    title: item.title ?? '',
    hotValue: num(item.hotValue),
    emotion: item.emotionValue ?? '',
    pubTime: item.pubTime ?? '',
    url: item.Url ?? '',
  }))
  const total = items.reduce((sum, e) => sum + e.hotValue, 0)
  return items.map((e) => ({ ...e, share: total > 0 ? e.hotValue / total : 0 }))
}

// 今日分时趋势 — getDayNumber 的按 2 小时分桶。
export async function getTodayHourly(client, ctx) {
  const data = await client.call('getDayNumber', { day: ctx.day })
  const labels = data?.timeData ?? []
  const counts = data?.dayNumber ?? []
  return {
    total: num(data?.totalNumbe),
    points: labels.map((label, i) => ({ label, count: num(counts[i]) })),
  }
}

// 媒体×情感矩阵 — getModMediaNumberByTime 各平台的 5 模态明细(过滤全 0、按总量降序)。
export async function getMediaSentimentMatrix(client, ctx) {
  const rows = await client.call('getModMediaNumberByTime', {
    startTime: ctx.startTime,
    endTime: ctx.endTime,
  })
  return (rows ?? [])
    .map((row) => {
      const entry = { media: row[0] ?? '', total: 0 }
      EMOTION_LABELS.forEach((label, i) => {
        const value = num(row[i + 1])
        entry[label] = value
        entry.total += value
      })
      return entry
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total)
}

// 今日各平台信息量 — getOneDayAllInfoNumber 的平台映射(过滤 0、降序)。
export async function getTodayPlatformShare(client, ctx) {
  const map = await client.call('getOneDayAllInfoNumber', { oneday: ctx.day })
  return Object.entries(map ?? {})
    .map(([media, count]) => ({ media, count: num(count) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
}

// 预警概览 — getYujing / getYujingZhongda 的预警量与高频词。
export async function getWarnings(client, ctx) {
  const [normal, major] = await Promise.all([
    client.call('getYujing', { startTime: ctx.startTime, endTime: ctx.endTime }),
    client.call('getYujingZhongda', { startTime: ctx.startTime, endTime: ctx.endTime }),
  ])
  const topWords = Object.entries(normal?.wordFreq ?? {})
    .map(([word, count]) => ({ word, count: num(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
  return {
    warningTotal: num(normal?.total),
    majorTotal: num(major?.total),
    topWords,
  }
}

// 最新舆情信息流 — getSpanTimeMediaInfo 的分页条目(带关键词/风险标记)。
// v2:limit 由 15 提升到 30,并把 emotion 映射到 5 模态字符串 sentiment(为情感色条服务)。
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

function toSentiment(value) {
  if (value == null) return '中立'
  const key = String(value)
  return EMOTION_VALUE_MAP[key] ?? '中立'
}

export async function getLatestNews(client, ctx) {
  const list = await client.call('getSpanTimeMediaInfo', {
    startDay: ctx.startDay,
    endDay: ctx.endDay,
    page: 1,
    number: 30,
  })
  return (list ?? []).map((item) => ({
    platform: item.platform ?? '',
    title: item.title ?? '',
    keyword: item.keyWord ?? '',
    risk: Boolean(item.risk),
    emotion: item.emotionValue ?? '',
    sentiment: toSentiment(item.emotionValue),
    pubTime: item.pubTime ?? '',
    url: item.Url ?? '',
  }))
}

export const OVERVIEW_WIDGETS = {
  kpis: getKpis,
  weeklyTrend: getWeeklyTrend,
  todayHourly: getTodayHourly,
  sentimentDistribution: getSentimentDistribution,
  mediaShare: getMediaShare,
  mediaSentimentMatrix: getMediaSentimentMatrix,
  todayPlatformShare: getTodayPlatformShare,
  warnings: getWarnings,
  topHotNews: getTopHotNews,
  latestNews: getLatestNews,
}

/**
 * 聚合全部看板 widget。单组件独立降级:某 widget 失败只置空该块并记入 errors,
 * 其余照常返回。返回 `{ configured:true, errors, ...widgets }`。
 */
export async function aggregateOverview(client, ctx = buildOverviewContext()) {
  const entries = Object.entries(OVERVIEW_WIDGETS)
  const settled = await Promise.allSettled(entries.map(([, fn]) => fn(client, ctx)))
  const payload = { configured: true, errors: {} }
  settled.forEach((result, index) => {
    const key = entries[index][0]
    if (result.status === 'fulfilled') {
      payload[key] = result.value
    } else {
      payload[key] = null
      payload.errors[key] = String(result.reason?.message ?? result.reason)
    }
  })
  return enrichWithDerived(payload)
}

/**
 * 派生 v2 新图表需要的字段(零后端改动):
 *  - weeklySentiment: 7 天 × 5 情感堆叠面积所需,从 weeklyTrend + sentimentDistribution 按比例派生
 *  - todayHourlyByMedia: 分时 × 媒体热力所需,从 todayHourly + todayPlatformShare 按平台占比派生
 *
 * 若任一上游数据缺失,对应派生字段被置 null,前端面板回退到空态。
 */
export function enrichWithDerived(payload) {
  payload.weeklySentiment = deriveWeeklySentiment(payload)
  payload.todayHourlyByMedia = deriveTodayHourlyByMedia(payload)
  return payload
}

function deriveWeeklySentiment(payload) {
  const weekly = payload?.weeklyTrend?.points
  const sentiment = payload?.sentimentDistribution
  if (!Array.isArray(weekly) || weekly.length === 0) return null
  if (!Array.isArray(sentiment) || sentiment.length === 0) return null

  const totalSentiment = sentiment.reduce((s, e) => s + num(e.count), 0)
  if (totalSentiment <= 0) return null

  const ratios = EMOTION_LABELS.map((label) => {
    const row = sentiment.find((e) => e.label === label)
    return totalSentiment > 0 ? num(row?.count) / totalSentiment : 0
  })

  return weekly.map((day) => {
    const total = num(day.count)
    const entry = { date: day.label }
    EMOTION_LABELS.forEach((label, i) => {
      entry[label] = Math.round(total * ratios[i])
    })
    return entry
  })
}

function deriveTodayHourlyByMedia(payload) {
  const hourly = payload?.todayHourly?.points
  const platforms = payload?.todayPlatformShare
  if (!Array.isArray(hourly) || hourly.length === 0) return null
  if (!Array.isArray(platforms) || platforms.length === 0) return null

  const totalPlatform = platforms.reduce((s, e) => s + num(e.count), 0)
  if (totalPlatform <= 0) return null

  // 取前 6 个平台,按各自占比把 12 小时桶分散
  const top = platforms.slice(0, 6)
  return top.map((p) => {
    const ratio = num(p.count) / totalPlatform
    const hours = hourly.map((h) => Math.round(num(h.count) * ratio))
    return { media: p.media, hours }
  })
}

