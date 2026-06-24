# Public Opinion Overview — Sticky Feed v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the 舆情总览 dashboard into a "left analysis + right sticky feed" console with denser left grid, four new d3+recharts visuals, and a one-flag dev mock dataset.

**Architecture:**
- Frontend: split `.po-dashboard` into `.po-overview-main` (8fr) + `.po-overview-aside` (4fr sticky). Existing scroll container `.po-dashboard { overflow-y: auto }` already verified — aside `position: sticky` works in-place. Below 1280px the layout collapses to a single column.
- Data: keep current `aggregateOverview` flow. Add two derived series in the aggregator: `weeklySentiment` (date × 5-emotion stack) and `todayHourlyByMedia` (12 buckets × N media). Route accepts `?mock=1` (dev-only) and `?slice=latest` (polling).
- New visuals reuse `src/public-opinion/d3-utils.js` (`blueScale`, `useCountUp`, `donutArcPath`) and recharts. Add `sparklinePath` and `stackedAreaSeries` helpers — no new npm deps.

**Tech Stack:** Next.js App Router (Node 20, ESM), React 18 client components, recharts, d3-scale / d3-scale-chromatic / d3-shape / d3-array / d3-interpolate (already installed), `node:test` + react-dom/server SSR string assertions.

## Global Constraints

- All steps run from repo root unless stated. Tests: `npm test`. Build: `npm run build`. Both must pass before claiming completion.
- Do not introduce new npm dependencies. Reuse the d3 subpackages already in `apps/web/package.json`.
- Do not touch ConsoleShell, BFF auth, asmx-client, or other dashboards.
- All animations must be guarded by `@media (prefers-reduced-motion: reduce)` — fall back to instant render.
- Use existing color tokens: `EMOTION_COLORS` for sentiment, `MEDIA_COLORS` for media palette, `PO_CHART_THEME` for chart theme. No new color literals outside of those constants.
- Production environment (`NODE_ENV === 'production'`) MUST ignore `?mock=1` query — only `PUBLIC_OPINION_MOCK=1` env enables mock in prod (intended for staging demos).
- Use `'use client'` directive for any component using hooks / `useState` / `useEffect` / browser APIs.
- File paths: components live in `apps/web/components/`, library code in `apps/web/src/public-opinion/`, tests in `apps/web/tests/`.

---

## Task 1: Mock Payload Module

**Files:**
- Create: `apps/web/src/public-opinion/mock-payload.js`
- Test: `apps/web/tests/public-opinion-mock-payload.test.js`

**Interfaces:**
- Consumes: nothing (pure data module)
- Produces: `MOCK_PAYLOAD` — a constant object matching the shape returned by `aggregateOverview`, with `configured: true`, `mock: true`, `errors: {}`, plus all 10 widget keys (`kpis`, `weeklyTrend`, `todayHourly`, `sentimentDistribution`, `mediaShare`, `todayPlatformShare`, `mediaSentimentMatrix`, `warnings`, `topHotNews`, `latestNews`). Also `weeklySentiment` and `todayHourlyByMedia` (the two new derived series).

- [ ] **Step 1: Write the failing test**

```js
// apps/web/tests/public-opinion-mock-payload.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { MOCK_PAYLOAD } from '../src/public-opinion/mock-payload.js'

test('MOCK_PAYLOAD carries configured:true and mock:true flags', () => {
  assert.equal(MOCK_PAYLOAD.configured, true)
  assert.equal(MOCK_PAYLOAD.mock, true)
  assert.deepEqual(MOCK_PAYLOAD.errors, {})
})

test('MOCK_PAYLOAD contains all 10 widget keys plus 2 derived series', () => {
  const required = [
    'kpis', 'weeklyTrend', 'todayHourly', 'sentimentDistribution',
    'mediaShare', 'todayPlatformShare', 'mediaSentimentMatrix',
    'warnings', 'topHotNews', 'latestNews',
    'weeklySentiment', 'todayHourlyByMedia',
  ]
  for (const k of required) assert.ok(MOCK_PAYLOAD[k] != null, `missing ${k}`)
})

test('MOCK_PAYLOAD has 5+ media sources', () => {
  assert.ok(MOCK_PAYLOAD.mediaShare.length >= 5)
  assert.ok(MOCK_PAYLOAD.todayPlatformShare.length >= 5)
})

test('MOCK_PAYLOAD has 30 latest news with mixed sentiment and 4 risks', () => {
  assert.equal(MOCK_PAYLOAD.latestNews.length, 30)
  const risks = MOCK_PAYLOAD.latestNews.filter((n) => n.risk)
  assert.equal(risks.length, 4)
  const sentiments = new Set(MOCK_PAYLOAD.latestNews.map((n) => n.emotion))
  assert.ok(sentiments.size >= 4, 'latestNews should span ≥4 emotions')
})

test('MOCK_PAYLOAD weeklySentiment is 7 days × 5 emotion keys', () => {
  assert.equal(MOCK_PAYLOAD.weeklySentiment.length, 7)
  for (const day of MOCK_PAYLOAD.weeklySentiment) {
    for (const k of ['正面', '偏正面', '中立', '偏负面', '负面']) {
      assert.ok(typeof day[k] === 'number', `${day.date} missing ${k}`)
    }
  }
})

test('MOCK_PAYLOAD todayHourlyByMedia: each media row has 12 buckets', () => {
  for (const row of MOCK_PAYLOAD.todayHourlyByMedia) {
    assert.equal(row.hours.length, 12, `${row.media} should have 12 buckets`)
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx --workspaces=false node --import tsx --test apps/web/tests/public-opinion-mock-payload.test.js`
Expected: FAIL with `Cannot find module '../src/public-opinion/mock-payload.js'`.

- [ ] **Step 3: Write the mock payload module**

```js
// apps/web/src/public-opinion/mock-payload.js
// 看板开发用丰满数据。MOCK_PAYLOAD 形状与 aggregateOverview 完全一致,
// 另外多两个派生字段:weeklySentiment / todayHourlyByMedia(便于新图独立调试)。
// 数据固定写死,不随时间漂移 — mock 用途是调样式而非模拟生产。

const MEDIA = ['谷歌全网', 'Twitter', '微博', 'Telegram', 'Facebook', 'Reddit']
const EMO = ['正面', '偏正面', '中立', '偏负面', '负面']

// 7 天日期(以 2026-06-22 为基准的固定字符串,避免 Date.now 引入测试漂移)
const DAYS = ['6-16', '6-17', '6-18', '6-19', '6-20', '6-21', '6-22']
const WEEKLY_TOTAL = [180, 220, 260, 240, 300, 280, 247]

// 7 天 × 5 情感 — 固定比例(正8% 偏正19% 中立55% 偏负13% 负5%)
const SENT_RATIO = { '正面': 0.08, '偏正面': 0.19, '中立': 0.55, '偏负面': 0.13, '负面': 0.05 }

const weeklyTrend = {
  points: DAYS.map((label, i) => ({ label, count: WEEKLY_TOTAL[i] })),
}

const weeklySentiment = DAYS.map((date, i) => {
  const total = WEEKLY_TOTAL[i]
  return {
    date,
    '正面': Math.round(total * SENT_RATIO['正面']),
    '偏正面': Math.round(total * SENT_RATIO['偏正面']),
    '中立': Math.round(total * SENT_RATIO['中立']),
    '偏负面': Math.round(total * SENT_RATIO['偏负面']),
    '负面': Math.round(total * SENT_RATIO['负面']),
  }
})

// 12 个 2h 桶,数值固定丰满
const HOURLY = [4, 8, 14, 22, 30, 28, 35, 32, 24, 20, 16, 14]
const todayHourly = {
  total: HOURLY.reduce((s, v) => s + v, 0),
  points: HOURLY.map((count, i) => ({ label: String(i * 2).padStart(2, '0'), count })),
}

// 每媒体在 12 桶中的占比矩阵(总和=每桶值 × 比例)— 固定花纹
const MEDIA_HOUR_RATIO = [
  [0.35, 0.40, 0.30, 0.32, 0.36, 0.40, 0.42, 0.38, 0.36, 0.32, 0.30, 0.28], // 谷歌全网
  [0.20, 0.25, 0.30, 0.28, 0.24, 0.22, 0.20, 0.22, 0.24, 0.26, 0.28, 0.30], // Twitter
  [0.15, 0.12, 0.14, 0.16, 0.18, 0.16, 0.14, 0.16, 0.18, 0.18, 0.16, 0.14], // 微博
  [0.10, 0.08, 0.10, 0.10, 0.08, 0.08, 0.10, 0.10, 0.08, 0.08, 0.10, 0.12], // Telegram
  [0.12, 0.10, 0.10, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.10, 0.10, 0.10], // Facebook
  [0.08, 0.05, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06, 0.06], // Reddit
]
const todayHourlyByMedia = MEDIA.map((media, mi) => ({
  media,
  hours: HOURLY.map((total, hi) => Math.round(total * MEDIA_HOUR_RATIO[mi][hi])),
}))

const TODAY_PLATFORM_COUNT = [
  { media: '谷歌全网', count: 92 },
  { media: 'Twitter', count: 64 },
  { media: '微博', count: 38 },
  { media: 'Telegram', count: 24 },
  { media: 'Facebook', count: 19 },
  { media: 'Reddit', count: 10 },
]

const todayPlatformTotal = TODAY_PLATFORM_COUNT.reduce((s, p) => s + p.count, 0)
const todayPlatformShare = TODAY_PLATFORM_COUNT.map((p) => ({
  ...p,
  share: p.count / todayPlatformTotal,
}))

// 近 7 天媒体占比
const MEDIA_WEEK = [
  { media: '谷歌全网', count: 612 },
  { media: 'Twitter', count: 423 },
  { media: '微博', count: 248 },
  { media: 'Telegram', count: 156 },
  { media: 'Facebook', count: 124 },
  { media: 'Reddit', count: 120 },
]
const mediaWeekTotal = MEDIA_WEEK.reduce((s, m) => s + m.count, 0)
const mediaShare = MEDIA_WEEK.map((m) => ({ ...m, share: m.count / mediaWeekTotal }))

// 媒体 × 情感矩阵(行=媒体,各情感固定计数)
const mediaSentimentMatrix = MEDIA.map((media, i) => {
  const total = MEDIA_WEEK[i].count
  return {
    media,
    '正面': Math.round(total * SENT_RATIO['正面']),
    '偏正面': Math.round(total * SENT_RATIO['偏正面']),
    '中立': Math.round(total * SENT_RATIO['中立']),
    '偏负面': Math.round(total * SENT_RATIO['偏负面']),
    '负面': Math.round(total * SENT_RATIO['负面']),
  }
})

const sentimentDistribution = EMO.map((label) => {
  const sum = mediaSentimentMatrix.reduce((s, row) => s + row[label], 0)
  return { label, count: sum }
})

const TOP_HOT_TITLES = [
  'Дворцовый сад и Императорские покои – Пекин',
  'Российская гимнастка завоевала три золота',
  'Российские гимнастки блестяще выступили на Кубке',
  'Баскетбол 3x3 | Пекин – Ирландия | Женская серия',
  'Китай может быстро остановить СВО. Однако Пекин',
  'Дешевые авиабилеты Пекин — Париж',
  'Белорусские грации завоевали две медали на этапе',
  'Эмомали Рахмон встретился с лидерами Пекина',
  'Пекин-Москва транзитный коридор расширяется',
  'Олимпиада Пекин-2030: первые соревнования',
]
const topHotNews = TOP_HOT_TITLES.map((title, i) => {
  const hotValue = 1000 - i * 78
  return {
    title,
    platform: MEDIA[i % MEDIA.length],
    keyword: '北京',
    risk: i === 4,
    emotion: EMO[i % EMO.length],
    pubTime: `2026/6/${22 - (i % 5)} ${20 - i}:${10 + i}:00`,
    url: `https://example.com/hot-${i + 1}`,
    hotValue,
    share: hotValue / TOP_HOT_TITLES.reduce((s, _, j) => s + (1000 - j * 78), 0),
  }
})

const WARNING_WORDS = ['制裁', '抗议', '抵制', '冲突', '危机', '紧急', '风险', '风波', '事件', '负面']
const warnings = {
  warningTotal: 12,
  majorTotal: 3,
  topWords: WARNING_WORDS.map((word, i) => ({ word, count: 80 - i * 7 })),
}

// 30 条最新流 — 情感与平台各自循环;4 条 risk(每 8 条 1 个)
const latestNews = Array.from({ length: 30 }, (_, i) => ({
  platform: MEDIA[i % MEDIA.length],
  title: `${TOP_HOT_TITLES[i % TOP_HOT_TITLES.length]} #${i + 1}`,
  keyword: '北京',
  risk: i % 8 === 0,
  emotion: EMO[i % EMO.length],
  pubTime: `2026/6/${22 - (i % 7)} ${23 - (i % 24)}:${(i * 7) % 60}:00`.replace(/:(\d:)/, ':0$1'),
  url: `https://example.com/news-${i + 1}`,
}))

export const MOCK_PAYLOAD = Object.freeze({
  configured: true,
  mock: true,
  errors: {},
  kpis: { todayCount: 247, weekCount: 1683, todayInfoCount: 412 },
  weeklyTrend,
  weeklySentiment,
  todayHourly,
  todayHourlyByMedia,
  sentimentDistribution,
  mediaShare,
  todayPlatformShare,
  mediaSentimentMatrix,
  warnings,
  topHotNews,
  latestNews,
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx --workspaces=false node --import tsx --test apps/web/tests/public-opinion-mock-payload.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/public-opinion/mock-payload.js apps/web/tests/public-opinion-mock-payload.test.js
git commit -m "feat(po): add MOCK_PAYLOAD with full shape + derived series"
```

---

## Task 2: Aggregator Derived Series — weeklySentiment & todayHourlyByMedia

**Files:**
- Modify: `apps/web/src/public-opinion/overview.js` (extend `aggregateOverview` return)
- Test: `apps/web/tests/public-opinion-overview.test.js` (extend) — or create `apps/web/tests/public-opinion-overview-derived.test.js` if previous file doesn't exist

**Interfaces:**
- Consumes: existing `weeklyTrend.points`, `sentimentDistribution`, `todayHourly.points`, `todayPlatformShare` from `aggregateOverview`.
- Produces: aggregated payload now also contains `weeklySentiment: [{date, '正面', '偏正面', '中立', '偏负面', '负面}]` (7 entries, totals match per-day from weeklyTrend) and `todayHourlyByMedia: [{media, hours: number[12]}]` (one row per media in todayPlatformShare, hours sum equals todayHourly per bucket, distributed proportional to platform share).

- [ ] **Step 1: Locate or create the overview test file**

Run: `ls apps/web/tests | grep overview`
If `public-opinion-overview.test.js` exists, append. Otherwise create `apps/web/tests/public-opinion-overview-derived.test.js`.

- [ ] **Step 2: Write the failing test**

```js
// apps/web/tests/public-opinion-overview-derived.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { aggregateOverview } from '../src/public-opinion/overview.js'

// 最小 fake client:按 method 名返回静态 fixture
function fakeClient(fixtures) {
  return {
    call: async (method) => fixtures[method] ?? [],
  }
}

const FIXTURES = {
  getDayNumber: { number: 100 },
  getWeekNumber: { number: 700 },
  getOneDayAllInfoNumber: { number: 150 },
  getWeekModNumber: [
    { day: '6-16', number: 100 }, { day: '6-17', number: 100 },
    { day: '6-18', number: 100 }, { day: '6-19', number: 100 },
    { day: '6-20', number: 100 }, { day: '6-21', number: 100 },
    { day: '6-22', number: 100 },
  ],
  getModMediaNumberByTime: [
    { mod: '正面', number: 70 }, { mod: '偏正面', number: 140 },
    { mod: '中立', number: 385 }, { mod: '偏负面', number: 91 }, { mod: '负面', number: 14 },
  ],
  getMediaNumber: [
    { media: 'A', number: 400 }, { media: 'B', number: 300 },
  ],
  getHotNews: [],
  getTimeNumber: [
    { time: '00', number: 10 }, { time: '02', number: 10 },
    { time: '04', number: 10 }, { time: '06', number: 10 },
    { time: '08', number: 15 }, { time: '10', number: 15 },
    { time: '12', number: 15 }, { time: '14', number: 15 },
    { time: '16', number: 15 }, { time: '18', number: 15 },
    { time: '20', number: 10 }, { time: '22', number: 10 },
  ],
  getModNumberByMedia: [
    { media: 'A', mod: '正面', number: 40 }, { media: 'A', mod: '中立', number: 220 },
    { media: 'B', mod: '正面', number: 30 }, { media: 'B', mod: '中立', number: 165 },
  ],
  getOneDayMediaNumber: [
    { media: 'A', number: 60 }, { media: 'B', number: 40 },
  ],
  getEarlyWarningCount: { warningTotal: 0, majorTotal: 0 },
  getWordsTopList: [],
  getSpanTimeMediaInfo: [],
}

test('aggregateOverview returns weeklySentiment 7 × 5 with totals matching weeklyTrend', async () => {
  const payload = await aggregateOverview(fakeClient(FIXTURES))
  assert.ok(Array.isArray(payload.weeklySentiment))
  assert.equal(payload.weeklySentiment.length, 7)
  for (const row of payload.weeklySentiment) {
    for (const k of ['正面', '偏正面', '中立', '偏负面', '负面']) {
      assert.ok(typeof row[k] === 'number', `${row.date} missing ${k}`)
    }
  }
  // 第 0 天的 5 模态之和应该接近当日 weeklyTrend.count(派生用比例分配)
  const day0 = payload.weeklySentiment[0]
  const day0Total = ['正面','偏正面','中立','偏负面','负面'].reduce((s,k) => s + day0[k], 0)
  assert.ok(Math.abs(day0Total - payload.weeklyTrend.points[0].count) <= 2, '5 模态之和应≈当日总量')
})

test('aggregateOverview returns todayHourlyByMedia with N rows × 12 buckets', async () => {
  const payload = await aggregateOverview(fakeClient(FIXTURES))
  assert.ok(Array.isArray(payload.todayHourlyByMedia))
  assert.ok(payload.todayHourlyByMedia.length >= 1)
  for (const row of payload.todayHourlyByMedia) {
    assert.ok(typeof row.media === 'string')
    assert.equal(row.hours.length, 12, `${row.media} should have 12 buckets`)
  }
})

test('derived series degrade gracefully when sentimentDistribution empty', async () => {
  const empty = { ...FIXTURES, getModMediaNumberByTime: [] }
  const payload = await aggregateOverview(fakeClient(empty))
  // 仍然返回 7 天 array,但每个情感为 0(或与中立 100% 一致)
  assert.equal(payload.weeklySentiment.length, 7)
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="weeklySentiment|todayHourlyByMedia|derived series"`
Expected: FAIL — payload missing `weeklySentiment` / `todayHourlyByMedia`.

- [ ] **Step 4: Add derived-series logic to aggregateOverview**

Modify `apps/web/src/public-opinion/overview.js` — replace the existing `aggregateOverview` function:

```js
// 在文件底部新增两个派生函数
function deriveWeeklySentiment(weeklyTrend, sentimentDistribution) {
  const points = weeklyTrend?.points ?? []
  const dist = sentimentDistribution ?? []
  const total = dist.reduce((s, e) => s + (e.count ?? 0), 0)
  // 把情感分布按比例摊到每一天;total=0 时全 0
  const ratio = Object.fromEntries(EMOTION_LABELS.map((k) => {
    const found = dist.find((e) => e.label === k)
    return [k, total > 0 && found ? found.count / total : 0]
  }))
  return points.map((pt) => {
    const row = { date: pt.label }
    for (const k of EMOTION_LABELS) {
      row[k] = Math.round((pt.count ?? 0) * ratio[k])
    }
    return row
  })
}

function deriveTodayHourlyByMedia(todayHourly, todayPlatformShare) {
  const buckets = todayHourly?.points ?? []
  const platforms = todayPlatformShare ?? []
  if (platforms.length === 0) return []
  return platforms.map((p) => ({
    media: p.media,
    hours: buckets.map((b) => Math.round((b.count ?? 0) * (p.share ?? 0))),
  }))
}
```

Then modify the existing `aggregateOverview` (around line 194) to compute and attach the derived series before returning:

```js
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
  // 派生新图所需序列(纯前端派生,不增请求)
  payload.weeklySentiment = deriveWeeklySentiment(payload.weeklyTrend, payload.sentimentDistribution)
  payload.todayHourlyByMedia = deriveTodayHourlyByMedia(payload.todayHourly, payload.todayPlatformShare)
  return payload
}
```

Verify `getMediaShare` and `getTopHotNews` already emit `share` (v1 added this — grep to confirm; if not, add fallback `share: count / total` in the same file):

Run: `grep -n "share:" apps/web/src/public-opinion/overview.js`

If `share` is missing on `mediaShare`, append it in `getMediaShare` after the existing map.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="weeklySentiment|todayHourlyByMedia|derived series"`
Expected: PASS (3 tests). Also run the full overview test file to ensure no regression:
Run: `npm test -- apps/web/tests/public-opinion-overview*.test.js`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/public-opinion/overview.js apps/web/tests/public-opinion-overview-derived.test.js
git commit -m "feat(po): derive weeklySentiment and todayHourlyByMedia in aggregator"
```

---

## Task 3: Route — Mock Switch and slice=latest

**Files:**
- Modify: `apps/web/app/api/public-opinion/overview/route.js`
- Test: `apps/web/tests/public-opinion-overview-route.test.js` (extend or create)

**Interfaces:**
- Consumes: `MOCK_PAYLOAD` from Task 1, `aggregateOverview` from Task 2.
- Produces: Route `GET /api/public-opinion/overview` accepts query params:
  - `mock=1` → if `NODE_ENV !== 'production'`, return `MOCK_PAYLOAD`; in production this query is ignored.
  - `slice=latest` → return `{ latestNews: [...], mock?: true }` only; skips other widgets.
  - Both flags combine: `?mock=1&slice=latest` returns mock latest only.
  - Env `PUBLIC_OPINION_MOCK=1` → enable mock regardless of environment (overrides query precedence rules).
  - Response carries header `X-Mock: 1` when mock is active.

- [ ] **Step 1: Write the failing test**

```js
// apps/web/tests/public-opinion-overview-route.test.js  (create or append)
import test from 'node:test'
import assert from 'node:assert/strict'

// Next.js route file imports server-only modules; we exercise the GET handler
// directly by importing and constructing a fake Request.
async function importRoute() {
  return await import('../app/api/public-opinion/overview/route.js')
}

function makeRequest(url) {
  return new Request(url)
}

test('route returns MOCK_PAYLOAD when ?mock=1 in non-production', async () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  try {
    const { GET } = await importRoute()
    const res = await GET(makeRequest('http://localhost/api/public-opinion/overview?mock=1'))
    assert.equal(res.headers.get('X-Mock'), '1')
    const body = await res.json()
    assert.equal(body.mock, true)
    assert.equal(body.configured, true)
    assert.equal(body.latestNews.length, 30)
  } finally {
    process.env.NODE_ENV = prev
  }
})

test('route ignores ?mock=1 in production unless env flag set', async () => {
  const prevNode = process.env.NODE_ENV
  const prevMock = process.env.PUBLIC_OPINION_MOCK
  process.env.NODE_ENV = 'production'
  delete process.env.PUBLIC_OPINION_MOCK
  try {
    const { GET } = await importRoute()
    const res = await GET(makeRequest('http://localhost/api/public-opinion/overview?mock=1'))
    const body = await res.json()
    // 真实链路在无 env 配置时回 configured:false
    assert.notEqual(body.mock, true)
    assert.notEqual(res.headers.get('X-Mock'), '1')
  } finally {
    process.env.NODE_ENV = prevNode
    if (prevMock !== undefined) process.env.PUBLIC_OPINION_MOCK = prevMock
  }
})

test('route returns latestNews-only payload when ?slice=latest with mock', async () => {
  const prev = process.env.NODE_ENV
  process.env.NODE_ENV = 'development'
  try {
    const { GET } = await importRoute()
    const res = await GET(makeRequest('http://localhost/api/public-opinion/overview?mock=1&slice=latest'))
    const body = await res.json()
    assert.ok(Array.isArray(body.latestNews))
    assert.equal(body.latestNews.length, 30)
    assert.ok(body.kpis == null, 'slice=latest should not include kpis')
    assert.ok(body.weeklyTrend == null, 'slice=latest should not include weeklyTrend')
  } finally {
    process.env.NODE_ENV = prev
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/tests/public-opinion-overview-route.test.js`
Expected: FAIL — `GET` doesn't accept a Request arg, no mock branch, no `X-Mock` header.

- [ ] **Step 3: Rewrite the route handler**

Replace the contents of `apps/web/app/api/public-opinion/overview/route.js`:

```js
import { aggregateOverview } from '../../../../src/public-opinion/overview.js'
import { createAsmxClient } from '../../../../src/public-opinion/asmx-client.js'
import { isPublicOpinionConfigured } from '../../../../src/public-opinion/config.js'
import { MOCK_PAYLOAD } from '../../../../src/public-opinion/mock-payload.js'

export const dynamic = 'force-dynamic'

function isMockEnabled(url) {
  // env 始终生效;query 只在非生产生效
  if (process.env.PUBLIC_OPINION_MOCK === '1') return true
  if (process.env.NODE_ENV === 'production') return false
  return url.searchParams.get('mock') === '1'
}

export async function GET(request) {
  const url = new URL(request.url)
  const slice = url.searchParams.get('slice')
  const mock = isMockEnabled(url)

  if (mock) {
    const body = slice === 'latest'
      ? { latestNews: MOCK_PAYLOAD.latestNews, mock: true }
      : MOCK_PAYLOAD
    return Response.json(body, { headers: { 'X-Mock': '1' } })
  }

  if (!isPublicOpinionConfigured()) {
    return Response.json({ configured: false })
  }
  const payload = await aggregateOverview(createAsmxClient())
  if (slice === 'latest') {
    return Response.json({ latestNews: payload.latestNews ?? [] })
  }
  return Response.json(payload)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/web/tests/public-opinion-overview-route.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/public-opinion/overview/route.js apps/web/tests/public-opinion-overview-route.test.js
git commit -m "feat(po): support ?mock=1 and ?slice=latest in overview route"
```

---

## Task 4: d3-utils — sparklinePath helper

**Files:**
- Modify: `apps/web/src/public-opinion/d3-utils.js` (append)
- Test: `apps/web/tests/public-opinion-d3-utils.test.js` (create)

**Interfaces:**
- Consumes: nothing new (uses `d3-scale.scaleLinear` and `d3-shape.line` already in deps)
- Produces: `sparklinePath(points, options)` returning `{ d: string, lastX: number, lastY: number }`. `points` is `Array<{count: number}>` or `Array<number>`. Options `{ width = 120, height = 22, padding = 2 }`. Empty/null input returns `{ d: '', lastX: 0, lastY: height }`.

- [ ] **Step 1: Write the failing test**

```js
// apps/web/tests/public-opinion-d3-utils.test.js
import test from 'node:test'
import assert from 'node:assert/strict'
import { sparklinePath } from '../src/public-opinion/d3-utils.js'

test('sparklinePath returns SVG path d for numeric array', () => {
  const out = sparklinePath([1, 5, 3, 8, 2], { width: 100, height: 20 })
  assert.ok(out.d.startsWith('M'))
  assert.ok(out.d.includes('L'))
  // 末点 x 应在右边界附近(width - padding)
  assert.ok(out.lastX >= 80, `expected lastX near right edge, got ${out.lastX}`)
})

test('sparklinePath accepts {count} objects', () => {
  const out = sparklinePath([{ count: 1 }, { count: 5 }, { count: 3 }], { width: 60, height: 20 })
  assert.ok(out.d.length > 0)
})

test('sparklinePath returns empty d on empty input', () => {
  const out = sparklinePath([], { width: 100, height: 20 })
  assert.equal(out.d, '')
  assert.equal(out.lastX, 0)
})

test('sparklinePath handles single-point input without NaN', () => {
  const out = sparklinePath([5], { width: 100, height: 20 })
  assert.ok(!out.d.includes('NaN'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apps/web/tests/public-opinion-d3-utils.test.js`
Expected: FAIL — `sparklinePath` not exported.

- [ ] **Step 3: Append sparklinePath to d3-utils.js**

```js
// apps/web/src/public-opinion/d3-utils.js — 在文件末尾追加
import { scaleLinear } from 'd3-scale'
import { line as d3line, curveMonotoneX } from 'd3-shape'

/**
 * 给定一组数值,返回宽 w × 高 h 的迷你折线 SVG path d 字符串。
 * 支持 Array<number> 或 Array<{count: number}>;空输入返回空 d。
 * 末点坐标随返回,用于在末点画一个小圆点。
 */
export function sparklinePath(points, { width = 120, height = 22, padding = 2 } = {}) {
  const values = (points ?? []).map((p) => (typeof p === 'number' ? p : (p?.count ?? 0)))
  if (values.length === 0) return { d: '', lastX: 0, lastY: height }
  if (values.length === 1) {
    const x = width - padding
    const y = height / 2
    return { d: `M${padding},${y} L${x},${y}`, lastX: x, lastY: y }
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const x = scaleLinear().domain([0, values.length - 1]).range([padding, width - padding])
  const y = scaleLinear()
    .domain([min, max === min ? min + 1 : max])
    .range([height - padding, padding])
  const generator = d3line()
    .x((_, i) => x(i))
    .y((v) => y(v))
    .curve(curveMonotoneX)
  const d = generator(values) ?? ''
  return {
    d,
    lastX: x(values.length - 1),
    lastY: y(values[values.length - 1]),
  }
}
```

Verify the import line at the top of `d3-utils.js` matches existing convention. The existing file already imports from `d3-scale` and `d3-shape`; consolidate imports if your editor prefers (not required for correctness).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apps/web/tests/public-opinion-d3-utils.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/public-opinion/d3-utils.js apps/web/tests/public-opinion-d3-utils.test.js
git commit -m "feat(po): add sparklinePath d3 helper"
```

---

## Task 5: CSS — Layout, Density Tokens, Aside Sticky

**Files:**
- Modify: `apps/web/app/globals.css` (append a new section after the v1 `.po-grid-12` block, do not edit v1 rules)
- Test: covered by Task 11 snapshot/style assertions; this task's verification is visual + manual viewport check

**Interfaces:**
- Consumes: existing CSS variables (`--space`, `--color-*`)
- Produces: new class names available to JSX in later tasks:
  - `.po-overview-main`, `.po-overview-aside` — outer two-column wrappers
  - `.po-overview-grid` — internal 8-col grid for left column (with `[data-span='4'|'8']`)
  - `.po-feed-head`, `.po-feed-chips`, `.po-feed-chip`, `.po-feed-chip.is-active`, `.po-feed-item.is-risk`, `.po-feed-emo-bar`, `.po-live-dot`, `.po-live-dot.is-mock`
  - Density tokens scoped to `.po-dashboard`: `--po-pad`, `--po-gap`, `--po-panel-radius`, `--po-title-size`, `--po-subtitle-size`

- [ ] **Step 1: Append the new layout / density / aside / chip CSS block**

Open `apps/web/app/globals.css`. Locate the `/* 舆情总览看板 */` section (line ~915). After the existing `.po-dashboard` rule and before `.po-kpi-row`, change `.po-dashboard` to support two-column grid; everything else **appends** at the end of the public-opinion CSS section. Apply the full diff below:

Replace the existing `.po-dashboard` block (around line 917–925):

```css
.po-dashboard {
  --po-pad: 12px;
  --po-gap: 12px;
  --po-panel-radius: 10px;
  --po-title-size: 13px;
  --po-subtitle-size: 11px;
  display: grid;
  grid-template-columns: 8fr 4fr;
  gap: var(--po-gap);
  align-items: start;
  padding: var(--po-gap) 18px 22px;
  min-height: 0;
  overflow-y: auto;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1280px) {
  .po-dashboard {
    grid-template-columns: 1fr;
  }
}
```

Then append at the end of the existing public-opinion CSS section (after the v1 heatmap / wordcloud / feed rules):

```css
/* ── v2 双列布局 ─────────────────────────────────── */
.po-overview-main {
  display: contents;
}

.po-overview-main > .po-overview-grid {
  grid-column: 1 / 2;
}

.po-overview-aside {
  grid-column: 2 / 3;
  position: sticky;
  top: 84px;
  max-height: calc(100vh - 96px);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--po-pad);
  background: #ffffff;
  border: 1px solid #e5e6eb;
  border-radius: var(--po-panel-radius);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);
  overflow: hidden;
}

@media (max-width: 1280px) {
  .po-overview-main { display: contents; }
  .po-overview-main > .po-overview-grid { grid-column: 1 / -1; }
  .po-overview-aside {
    grid-column: 1 / -1;
    position: static;
    max-height: none;
  }
}

/* 左侧 8 列内部栅格 */
.po-overview-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--po-gap);
}

.po-overview-grid > [data-span] { grid-column: span 8; }
.po-overview-grid > [data-span='4'] { grid-column: span 4; }
.po-overview-grid > [data-span='8'] { grid-column: span 8; }

@media (max-width: 1280px) {
  .po-overview-grid {
    grid-template-columns: repeat(12, 1fr);
  }
  /* 单列模式下复用 v1 12 列规则:span=4 仍占 4,span=8 → span 12 */
  .po-overview-grid > [data-span='4'] { grid-column: span 6; }
  .po-overview-grid > [data-span='8'] { grid-column: span 12; }
}

/* 中等密度档:压 panel padding / title 字号 */
.po-dashboard .po-panel {
  padding: var(--po-pad);
  border-radius: var(--po-panel-radius);
}
.po-dashboard .po-panel-head h2 { font-size: var(--po-title-size); }
.po-dashboard .po-panel-head span { font-size: var(--po-subtitle-size); }

/* ── KPI 内嵌 Sparkline ───────────────────────────── */
.po-kpi-spark {
  display: block;
  margin-top: 4px;
  opacity: 0.85;
}
.po-kpi-spark .po-kpi-spark-path {
  fill: none;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.po-kpi-spark .po-kpi-spark-dot { r: 2; }

/* ── 右侧信息流头部 ─────────────────────────────── */
.po-feed-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f2f3f5;
}
.po-feed-head h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--po-title-size);
  font-weight: 600;
  color: #1d2129;
}

.po-live-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00b42a;
  box-shadow: 0 0 0 0 rgba(0, 180, 42, 0.4);
  animation: po-live-pulse 2s ease-in-out infinite;
}
.po-live-dot.is-mock {
  background: #c9cdd4;
  animation: none;
}
@keyframes po-live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 180, 42, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(0, 180, 42, 0); }
}

.po-feed-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.po-feed-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #4e5969;
  background: #f2f3f5;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 120ms;
}
.po-feed-chip:hover { background: #e5e6eb; }
.po-feed-chip:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}
.po-feed-chip.is-active {
  background: #e8f3ff;
  border-color: #1677ff;
  color: #1677ff;
}
.po-feed-chip-count {
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}

/* ── 信息流条目情感色条 + risk 高亮 ───────────── */
.po-overview-aside .po-feed {
  flex: 1 1 auto;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-y: auto;
}
.po-feed-item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px 8px 14px;
  border-bottom: 1px solid #f7f8fa;
}
.po-feed-emo-bar {
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: #c9cdd4;
}
.po-feed-item.is-risk {
  background: #fff1f0;
}

/* reduced-motion 兜底 */
@media (prefers-reduced-motion: reduce) {
  .po-live-dot { animation: none; }
}
```

- [ ] **Step 2: Validate by running existing tests (no regression)**

Run: `npm test -- apps/web/tests/public-opinion-densify.test.js`
Expected: PASS (v1 selectors `.po-grid-12`, `.po-kpi-bar`, `.po-heatmap-cell`, `.po-mini-donut`, `.po-chip--primary` still exist).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(po): add two-column sticky layout + density tokens + feed chips"
```

---

## Task 6: Sparkline Component + KPI Tile Slot

**Files:**
- Modify: `apps/web/components/public-opinion-overview-dashboard.jsx`
- Test: covered by Task 11

**Interfaces:**
- Consumes: `sparklinePath` from Task 4.
- Produces: `<Sparkline points color />` JSX subcomponent; `KpiTile` accepts an optional `spark` prop (a Sparkline node) rendered under the label.

- [ ] **Step 1: Add Sparkline subcomponent and update KpiTile**

In `apps/web/components/public-opinion-overview-dashboard.jsx`, add the `sparklinePath` import to the existing `d3-utils.js` import line:

```js
import {
  blueScale,
  contrastTextOn,
  donutArcPath,
  sparklinePath,
  useCountUp,
} from '../src/public-opinion/d3-utils.js'
```

Then add the Sparkline subcomponent after `MiniDonut` and before `RankRow`:

```jsx
function Sparkline({ points, color = '#1677ff' }) {
  const { d, lastX, lastY } = sparklinePath(points, { width: 120, height: 22, padding: 2 })
  if (!d) return null
  return (
    <svg className="po-kpi-spark" width="120" height="22" viewBox="0 0 120 22" aria-hidden="true">
      <path className="po-kpi-spark-path" d={d} stroke={color} />
      <circle className="po-kpi-spark-dot" cx={lastX} cy={lastY} fill={color} />
    </svg>
  )
}
```

Modify the existing `KpiTile` to accept a `spark` slot:

```jsx
function KpiTile({ label, value, icon, spark }) {
  const animated = useCountUp(Number(value) || 0)
  const display = Math.round(animated).toLocaleString('zh-CN')
  return (
    <div className="po-kpi-tile">
      <span className="po-kpi-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="po-kpi-body">
        <strong className="po-kpi-value">{display}</strong>
        <span className="po-kpi-label">{label}</span>
        {spark}
      </div>
    </div>
  )
}
```

Modify `KpiBar` to pass `spark` to each tile. `KpiBar` already accepts `data` and `error`; extend its signature to take `weeklyPoints`:

```jsx
function KpiBar({ data, error, weeklyPoints }) {
  return (
    <section className="po-panel console-section po-kpi-bar" data-span={8}>
      {error ? (
        <p className="po-panel-state is-error">KPI 加载失败:{error}</p>
      ) : (
        <>
          <KpiTile
            label="今日舆情量"
            value={data?.todayCount ?? 0}
            spark={<Sparkline points={weeklyPoints} color="#1677ff" />}
            icon={/* 保留既有 svg */}
          />
          <KpiTile
            label="本周舆情量"
            value={data?.weekCount ?? 0}
            spark={<Sparkline points={weeklyPoints} color="#14c9c9" />}
            icon={/* 保留既有 svg */}
          />
          <KpiTile
            label="当日信息量"
            value={data?.todayInfoCount ?? 0}
            spark={<Sparkline points={weeklyPoints} color="#86909c" />}
            icon={/* 保留既有 svg */}
          />
        </>
      )}
    </section>
  )
}
```

(Keep the 3 existing inline icon SVGs intact — just add `spark` and change `data-span={12}` → `data-span={8}`.)

- [ ] **Step 2: Verify SSR build still compiles**

Run: `npm run build`
Expected: build succeeds (no `window`/`document` access in Sparkline — all pure JSX with d3-shape/d3-scale).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/public-opinion-overview-dashboard.jsx
git commit -m "feat(po): KPI tiles host Sparkline + sparkline subcomponent"
```

---

## Task 7: StackedSentimentArea Component (Replaces Weekly Bar + Mini-Donut Row)

**Files:**
- Modify: `apps/web/components/public-opinion-overview-dashboard.jsx`
- Test: covered by Task 11

**Interfaces:**
- Consumes: `weeklySentiment: [{date, '正面', '偏正面', '中立', '偏负面', '负面'}]` from Task 2 aggregator
- Produces: `<StackedSentimentArea data />` subcomponent rendering a 5-emotion stacked area SVG. Empty data → null.

- [ ] **Step 1: Add d3 imports at top of component file**

Add to the existing imports block of `public-opinion-overview-dashboard.jsx`:

```js
import { stack as d3stack, area as d3area, line as d3line } from 'd3-shape'
import { scaleLinear, scaleBand } from 'd3-scale'
import { max as d3max, mean as d3mean } from 'd3-array'
```

Note: `d3-shape` already exists via `donutArcPath`; we are extending the named imports. `d3-array` is already a dep (verify with `grep d3-array apps/web/package.json` — if missing, it's pulled transitively by `d3-scale`. If `npm run build` fails for missing `d3-array`, run `npm --workspace apps/web i d3-array` and document in commit).

- [ ] **Step 2: Add the StackedSentimentArea subcomponent**

Insert after `Heatmap` and before `avgOf`:

```jsx
function StackedSentimentArea({ data, width = 560, height = 200 }) {
  if (!data || data.length === 0) return null
  const margin = { top: 12, right: 16, bottom: 22, left: 32 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const series = d3stack().keys(EMOTION_LABELS)(data)
  const yMax = d3max(series[series.length - 1], (s) => s[1]) ?? 0
  const x = scaleBand().domain(data.map((d) => d.date)).range([0, innerW]).padding(0)
  const y = scaleLinear().domain([0, yMax || 1]).range([innerH, 0]).nice()
  const xCenter = (d) => x(d.date) + x.bandwidth() / 2

  const areaGen = d3area()
    .x((d) => xCenter(d.data))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))

  const totalAvg = d3mean(data, (d) => EMOTION_LABELS.reduce((s, k) => s + (d[k] ?? 0), 0)) ?? 0
  const avgPath = `M0,${y(totalAvg)} L${innerW},${y(totalAvg)}`

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="po-stacked-area" role="img" aria-label="7 日情感堆叠面积">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {/* Y 轴线 */}
        <line x1={0} x2={innerW} y1={innerH} y2={innerH} stroke="#ebedf1" />
        {/* 堆叠面积 */}
        {series.map((s, i) => (
          <path key={s.key} d={areaGen(s)} fill={EMOTION_COLORS[s.key]} fillOpacity={0.82}>
            <title>{s.key}</title>
          </path>
        ))}
        {/* 均值虚线 */}
        <path d={avgPath} stroke="#86909c" strokeDasharray="4 4" strokeWidth={1} fill="none" />
        <text x={innerW - 4} y={y(totalAvg) - 4} textAnchor="end" fontSize={11} fill="#86909c">
          {`Avg ${totalAvg.toFixed(1)}`}
        </text>
        {/* X 轴刻度 */}
        {data.map((d) => (
          <text key={d.date} x={xCenter(d)} y={innerH + 14} textAnchor="middle" fontSize={11} fill="#86909c">
            {d.date}
          </text>
        ))}
        {/* Y 轴刻度(0 / yMax) */}
        <text x={-6} y={y(0) + 4} textAnchor="end" fontSize={11} fill="#86909c">0</text>
        <text x={-6} y={y(yMax) + 4} textAnchor="end" fontSize={11} fill="#86909c">{yMax}</text>
      </g>
    </svg>
  )
}
```

- [ ] **Step 3: Replace weekly bar + mini-donut row in the main render**

In the main `PublicOpinionOverviewDashboard` JSX, delete the two existing Panels (`本周舆情趋势` BarChart and `情感分布` MiniDonut row). Replace with a single Panel:

```jsx
<Panel
  title="情感 × 时间堆叠"
  subtitle="近 7 天 · 5 情感模态构成"
  span={8}
  error={errors.weeklyTrend || errors.sentimentDistribution}
  empty={weeklySentiment && weeklySentiment.length === 0}
>
  {weeklySentiment ? <StackedSentimentArea data={weeklySentiment} /> : null}
</Panel>
```

Add `const weeklySentiment = payload.weeklySentiment` near the existing `const weekly = payload.weeklyTrend` line.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/public-opinion-overview-dashboard.jsx
git commit -m "feat(po): replace weekly bar + mini-donut with stacked sentiment area"
```

---

## Task 8: MediaSentimentPercentBar (New Panel)

**Files:**
- Modify: `apps/web/components/public-opinion-overview-dashboard.jsx`

**Interfaces:**
- Consumes: `mediaSentimentMatrix` from aggregator (already exists)
- Produces: `<MediaSentimentPercentBar rows />` rendering recharts vertical 100% stacked bar.

- [ ] **Step 1: Add the subcomponent**

Insert after `StackedSentimentArea`:

```jsx
function MediaSentimentPercentBar({ rows }) {
  if (!rows || rows.length === 0) return null
  // 转成百分比;每行总量为基数
  const data = rows.map((row) => {
    const total = EMOTION_LABELS.reduce((s, k) => s + (row[k] ?? 0), 0) || 1
    const result = { media: row.media }
    for (const k of EMOTION_LABELS) {
      result[k] = Math.round(((row[k] ?? 0) / total) * 1000) / 10 // 0.1% 精度
    }
    return result
  })
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }} stackOffset="expand">
        <CartesianGrid strokeDasharray="3 3" stroke={PO_CHART_THEME.grid} horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} domain={[0, 1]} tick={PO_CHART_THEME.axisTick} />
        <YAxis type="category" dataKey="media" width={70} tick={PO_CHART_THEME.axisTick} />
        <Tooltip
          contentStyle={PO_CHART_THEME.tooltipStyle}
          formatter={(value) => `${value}%`}
        />
        {EMOTION_LABELS.map((k) => (
          <Bar key={k} dataKey={k} stackId="a" fill={EMOTION_COLORS[k]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
```

Note recharts auto-normalizes when `stackOffset="expand"` is set; the manual percentage map above is for tooltip readability.

- [ ] **Step 2: Insert the new Panel into render**

After the existing "今日平台分布" Panel, add (or replace one of the two columns in the row):

```jsx
<Panel
  title="媒体 × 情感百分比"
  subtitle="近 7 天 · 各平台情感构成"
  span={4}
  error={errors.mediaSentimentMatrix}
  empty={matrix && matrix.length === 0}
>
  {matrix ? <MediaSentimentPercentBar rows={matrix} /> : null}
</Panel>
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/public-opinion-overview-dashboard.jsx
git commit -m "feat(po): add MediaSentimentPercentBar — 100% stacked bar panel"
```

---

## Task 9: HourlyMediaHeat (Replaces Today Hourly Line)

**Files:**
- Modify: `apps/web/components/public-opinion-overview-dashboard.jsx`

**Interfaces:**
- Consumes: `todayHourlyByMedia: [{media, hours: number[12]}]` from Task 2
- Produces: `<HourlyMediaHeat rows />` SVG grid component

- [ ] **Step 1: Add the subcomponent**

Insert after `MediaSentimentPercentBar`:

```jsx
function HourlyMediaHeat({ rows }) {
  if (!rows || rows.length === 0) return null
  const allValues = rows.flatMap((r) => r.hours)
  const max = Math.max(1, ...allValues)
  const scale = blueScale(max)
  const hourLabels = Array.from({ length: 12 }, (_, i) => String(i * 2).padStart(2, '0'))
  return (
    <div className="po-hourly-heat" role="table" aria-label="今日分时 × 媒体热力">
      <div className="po-hourly-heat-head" role="row">
        <span className="po-hourly-heat-axis" />
        {hourLabels.map((h) => (
          <span key={h} className="po-hourly-heat-col" role="columnheader">{h}</span>
        ))}
      </div>
      {rows.map((row) => (
        <div className="po-hourly-heat-row" role="row" key={row.media}>
          <span className="po-hourly-heat-axis" role="rowheader">{row.media}</span>
          {row.hours.map((v, i) => {
            const bg = scale(v)
            return (
              <span
                key={i}
                role="cell"
                tabIndex={0}
                className="po-hourly-heat-cell"
                style={{ background: bg, color: contrastTextOn(bg) }}
                title={`${row.media} · ${hourLabels[i]} 时段:${v}`}
              >
                {v}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add supporting CSS to globals.css**

Append after the v2 chip section:

```css
.po-hourly-heat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.po-hourly-heat-head,
.po-hourly-heat-row {
  display: grid;
  grid-template-columns: 64px repeat(12, 1fr);
  gap: 2px;
  align-items: center;
}
.po-hourly-heat-axis {
  font-size: 11px;
  color: #86909c;
  text-align: right;
  padding-right: 6px;
}
.po-hourly-heat-col {
  font-size: 10px;
  color: #86909c;
  text-align: center;
}
.po-hourly-heat-cell {
  display: grid;
  place-items: center;
  height: 22px;
  border-radius: 3px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  cursor: default;
  transition: transform 120ms;
}
.po-hourly-heat-cell:hover,
.po-hourly-heat-cell:focus-visible {
  transform: scale(1.1);
  outline: 1.5px solid #1677ff;
  outline-offset: 1px;
  z-index: 1;
}
@media (prefers-reduced-motion: reduce) {
  .po-hourly-heat-cell { transition: none; }
  .po-hourly-heat-cell:hover { transform: none; }
}
```

- [ ] **Step 3: Replace the existing "今日分时趋势" Panel in render**

Find the Panel titled `今日分时趋势` (LineChart) and replace its contents (and possibly the panel title) with HourlyMediaHeat:

```jsx
<Panel
  title="今日分时 × 媒体"
  subtitle="今日 12 个 2h 桶 × 各平台"
  span={8}
  error={errors.todayHourly}
  empty={todayHourlyByMedia && todayHourlyByMedia.length === 0}
>
  {todayHourlyByMedia ? <HourlyMediaHeat rows={todayHourlyByMedia} /> : null}
</Panel>
```

Add `const todayHourlyByMedia = payload.todayHourlyByMedia` near the existing `const hourly = payload.todayHourly` line.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/public-opinion-overview-dashboard.jsx apps/web/app/globals.css
git commit -m "feat(po): replace today hourly line with media × hour heatmap"
```

---

## Task 10: Two-Column Wrapper + Sticky Feed with Chip Filter + Polling

**Files:**
- Modify: `apps/web/components/public-opinion-overview-dashboard.jsx`

**Interfaces:**
- Consumes: route `/api/public-opinion/overview` with optional `?mock=1` propagation, `?slice=latest` for polling
- Produces: top-level JSX has `<div className="po-overview-main">` wrapping the existing grid, plus `<aside className="po-overview-aside">` containing the feed with chip filter and live-dot indicator.

- [ ] **Step 1: Add useMemo/useRef imports and helpers**

Update React import:

```jsx
import React, { useEffect, useMemo, useRef, useState } from 'react'
```

Just below the top of the file (after `MEDIA_COLORS`), add helper:

```js
function emotionColorOf(emotion) {
  return EMOTION_COLORS[emotion] ?? '#c9cdd4'
}
```

- [ ] **Step 2: Rewrite the fetch effect to support mock query propagation + polling**

Replace the existing `useEffect` block in `PublicOpinionOverviewDashboard`:

```jsx
const [state, setState] = useState({ status: 'loading', payload: null })

useEffect(() => {
  let active = true
  const search = typeof window !== 'undefined' ? window.location.search : ''
  const params = new URLSearchParams(search)
  const mockOn = params.get('mock') === '1'
  const url = mockOn ? '/api/public-opinion/overview?mock=1' : '/api/public-opinion/overview'

  async function load() {
    try {
      const res = await fetch(url)
      const payload = await res.json()
      if (active) {
        setState({ status: 'ready', payload })
        if (payload?.mock) {
          // eslint-disable-next-line no-console
          console.info('[舆情看板] 当前为 mock 数据模式 — 真实接口被绕开')
        }
      }
    } catch (err) {
      if (active) setState({ status: 'error', payload: null, error: String(err?.message ?? err) })
    }
  }
  load()
  return () => { active = false }
}, [])

// 30 秒轮询信息流分段(mock 模式或不可见时跳过)
useEffect(() => {
  if (state.status !== 'ready') return
  if (state.payload?.mock) return
  if (typeof document === 'undefined') return
  let stopped = false
  const tick = async () => {
    if (stopped) return
    if (document.visibilityState !== 'visible') return
    try {
      const res = await fetch('/api/public-opinion/overview?slice=latest')
      const slice = await res.json()
      if (stopped) return
      if (Array.isArray(slice.latestNews)) {
        setState((s) => ({ ...s, payload: { ...s.payload, latestNews: slice.latestNews } }))
      }
    } catch { /* 静默,下一轮重试 */ }
  }
  const id = setInterval(tick, 30_000)
  return () => { stopped = true; clearInterval(id) }
}, [state.status, state.payload?.mock])
```

- [ ] **Step 3: Add feed chip filter state and derived counts**

Inside the same component, after the payload destructure (around `const latest = payload.latestNews`), add:

```jsx
const [feedFilter, setFeedFilter] = useState('all')
const latestList = latest ?? []

const feedPlatforms = useMemo(() => {
  const seen = new Map()
  for (const item of latestList) {
    const p = item.platform || '其他'
    seen.set(p, (seen.get(p) ?? 0) + 1)
  }
  return Array.from(seen.entries()).map(([platform, count]) => ({ platform, count }))
}, [latestList])

const filteredFeed = useMemo(() => {
  if (feedFilter === 'all') return latestList
  if (feedFilter === 'risk') return latestList.filter((n) => n.risk)
  return latestList.filter((n) => (n.platform || '其他') === feedFilter)
}, [latestList, feedFilter])

const riskCount = latestList.filter((n) => n.risk).length
const isMock = Boolean(payload.mock)
```

- [ ] **Step 4: Restructure the JSX to two-column**

Replace the outer return JSX:

```jsx
return (
  <div className="po-dashboard">
    <div className="po-overview-main">
      <div className="po-overview-grid">
        <KpiBar data={payload.kpis} error={errors.kpis} weeklyPoints={weekly?.points ?? []} />
        {/* ... 所有保留的左侧 Panel,改用 data-span=4|8(不再 6|12) ... */}
      </div>
    </div>

    <aside className="po-overview-aside" aria-label="最新舆情信息流">
      <header className="po-feed-head">
        <h2>
          最新舆情信息流
          <span className={`po-live-dot${isMock ? ' is-mock' : ''}`} aria-hidden="true" />
        </h2>
        <div className="po-feed-chips" role="toolbar" aria-label="信息流过滤">
          <button
            type="button"
            className={`po-feed-chip${feedFilter === 'all' ? ' is-active' : ''}`}
            aria-pressed={feedFilter === 'all'}
            onClick={() => setFeedFilter('all')}
          >
            全部 <span className="po-feed-chip-count">{latestList.length}</span>
          </button>
          <button
            type="button"
            className={`po-feed-chip${feedFilter === 'risk' ? ' is-active' : ''}`}
            aria-pressed={feedFilter === 'risk'}
            onClick={() => setFeedFilter('risk')}
          >
            风险 <span className="po-feed-chip-count">{riskCount}</span>
          </button>
          {feedPlatforms.map(({ platform, count }) => (
            <button
              type="button"
              key={platform}
              className={`po-feed-chip${feedFilter === platform ? ' is-active' : ''}`}
              aria-pressed={feedFilter === platform}
              onClick={() => setFeedFilter(platform)}
            >
              {platform} <span className="po-feed-chip-count">{count}</span>
            </button>
          ))}
        </div>
      </header>
      <ul className="po-feed">
        {filteredFeed.map((item, i) => (
          <li key={`${item.url}-${i}`} className={`po-feed-item${item.risk ? ' is-risk' : ''}`}>
            <span className="po-feed-emo-bar" style={{ background: emotionColorOf(item.emotion) }} aria-hidden="true" />
            <div className="po-feed-main">
              <a href={item.url || undefined} target="_blank" rel="noreferrer" className="po-feed-title">
                {item.risk ? <span className="po-tag is-risk">风险</span> : null}
                {item.title || '(无标题)'}
              </a>
              <span className="po-feed-meta">
                {item.platform}
                {item.keyword ? ` · ${item.keyword}` : ''}
                {item.pubTime ? ` · ${item.pubTime}` : ''}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  </div>
)
```

In the `.po-overview-grid` block, update each remaining Panel's `span` prop:
- `KpiBar` → span 8
- `情感 × 时间堆叠` (Task 7) → span 8
- `今日分时 × 媒体` (Task 9) → span 8
- `今日平台分布` → span 4
- `媒体 × 情感百分比` (Task 8) → span 4
- `媒体来源占比` → span 4
- `Top 热门信息` → span 4
- `预警概览` → span 4
- `媒体 × 情感矩阵` → span 8
- **Remove** the old `最新舆情信息流` Panel from the grid (it now lives in aside).

Also update the loading skeleton at the top:

```jsx
if (state.status === 'loading') {
  return (
    <div className="po-dashboard">
      <div className="po-overview-main">
        <div className="po-overview-grid">
          {[8, 8, 8, 4, 4, 4, 4, 4, 8].map((span, i) => (
            <section
              key={i}
              className="po-panel console-section po-skeleton"
              data-span={span}
              style={{ minHeight: 200 }}
            />
          ))}
        </div>
      </div>
      <aside className="po-overview-aside po-skeleton" style={{ minHeight: 400 }} />
    </div>
  )
}
```

- [ ] **Step 5: Increase route latest limit to 30**

In `apps/web/src/public-opinion/overview.js`, find `getLatestNews` (line ~159) and change `number: 15` to `number: 30`:

```js
const list = await client.call('getSpanTimeMediaInfo', {
  startDay: ctx.startDay,
  endDay: ctx.endDay,
  page: 1,
  number: 30,
})
```

- [ ] **Step 6: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/public-opinion-overview-dashboard.jsx apps/web/src/public-opinion/overview.js
git commit -m "feat(po): split dashboard into two columns + sticky feed with chip filter + 30s polling"
```

---

## Task 11: Guard Tests (Sticky Feed v2)

**Files:**
- Create: `apps/web/tests/public-opinion-sticky-feed-v2.test.js`

**Interfaces:**
- Consumes: source files via fs.readFileSync (string assertions only — no DOM mount, matches v1 densify test pattern)
- Produces: regression guards for all new structural elements

- [ ] **Step 1: Write the guard tests**

```js
// apps/web/tests/public-opinion-sticky-feed-v2.test.js
import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

const cssText = readFileSync(path.resolve(import.meta.dirname, '../app/globals.css'), 'utf8')
const dashText = readFileSync(path.resolve(import.meta.dirname, '../components/public-opinion-overview-dashboard.jsx'), 'utf8')
const d3UtilsText = readFileSync(path.resolve(import.meta.dirname, '../src/public-opinion/d3-utils.js'), 'utf8')
const overviewText = readFileSync(path.resolve(import.meta.dirname, '../src/public-opinion/overview.js'), 'utf8')
const routeText = readFileSync(path.resolve(import.meta.dirname, '../app/api/public-opinion/overview/route.js'), 'utf8')

test('CSS:双列布局 + 中等密度 token + aside sticky', () => {
  assert.match(cssText, /\.po-dashboard\s*\{[^}]*grid-template-columns:\s*8fr\s+4fr/)
  assert.match(cssText, /--po-pad:\s*12px/)
  assert.match(cssText, /--po-gap:\s*12px/)
  assert.match(cssText, /\.po-overview-aside\s*\{[^}]*position:\s*sticky/s)
  assert.match(cssText, /@media\s*\(max-width:\s*1280px\)/)
})

test('CSS:8 列内部栅格 + data-span=4|8', () => {
  assert.match(cssText, /\.po-overview-grid\s*\{[^}]*grid-template-columns:\s*repeat\(8,\s*1fr\)/)
  assert.match(cssText, /\.po-overview-grid\s*>\s*\[data-span='4'\]/)
  assert.match(cssText, /\.po-overview-grid\s*>\s*\[data-span='8'\]/)
})

test('CSS:信息流 chip / 情感色条 / live-dot', () => {
  assert.match(cssText, /\.po-feed-chip\s*\{/)
  assert.match(cssText, /\.po-feed-chip\.is-active\s*\{/)
  assert.match(cssText, /\.po-feed-emo-bar\s*\{/)
  assert.match(cssText, /\.po-feed-item\.is-risk\s*\{/)
  assert.match(cssText, /\.po-live-dot\s*\{/)
  assert.match(cssText, /@keyframes po-live-pulse/)
})

test('CSS:HourlyMediaHeat 网格样式', () => {
  assert.match(cssText, /\.po-hourly-heat-cell\s*\{/)
  assert.match(cssText, /\.po-hourly-heat\s*\{/)
})

test('组件:双列容器 + sparkline + 4 张新图', () => {
  assert.match(dashText, /<div className="po-overview-main">/)
  assert.match(dashText, /<aside className="po-overview-aside"/)
  assert.match(dashText, /function Sparkline\b/)
  assert.match(dashText, /function StackedSentimentArea\b/)
  assert.match(dashText, /function MediaSentimentPercentBar\b/)
  assert.match(dashText, /function HourlyMediaHeat\b/)
})

test('组件:KPI tile 内嵌 spark + 三张 KPI 各自配色', () => {
  assert.match(dashText, /KpiTile[^{]*\{\s*label,\s*value,\s*icon,\s*spark/s)
  assert.match(dashText, /<Sparkline\s+points={weeklyPoints}\s+color="#1677ff"/)
  assert.match(dashText, /<Sparkline\s+points={weeklyPoints}\s+color="#14c9c9"/)
  assert.match(dashText, /<Sparkline\s+points={weeklyPoints}\s+color="#86909c"/)
})

test('组件:30 秒轮询 + visibilityState 守护 + mock 模式跳过', () => {
  assert.match(dashText, /setInterval\(\s*tick,\s*30[_]?000\s*\)/)
  assert.match(dashText, /visibilityState/)
  assert.match(dashText, /payload\?\.mock/)
})

test('组件:feed chip 过滤 + 风险 chip + 平台 chips', () => {
  assert.match(dashText, /useState\('all'\)/)
  assert.match(dashText, /feedFilter\s*===\s*'risk'/)
  assert.match(dashText, /feedPlatforms\.map/)
  assert.match(dashText, /aria-pressed=/)
})

test('d3-utils:sparklinePath 导出', () => {
  assert.match(d3UtilsText, /export\s+function\s+sparklinePath/)
})

test('聚合器:派生 weeklySentiment + todayHourlyByMedia', () => {
  assert.match(overviewText, /weeklySentiment\s*=/)
  assert.match(overviewText, /todayHourlyByMedia\s*=/)
  assert.match(overviewText, /number:\s*30/) // latest limit 提到 30
})

test('路由:mock 开关 + slice=latest + X-Mock 头', () => {
  assert.match(routeText, /MOCK_PAYLOAD/)
  assert.match(routeText, /PUBLIC_OPINION_MOCK/)
  assert.match(routeText, /slice.*latest|searchParams\.get\(['"]slice['"]\)/)
  assert.match(routeText, /['"]X-Mock['"]/)
})

test('v1 守护未回归:.po-grid-12 / .po-kpi-bar / .po-heatmap-cell / .po-mini-donut 仍存在', () => {
  // 即使 v1 选择器在 v2 不再被新代码使用,样式也应保留以兼容降级
  assert.match(cssText, /\.po-grid-12\s*\{/)
  assert.match(cssText, /\.po-kpi-bar\s*\{/)
  assert.match(cssText, /\.po-heatmap-cell\s*\{/)
  assert.match(cssText, /\.po-mini-donut\s*\{/)
})
```

- [ ] **Step 2: Run all tests**

Run: `npm test`
Expected: all pass (new tests + Task 1/2/3/4 tests + v1 densify guard).

If `public-opinion-densify.test.js` fails because the old "本周舆情趋势" or "情感分布" panels were removed (Task 7), update that v1 test to assert only **structural** v1 things still in place (CSS selectors). Do **not** delete the v1 file — adjust assertions if and only if they reference now-removed JSX strings.

If the densify test does reference text the new code no longer carries, adjust it minimally: remove the matching `assert.match` line(s) and replace with a comment `// v2 sticky-feed 替代了本周柱图与 5 小环;structural CSS 仍守护见 public-opinion-sticky-feed-v2.test.js`. Commit that adjustment as a separate `chore` commit.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/public-opinion-sticky-feed-v2.test.js
git commit -m "test(po): add v2 sticky feed + 4 new charts guard tests"
```

If the v1 densify test needed adjustment in Step 2:

```bash
git add apps/web/tests/public-opinion-densify.test.js
git commit -m "chore(po): adjust v1 densify guard to coexist with v2 sticky feed"
```

---

## Task 12: Manual Viewport Verification + OpenSpec Validation

**Files:** none changed

**Interfaces:** verification only.

- [ ] **Step 1: Run full test + build**

```bash
npm test
npm run build
```
Expected: both succeed.

- [ ] **Step 2: Start dev server and open with mock**

```bash
npm --workspace apps/web run dev
```
Open browser to `http://localhost:3000/public-opinion?mock=1`.

Verify (manual):
- KPI 三张卡每张底部有 sparkline,色调对应今日/本周/当日
- 中部 1 张堆叠面积图替代了旧本周柱 + 5 小环
- "今日分时 × 媒体" 是 N × 12 蓝色色块网格,不是折线
- 新增 "媒体 × 情感百分比" 横向 100% 堆叠条
- 右侧信息流常驻、30 条、chip 过滤可点(全部/风险/平台),情感色条与 risk 淡红可见
- live-dot 是灰色("is-mock"样式)
- Console 出现 `[舆情看板] 当前为 mock 数据模式` 提示

- [ ] **Step 3: Verify viewport breakpoints**

Resize browser to:
- 1440px: 双列,aside 右侧 sticky
- 1280px: 双列(边界,可能开始塌)
- 1024px: 单列,aside 落到底部,左侧栅格回退 12 列(原 span=4 → 6;span=8 → 12)

- [ ] **Step 4: Verify polling without mock**

Reload to `http://localhost:3000/public-opinion` (no mock query). 开发者工具 Network 面板等 30s,应看到 `?slice=latest` 请求。切到其他 Tab 30s 不应发起。

- [ ] **Step 5: Verify reduced motion**

System Preferences → Accessibility → Reduce motion → on. 刷新页面。live-dot 不再脉冲;sparkline / 堆叠面积无入场动画。

- [ ] **Step 6: Validate the OpenSpec change**

```bash
npx openspec validate 2026-06-22-public-opinion-overview-sticky-feed-v2 --strict
```
Expected: `Change '2026-06-22-public-opinion-overview-sticky-feed-v2' is valid`.

- [ ] **Step 7: Archive the change**

```bash
npx openspec archive 2026-06-22-public-opinion-overview-sticky-feed-v2 --yes
```

This moves the change to `openspec/changes/archive/` and merges its spec deltas into `openspec/specs/public-opinion-dashboard/spec.md`.

- [ ] **Step 8: Final commit**

```bash
git add openspec/
git commit -m "chore(openspec): archive public-opinion-overview-sticky-feed-v2"
```

---

## Self-Review Checklist (run before claiming done)

- [ ] All 12 tasks committed
- [ ] `npm test` green
- [ ] `npm run build` green
- [ ] `npx openspec validate 2026-06-22-public-opinion-overview-sticky-feed-v2 --strict` green (before archive)
- [ ] Viewport manual: 1440 / 1280 / 1024 all work
- [ ] Polling visible in DevTools at non-mock URL; suppressed under mock + when Tab hidden
- [ ] Reduced-motion fallback verified
- [ ] No new npm dependencies introduced (`git diff package*.json` is empty for new deps)
- [ ] v1 densify selectors still present in CSS (compat / safety net)
