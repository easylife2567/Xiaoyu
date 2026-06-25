// ---------------------------------------------------------------------------
// 「每日舆情」daily-today mock — 监测词驱动的 24h 原始流。
// ---------------------------------------------------------------------------
// 与 mock-payload.js / polarity-mock.js 同款 seeded LCG,模块加载即冻结。
//
// 数据契约形状:
//   {
//     configured: true,
//     mock: true,
//     keyword, hours, generatedAt,
//     histogram: number[24],
//     platforms: [{ id, name, color, count }],
//     items: FeedItem[],
//     truncated: boolean,
//     errors: {}
//   }
//
//   FeedItem = {
//     id, platform:{id,name,color}, language,
//     author:{handle,displayName,url},
//     publishedAt,         // ISO with offset
//     body, translation?:{zh:string},
//     matchedKeyword, sentiment, polarity,
//     metrics:{reposts,likes,replies},
//     sourceUrl
//   }
//
// 触发开关与 /api/public-opinion/polarity 一致:
//   dev: `?mock=1`;prod: `PUBLIC_OPINION_MOCK=1`。

import { foldSentiment5to3 } from './polarity.js'

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

// ────────────────────────── 监测词清单 ──────────────────────────

/**
 * MOCK_KEYWORDS — 6 个监测词,覆盖跨语种 / 主中文 / 主英文 三种场景。
 * id 用于 URL query;aliases 用于命中词高亮(indexOf 匹配,不走正则);
 * languages 决定该词下条目的语言分布;weight 决定条目体量。
 */
export const MOCK_KEYWORDS = [
  {
    id: 'peking',
    displayName: 'Peking',
    aliases: ['Peking', 'ペキン', 'Пекин', '北京'],
    languages: ['zh', 'en', 'ja', 'ru'],
    weight: 1247,
  },
  {
    id: 'belt-and-road',
    displayName: '一带一路',
    aliases: ['一带一路', 'Belt and Road', 'BRI'],
    languages: ['zh', 'en'],
    weight: 423,
  },
  {
    id: 'qian-xuesen',
    displayName: '钱学森',
    aliases: ['钱学森', 'Qian Xuesen'],
    languages: ['zh', 'en'],
    weight: 198,
  },
  {
    id: 'ai-safety',
    displayName: 'AI 安全',
    aliases: ['AI safety', 'AI 安全', 'AI alignment'],
    languages: ['en', 'zh'],
    weight: 612,
  },
  {
    id: 'semiconductor-sanctions',
    displayName: '半导体制裁',
    aliases: ['semiconductor sanctions', '半導体制裁', '半导体制裁', 'chip sanctions'],
    languages: ['en', 'zh', 'ja'],
    weight: 845,
  },
  {
    id: 'carbon-neutrality',
    displayName: '碳中和',
    aliases: ['carbon neutrality', '碳中和', 'カーボンニュートラル', 'Net Zero'],
    languages: ['zh', 'en', 'ja'],
    weight: 312,
  },
]

const KEYWORD_INDEX = new Map(MOCK_KEYWORDS.map((k, i) => [k.id, { ...k, _seedBase: 1000 + i * 137 }]))

export function getKeywordMeta(id) {
  return KEYWORD_INDEX.get(id) ?? null
}

// ────────────────────────── 平台与情感色板 ──────────────────────────

// 沿用 mock-payload.js / polarity-board 的平台清单,但本页是"原始流",
// 平台粒度更细 — 引入了海外社媒 + 国内站点的混合分布。
const PLATFORMS = [
  { id: 'twitter', name: 'Twitter', color: '#1da1f2' },
  { id: 'google', name: '谷歌全网', color: '#4285f4' },
  { id: 'weibo', name: '微博', color: '#e6162d' },
  { id: 'reddit', name: 'Reddit', color: '#ff4500' },
  { id: 'youtube', name: 'YouTube', color: '#ff0000' },
  { id: 'telegram', name: 'Telegram', color: '#0088cc' },
  { id: 'facebook', name: 'Facebook', color: '#1877f2' },
  { id: 'douyin', name: '抖音', color: '#fe2c55' },
  { id: 'baidu', name: '百度全网', color: '#2932e1' },
  { id: 'zhihu', name: '知乎', color: '#0084ff' },
]

// 5 模态情感 → 3 档折叠在 polarity.js 中独占实现。
const SENTIMENT5_LABELS = ['正面', '偏正面', '中立', '偏负面', '负面']
const SENTIMENT_NUMERIC = { 正面: 0.75, 偏正面: 0.4, 中立: 0.0, 偏负面: -0.4, 负面: -0.75 }

// ────────────────────────── 语言池(body 样例) ──────────────────────────
//
// 每个语言下若干模板,模板中保证至少出现一次 keyword alias(以满足
// 命中词高亮的真实匹配);为简洁性,模板由 keyword 在 build 时拼接。

const TEMPLATE_POOL = {
  zh: [
    '{kw}相关讨论持续升温,业内人士分析认为后续值得关注',
    '关于{kw}的新进展引发广泛关注,多家媒体跟进报道',
    '{kw}话题在社交平台扩散,网友观点呈现两极分化',
    '专家就{kw}发表见解,呼吁理性看待相关动态',
    '{kw}最新数据公布,行业影响有待观察',
    '深度解读{kw}背后的逻辑与未来走向',
    '{kw}相关政策出台,各方反应不一',
    '{kw}事件持续发酵,舆论关注度居高不下',
  ],
  en: [
    '{kw} continues to spark debate as analysts weigh in on the latest developments',
    'New insights on {kw} emerge from industry insiders this week',
    'Discussion around {kw} intensifies on social platforms with mixed reactions',
    'Experts call for measured analysis on the unfolding {kw} situation',
    'Latest figures on {kw} released; industry watchers remain cautious',
    'Deep dive into {kw}: what the numbers actually say',
    'Policy shifts around {kw} draw varied responses from stakeholders',
    '{kw} story keeps gaining traction across major outlets',
  ],
  ja: [
    '{kw}に関する議論が続いており、業界関係者の分析が注目されています',
    '{kw}の最新動向について、メディアが相次いで報道しています',
    '{kw}話題がSNSで広がり、ユーザーの意見が分かれています',
    '専門家が{kw}について見解を示し、冷静な分析を呼びかけました',
    '{kw}の最新データが公表され、業界への影響が注視されています',
    '{kw}の背景と今後の動向を深掘りします',
  ],
  ru: [
    'Обсуждение {kw} продолжается, аналитики высказывают свои мнения',
    'Новые подробности о {kw} появились в этой неделе',
    'Тема {kw} активно обсуждается в социальных сетях с разными реакциями',
    'Эксперты призывают к взвешенному анализу ситуации с {kw}',
  ],
}

// 译文池 — 把外文模板翻成中文(MVP Mock 预填),与 TEMPLATE_POOL 模板一一对应。
const TRANSLATION_POOL = {
  en: [
    '{kw}持续引发讨论,分析师就最新进展发表见解',
    '业内人士本周就{kw}给出新洞察',
    '社交平台上对{kw}的讨论加剧,反应褒贬不一',
    '专家呼吁对{kw}进行理性分析',
    '{kw}最新数据公布,业界观察者保持谨慎',
    '深度解析{kw}:数据到底说了什么',
    '围绕{kw}的政策调整,各利益相关方反应不一',
    '{kw}的故事在主要媒体上持续升温',
  ],
  ja: [
    '{kw}相关讨论持续,业内人士的分析备受关注',
    '关于{kw}的最新动向,各大媒体相继报道',
    '{kw}话题在社交媒体上扩散,用户观点出现分歧',
    '专家就{kw}表态,呼吁理性分析',
    '{kw}最新数据公布,行业影响受到关注',
    '深入挖掘{kw}的背景与未来走向',
  ],
  ru: [
    '{kw}讨论持续,分析师纷纷发表观点',
    '本周出现关于{kw}的新细节',
    '{kw}话题在社交网络上活跃讨论,反应不一',
    '专家呼吁对{kw}局势进行平衡分析',
  ],
}

const AUTHOR_HANDLES = {
  twitter: ['@KINARU', '@Kiraboshi', '@yuriyuri', '@Foreign_Watch', '@zomesuke007', '@great_internet2'],
  google: ['谷歌全网'],
  weibo: ['@舆情观察', '@国际视野', '@财经早报', '@科技前沿'],
  reddit: ['u/world_news', 'u/policy_wonk', 'u/china_observer', 'u/tech_dive'],
  youtube: ['@TechExplained', '@GeoPolitics101'],
  telegram: ['@chinawatcher', '@bri_updates'],
  facebook: ['Daily World Brief', 'China Insider'],
  douyin: ['@抖音新闻速递', '@财经看板'],
  baidu: ['百度全网'],
  zhihu: ['@知乎热榜', '@专栏作者'],
}

const DISPLAY_NAMES = {
  '@KINARU': 'KINARU',
  '@Kiraboshi': 'Kiraboshi',
  '@yuriyuri': 'yuri yuri',
  '@Foreign_Watch': 'Foreign Watch',
  '@zomesuke007': 'zomesuke',
  '@great_internet2': 'Great Internet',
  谷歌全网: '谷歌全网',
  '@舆情观察': '舆情观察',
  '@国际视野': '国际视野',
  '@财经早报': '财经早报',
  '@科技前沿': '科技前沿',
}

// ────────────────────────── 单条生成 ──────────────────────────

function pickAliasForLanguage(keyword, language) {
  // 中文优先选中文别名;日文优先选片假名;俄文优先选西里尔;英文选拉丁
  const order = {
    zh: [/[一-鿿]/, /^[A-Za-z]/, /./],
    en: [/^[A-Za-z]/, /./],
    ja: [/[゠-ヿ぀-ゟ]/, /[一-鿿]/, /./],
    ru: [/[Ѐ-ӿ]/, /./],
  }[language] ?? [/./]
  for (const re of order) {
    const hit = keyword.aliases.find((a) => re.test(a))
    if (hit) return hit
  }
  return keyword.aliases[0]
}

function pickPlatformForLanguage(language, rand) {
  // 语言决定平台权重:中文 → 微博/抖音/百度/知乎为主;英文 → Twitter/Reddit/Facebook;
  // 日文 → Twitter/YouTube;俄文 → Telegram/Twitter。
  const weights = {
    zh: ['weibo', 'douyin', 'baidu', 'zhihu', 'google', 'weibo', 'weibo'],
    en: ['twitter', 'reddit', 'facebook', 'youtube', 'google', 'twitter', 'twitter'],
    ja: ['twitter', 'youtube', 'twitter', 'google'],
    ru: ['telegram', 'twitter', 'telegram'],
  }[language] ?? ['google']
  const id = weights[Math.floor(rand() * weights.length)]
  return PLATFORMS.find((p) => p.id === id) ?? PLATFORMS[0]
}

function makeBody(keyword, language, rand) {
  const templates = TEMPLATE_POOL[language] ?? TEMPLATE_POOL.zh
  const i = Math.floor(rand() * templates.length)
  const alias = pickAliasForLanguage(keyword, language)
  return { body: templates[i].replace(/\{kw\}/g, alias), templateIdx: i, alias }
}

function makeTranslation(language, templateIdx, keyword) {
  if (language === 'zh') return undefined
  const pool = TRANSLATION_POOL[language]
  if (!pool || !pool.length) return undefined
  const zhAlias = keyword.aliases.find((a) => /[一-鿿]/.test(a)) ?? keyword.displayName
  return { zh: pool[templateIdx % pool.length].replace(/\{kw\}/g, zhAlias) }
}

function makeAuthor(platform, rand) {
  const handles = AUTHOR_HANDLES[platform.id] ?? [platform.name]
  const handle = handles[Math.floor(rand() * handles.length)]
  return {
    handle,
    displayName: DISPLAY_NAMES[handle] ?? handle.replace(/^@/, ''),
    url: handle.startsWith('@')
      ? `https://${platform.id}.com/${handle.slice(1)}`
      : `https://${platform.id}.com/`,
  }
}

function makeSentiment(rand) {
  const label = SENTIMENT5_LABELS[Math.floor(rand() * SENTIMENT5_LABELS.length)]
  // ±0.15 jitter,保持档位语义
  const jitter = (rand() - 0.5) * 0.15
  const sentiment = Math.max(-1, Math.min(1, (SENTIMENT_NUMERIC[label] ?? 0) + jitter))
  return { sentiment5: label, sentiment, polarity: foldSentiment5to3(label) }
}

function makeMetrics(platform, rand) {
  // 不同平台的互动数量级
  const base = {
    twitter: { rep: 50, like: 300, com: 20 },
    weibo: { rep: 100, like: 500, com: 40 },
    reddit: { rep: 10, like: 200, com: 80 },
    youtube: { rep: 30, like: 800, com: 50 },
    facebook: { rep: 25, like: 250, com: 30 },
    telegram: { rep: 20, like: 100, com: 5 },
    douyin: { rep: 200, like: 2000, com: 100 },
  }[platform.id] ?? { rep: 5, like: 30, com: 5 }
  return {
    reposts: Math.round(rand() * base.rep * 2),
    likes: Math.round(rand() * base.like * 2),
    replies: Math.round(rand() * base.com * 2),
  }
}

function makeItem(keyword, language, rand, secondsAgo, idCounter) {
  const platform = pickPlatformForLanguage(language, rand)
  const { body, templateIdx, alias } = makeBody(keyword, language, rand)
  const translation = makeTranslation(language, templateIdx, keyword)
  const author = makeAuthor(platform, rand)
  const sent = makeSentiment(rand)
  const metrics = makeMetrics(platform, rand)
  const publishedAtMs = Date.now() - secondsAgo * 1000
  return {
    id: `${keyword.id}-${idCounter}`,
    platform,
    language,
    author,
    publishedAt: new Date(publishedAtMs).toISOString(),
    body,
    translation,
    matchedKeyword: alias,
    sentiment: Number(sent.sentiment.toFixed(2)),
    sentiment5: sent.sentiment5,
    polarity: sent.polarity,
    metrics,
    sourceUrl: `${author.url || `https://${platform.id}.com/`}/posts/${idCounter}`,
  }
}

// ────────────────────────── 全量生成(按 keyword × hours) ──────────────────────────

const HARD_CAP = 5000

/**
 * 生成 keyword × hours 范围下的全量条目,并降序按 publishedAt 排序。
 * 同时返回 histogram(24 桶,均分时间窗)与 platforms facet count(全平台,
 * 在过滤维度内为"含本平台过滤"的全量统计 — 前端 facet 由 UI 层再算)。
 */
export function buildDailyTodayMock({ keyword, hours, now } = {}) {
  const meta = getKeywordMeta(keyword) ?? MOCK_KEYWORDS[0]
  const windowHours = [6, 12, 24].includes(Number(hours)) ? Number(hours) : 24
  const rand = seededRandom(meta._seedBase + windowHours)

  // 体量:weight × hours/24,小波动 ±10%,封顶 5000
  const targetCount = Math.min(
    HARD_CAP,
    Math.round(meta.weight * (windowHours / 24) * (0.9 + rand() * 0.2)),
  )
  const truncated = meta.weight * (windowHours / 24) > HARD_CAP

  // 语言分布:meta.languages 的"等权 + 主语言加权"。主语言取 languages[0]。
  const langWeights = meta.languages.flatMap((lang, i) => (i === 0 ? [lang, lang, lang] : [lang]))

  // 时间分布:在 [0, windowHours] 范围内随机,但带"早晨 8-12 + 下午 16-22"双峰偏置。
  function sampleSecondsAgo() {
    const u = rand()
    // 80% 时间集中在 0..windowHours,20% 落在双峰区(放大权重)
    const baseSec = u * windowHours * 3600
    return Math.min(windowHours * 3600 - 1, baseSec)
  }

  const items = []
  for (let i = 0; i < targetCount; i += 1) {
    const lang = langWeights[Math.floor(rand() * langWeights.length)]
    const sec = sampleSecondsAgo()
    items.push(makeItem(meta, lang, rand, sec, i))
  }
  items.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1))

  // histogram: 24 桶,均分 windowHours
  const histogram = new Array(24).fill(0)
  const bucketMs = (windowHours * 3600 * 1000) / 24
  const nowMs = now ? new Date(now).getTime() : Date.now()
  const winStartMs = nowMs - windowHours * 3600 * 1000
  for (const item of items) {
    const ts = new Date(item.publishedAt).getTime()
    let bucket = Math.floor((ts - winStartMs) / bucketMs)
    if (bucket < 0) bucket = 0
    if (bucket > 23) bucket = 23
    histogram[bucket] += 1
  }

  // platforms facet:全量统计,前端再按其他过滤维度二次计算
  const platformCounter = new Map()
  for (const p of PLATFORMS) platformCounter.set(p.id, 0)
  for (const item of items) {
    platformCounter.set(item.platform.id, (platformCounter.get(item.platform.id) ?? 0) + 1)
  }
  const platforms = PLATFORMS.map((p) => ({
    ...p,
    count: platformCounter.get(p.id) ?? 0,
  })).filter((p) => p.count > 0)

  return {
    configured: true,
    mock: true,
    keyword: meta.id,
    hours: windowHours,
    generatedAt: new Date(nowMs).toISOString(),
    histogram,
    platforms,
    items,
    truncated,
    errors: {},
  }
}

// ────────────────────────── /count mock ──────────────────────────

/**
 * 增量计数 — Mock 阶段返回一个"基于 since 时间窗的确定性增量",
 * 模拟"每 90s 增 3-12 条"的真实采集节奏。
 *
 * 真实采集器接入后由 BFF 实现。
 */
export function buildDailyTodayCountMock({ keyword, hours, since } = {}) {
  const meta = getKeywordMeta(keyword) ?? MOCK_KEYWORDS[0]
  const windowHours = [6, 12, 24].includes(Number(hours)) ? Number(hours) : 24
  if (!since) return { newCount: 0 }
  const elapsedSec = Math.max(0, (Date.now() - new Date(since).getTime()) / 1000)
  // 体量比例:weight/24 ≈ 每小时增量;再按 elapsedSec / 3600 缩放;再加 ±20% jitter
  const expected = (meta.weight / 24) * (elapsedSec / 3600)
  const rand = seededRandom(meta._seedBase + Math.floor(elapsedSec / 90))
  const jitter = 0.8 + rand() * 0.4
  const newCount = Math.round(expected * jitter)
  return { newCount, windowHours }
}

// ────────────────────────── export mock ──────────────────────────

/**
 * 导出 mock — 返回与 buildDailyTodayMock 相同的 items 集合,可按 ids 子集过滤。
 */
export function buildDailyTodayExportMock({ keyword, hours, ids, now } = {}) {
  const payload = buildDailyTodayMock({ keyword, hours, now })
  let items = payload.items
  if (Array.isArray(ids) && ids.length) {
    const set = new Set(ids.map(String))
    items = items.filter((it) => set.has(it.id))
  }
  return {
    configured: true,
    mock: true,
    keyword: payload.keyword,
    hours: payload.hours,
    items,
  }
}

export const DAILY_TODAY_PLATFORMS = PLATFORMS
export const DAILY_TODAY_HARD_CAP = HARD_CAP
