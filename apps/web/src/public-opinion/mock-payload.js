// ---------------------------------------------------------------------------
// Public-Opinion Overview Mock Payload
// ---------------------------------------------------------------------------
// 与 `aggregateOverview()` 返回的 DTO 形状一致,用于:
//   1. 本地开发/演示零成本看到稠密真实感数据
//   2. UI 组件 SSR / 单测的稳定固定值
//
// 触发开关见 `apps/web/app/api/public-opinion/overview/route.js`。
// 数据使用固定 seed 的 LCG 派生,模块加载即冻结 — 不随时间漂移。
// ---------------------------------------------------------------------------

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const EMOTION_LABELS = ['正面', '偏正面', '中立', '偏负面', '负面']
const MEDIAS = ['谷歌全网', 'Twitter', '微博', 'Telegram', 'Facebook', 'Reddit']

// 信息流采样池:24 个标题 × 6 平台 × 5 情感,覆盖足够多样
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

const WARNING_WORDS = [
  '负面', '投诉', '维权', '召回', '质量', '问题', '事故', '抗议', '审查', '泄露',
]

const RISK_INDEXES = [3, 9, 17, 25] // 30 条信息流中的 4 条 risk

function pad(n) {
  return String(n).padStart(2, '0')
}

function makeWeeklyTrend(rand) {
  // 7 天,每日 100–340
  const labels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const counts = labels.map(() => Math.round(100 + rand() * 240))
  return {
    total: counts.reduce((a, b) => a + b, 0),
    points: labels.map((label, i) => ({ label, count: counts[i] })),
  }
}

function makeTodayHourly(rand) {
  // 12 个 2 小时桶
  const labels = ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22']
  const counts = labels.map(() => Math.round(5 + rand() * 75))
  return {
    total: counts.reduce((a, b) => a + b, 0),
    points: labels.map((label, i) => ({ label: `${label}时`, count: counts[i] })),
  }
}

function makeSentimentDistribution(rand) {
  // 大致呈"中立偏多,两端少量"的分布
  const buckets = [156, 318, 920, 224, 65].map((base) =>
    Math.round(base * (0.85 + rand() * 0.3)),
  )
  return EMOTION_LABELS.map((label, i) => ({ label, count: buckets[i] }))
}

function makeMediaShare(rand) {
  // 6 个平台,counts 在 80–520 之间,降序
  const raw = MEDIAS.map((media) => ({ media, count: Math.round(80 + rand() * 440) }))
  raw.sort((a, b) => b.count - a.count)
  const total = raw.reduce((s, e) => s + e.count, 0)
  return raw.map((e) => ({ ...e, share: total > 0 ? e.count / total : 0 }))
}

function makeTodayPlatformShare(rand) {
  // 与 mediaShare 同 6 平台,但量级小一些
  return MEDIAS.map((media) => ({ media, count: Math.round(8 + rand() * 80) }))
    .sort((a, b) => b.count - a.count)
}

function makeMediaSentimentMatrix(rand) {
  // 6 × 5 矩阵
  return MEDIAS.map((media) => {
    const row = { media, total: 0 }
    EMOTION_LABELS.forEach((label) => {
      const v = Math.round(10 + rand() * 90)
      row[label] = v
      row.total += v
    })
    return row
  }).sort((a, b) => b.total - a.total)
}

function makeWarnings(rand) {
  return {
    warningTotal: 12,
    majorTotal: 3,
    topWords: WARNING_WORDS.map((word, i) => ({
      word,
      count: Math.round(60 + rand() * 80) - i * 4,
    })),
  }
}

function makeTopHotNews(rand) {
  const items = Array.from({ length: 10 }, (_, i) => {
    const hot = Math.round(200 + rand() * 800)
    const platform = MEDIAS[i % MEDIAS.length]
    return {
      platform,
      title: SAMPLE_TITLES[i % SAMPLE_TITLES.length],
      hotValue: hot,
      emotion: EMOTION_LABELS[i % EMOTION_LABELS.length],
      pubTime: `2026-06-${pad(15 + (i % 7))} ${pad((i * 3) % 24)}:00`,
      url: `https://example.com/hot/${i + 1}`,
    }
  }).sort((a, b) => b.hotValue - a.hotValue)
  const total = items.reduce((s, e) => s + e.hotValue, 0)
  return items.map((e) => ({ ...e, share: total > 0 ? e.hotValue / total : 0 }))
}

function makeLatestNews(rand) {
  // 30 条,情感与平台均匀分布,4 条 risk
  const riskSet = new Set(RISK_INDEXES)
  return Array.from({ length: 30 }, (_, i) => {
    const emotion = EMOTION_LABELS[i % EMOTION_LABELS.length]
    const platform = MEDIAS[i % MEDIAS.length]
    const title = SAMPLE_TITLES[i % SAMPLE_TITLES.length]
    const minute = pad((i * 7 + 3) % 60)
    const hour = pad(8 + (i % 12))
    // 用一点 rand 让顺序稳定但与 i 不同步,避免严格周期性看上去太假
    void rand()
    return {
      platform,
      title,
      keyword: i % 3 === 0 ? '关键词' + (i % 7) : '',
      risk: riskSet.has(i),
      sentiment: emotion,
      emotion,
      pubTime: `2026-06-22 ${hour}:${minute}`,
      url: `https://example.com/news/${i + 1}`,
    }
  })
}

function buildMockPayload() {
  const rand = seededRandom(42)
  const weeklyTrend = makeWeeklyTrend(rand)
  const todayHourly = makeTodayHourly(rand)
  const sentimentDistribution = makeSentimentDistribution(rand)
  const mediaShare = makeMediaShare(rand)
  const todayPlatformShare = makeTodayPlatformShare(rand)
  const mediaSentimentMatrix = makeMediaSentimentMatrix(rand)
  const warnings = makeWarnings(rand)
  const topHotNews = makeTopHotNews(rand)
  const latestNews = makeLatestNews(rand)

  return {
    configured: true,
    mock: true,
    errors: {},
    kpis: { todayCount: 247, weekCount: 1683, todayInfoCount: 412 },
    weeklyTrend,
    todayHourly,
    sentimentDistribution,
    mediaShare,
    todayPlatformShare,
    mediaSentimentMatrix,
    warnings,
    topHotNews,
    latestNews,
  }
}

export const MOCK_PAYLOAD = buildMockPayload()
