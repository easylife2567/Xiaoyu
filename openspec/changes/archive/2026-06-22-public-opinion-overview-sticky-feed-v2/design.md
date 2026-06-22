## Context

[v1 密度化](../archive/2026-06-22-densify-overview-dashboard) 已落地:12 列栅格 + 紧凑 KPI + 5 小环 + 双 chip 排行 + 蓝色热力矩阵 + d3-utils 基础设施。本次在其基础上叠加**布局架构升级**(右侧 sticky 信息流)、**密度再压**(中等档)、**新图 4 张**与**开发 mock**,共同把看板从「分析图册」升级为「监控控制台」。

## Goals / Non-Goals

**Goals:**
- 1440×900 单屏可同时看到「全部分析区 + 实时信息流」,无需翻页;
- 左侧分析区密度再提 ~20%;
- 新图覆盖现有数据未充分挖掘的维度(情感时序趋势 / 媒体情感百分比 / 分时×媒体平面 / KPI 趋势)
- 开发环境一键 mock,样式调试 / 测试 / 演示零成本
- v1 已落地的视觉一致性(百炼蓝 + 情感语义色 + d3-utils)完全保留

**Non-Goals:**
- 引入 echarts;
- 改 BFF 鉴权 / 归一化 / shell;
- 暗色模式 / 日期选择器 / 新数据维度;
- ConsoleShell 级抽屉(侧栏只在本页内,不跨页)

## Decisions

### 决策 1:页面内固定列(左 8 + 右 4 sticky)

`.po-dashboard` 内拆两列:

```
┌──────────────────────────────────────────────────────────┐
│ .po-overview-main (left, span 8)                          │ ┌─────────────┐
│ ┌─── .po-overview-grid (8 cols internal) ───┐            │ │ .po-overview │
│ │ KPI compact bar +sparkline (8)            │            │ │  -aside      │
│ │ StackedSentimentArea (8)                  │            │ │  (right, 4) │
│ │ HourlyMediaHeat (4) │ TodayPlatform (4)   │            │ │  sticky      │
│ │ MediaSentimentPct (4) │ Warnings (4)      │            │ │  top:84px   │
│ │ MediaShare rank (4) │ TopHot rank (4)     │            │ │  内部滚动    │
│ │ MediaSentimentMatrix Heatmap (8)          │            │ │              │
│ └────────────────────────────────────────────┘            │ │ [chip filter]│
│                                                            │ │ ┌───┐ feed  │
└──────────────────────────────────────────────────────────┘ │ │ ●  item × 30│
                                                              │ │ └───┘       │
                                                              │ └─────────────┘
```

CSS:
```css
.po-dashboard {
  display: grid;
  grid-template-columns: 8fr 4fr;
  gap: var(--po-gap, 12px);
  align-items: start;
}
.po-overview-aside {
  position: sticky;
  top: 84px; /* ConsoleShell 已有 sticky 头部 */
  max-height: calc(100vh - 96px);
  overflow-y: auto;
}
@media (max-width: 1280px) {
  .po-dashboard { grid-template-columns: 1fr; }
  .po-overview-aside { position: static; max-height: none; }
}
```

**为什么不动 ConsoleShell**:shell 是全局抽屉,改动会影响所有控制台页面与"反馈/帮助"悬浮按钮的层级。页面内 sticky 是最小爆炸半径方案。

### 决策 2:左侧 grid 从 12 列细分到 8 列内部自由组合

v1 的 `.po-grid-12` 在 8fr 左列里要么过窄(span=4 等于 240px,折线图轴标签都挤)要么虚高(span=6 等于实际占满)。新增 `.po-overview-grid`:

```css
.po-overview-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: var(--po-gap, 12px);
}
.po-overview-grid > [data-span='4'] { grid-column: span 4; }
.po-overview-grid > [data-span='8'] { grid-column: span 8; }
@media (max-width: 1280px) {
  .po-overview-grid { grid-template-columns: repeat(12, 1fr); }
  /* 塌列时回到 v1 12 列规则,各 panel data-span 与 v1 共用 */
}
```

KpiBar / StackedSentimentArea / MediaSentimentMatrix 占 8;其余成对面板占 4+4。1280↓ 复用 v1 12 列回退。

### 决策 3:中等密度档(全局 token)

```css
:root {
  --po-pad: 12px;        /* v1 16px */
  --po-gap: 12px;        /* v1 16px */
  --po-panel-radius: 10px;
  --po-title-size: 13px; /* v1 14px */
  --po-subtitle-size: 11px;
}
```

`.po-panel-head` 高度从 ~44 降到 ~36;`.po-kpi-tile` 从 ~64 降到 ~56 + 内嵌 sparkline。整体高度压缩约 18–22%。

### 决策 4:KPI 内嵌 Sparkline

`KpiTile` 加 children/插槽 `<Sparkline points={weekly.points} />`:

```
┌─────────────────────────────────┐
│ [icon] 13                       │  ← 值
│        今日舆情量               │  ← 标签
│        ▁▂▃▆▅█▃                │  ← 30px sparkline (基于 weekly.points)
└─────────────────────────────────┘
```

实现:`d3-shape.line` + `d3-scale.scaleLinear`,SVG 22px 高 / 8px 字宽。三张 KPI 共用 `weekly.points`,只在 sparkline 色调上对应情感(今日舆情=primary 蓝、本周舆情=accent 青、当日信息=灰)。

### 决策 5:新图 1 — StackedSentimentArea(替"本周趋势 + 情感分布")

7 天 × 5 情感(正面/偏正/中立/偏负/负面)的堆叠面积图。一张图同时回答:① 趋势走向 ② 情感构成 ③ 日均比例。

数据派生:归一化层把 weeklyTrend 与 sentimentDistribution 合并出 `weeklySentiment: [{date, 正面, 偏正面, 中立, 偏负面, 负面}]`。若后端单字段不足,前端从既有 mediaSentimentMatrix 在归一化层派生(零后端改动)。

绘制:`d3.stack()(data)` 生成系列 → `d3-shape.area().x(date).y0(d=>d[0]).y1(d=>d[1])` 生成 path → 5 个 `<path fill={EMOTION_COLORS[label]} />` SVG。tooltip 用 React 状态 + mousemove 二分查找日期。

### 决策 6:新图 2 — MediaSentimentPercentBar(媒体×情感 100% 堆叠条)

横向 100% 堆叠条:每个媒体一行,5 色情感占比横向铺满。比 v1 热力矩阵更直观看"哪个平台情感更负面"。

绘制:直接复用 recharts `BarChart` `layout="vertical"` + `stackId="a"`,5 个 `<Bar />` 堆叠,Y 轴 dataKey=media,X 轴 type=number 域 0–100。轻量,无新代码。

### 决策 7:新图 3 — HourlyMediaHeat(今日分时×媒体小热力)

24 小时(12 个 2h 桶)× N 媒体的色块网格,复用 v1 `blueScale`。替掉单调的"今日分时折线"(原图只展示总量,缺平台维度)。

数据派生:归一化层从 todayHourly 与 todayPlatform 派生 `todayHourlyByMedia: [{media, hours: [count×12]}]`。

绘制:SVG `<g>` 网格,12×N 个 `<rect>`,色 = `blueScale(count)`,字色 = `contrastTextOn(bg)`。键盘 Tab 可达,hover tooltip。

### 决策 8:右侧信息流升级

```jsx
<aside className="po-overview-aside">
  <header className="po-feed-head">
    <h2>最新舆情信息流 <span className="po-live-dot" /></h2>
    <div className="po-feed-chips">
      <Chip active={f==='all'} onClick={...}>全部 {n}</Chip>
      <Chip active={f==='risk'} onClick={...}>风险 {n_risk}</Chip>
      {platforms.map(p => <Chip>{p} {n_p}</Chip>)}
    </div>
  </header>
  <ul className="po-feed">
    {filtered.map(item => (
      <li className={`po-feed-item ${item.risk ? 'is-risk' : ''}`}
          data-emo={item.sentiment}>
        <span className="po-feed-emo-bar" /> {/* 3px 左色条 */}
        <a>{item.title}</a>
        <span className="po-feed-meta">{item.platform} · {item.pubTime}</span>
      </li>
    ))}
  </ul>
</aside>
```

- 30 条:`/api/public-opinion/overview` 已经支持 latest;只把组件 slice 从 15 改 30,后端 limit 改 30
- 30s 轮询:`useInterval(30_000)` 调用 `/api/public-opinion/overview?slice=latest` 只拿信息流分段,更新 state 局部刷新
- mock 开启时关闭轮询(避免无意义请求,console.info 提示)
- 情感色条:`.po-feed-emo-bar` 用 `EMOTION_COLORS[item.sentiment]`;无情感字段时回退灰
- risk 高亮:`.po-feed-item.is-risk { background: #fff1f0 }`

后端最小改动:`route.js` 检查 `?slice=latest` 时只调 `getNewInfoList` 一个接口跳过其他聚合,返回 `{ latestNews: [...] }`。

### 决策 9:开发 Mock 数据

**触发**:
1. URL query:`?mock=1`(优先级最高,仅开发环境生效)
2. env:`PUBLIC_OPINION_MOCK=1`(env 优先级低于 query)
3. 生产环境(`NODE_ENV=production`)忽略 query,只看 env;若 env 未设也不启用

**实现** `apps/web/src/public-opinion/mock-payload.js`:

```js
// 固定 seed 的伪随机(无 d3-random,Math.sin 即可)
export const MOCK_PAYLOAD = {
  configured: true,
  mock: true,
  kpis: { todayCount: 247, weekCount: 1683, todayInfoCount: 412 },
  weeklyTrend: { points: [/* 7 天均匀分布,各 100–300 */] },
  todayHourly: { points: [/* 12 桶,各 5–80 */], total: 247 },
  sentimentDistribution: [
    { label: '正面', count: 156 }, { label: '偏正面', count: 318 },
    { label: '中立', count: 920 }, { label: '偏负面', count: 224 }, { label: '负面', count: 65 }
  ],
  mediaShare: [/* 6 媒体:谷歌全网、Twitter、微博、Telegram、Facebook、Reddit */],
  todayPlatformShare: [/* 同上 6 媒体当日量 */],
  mediaSentimentMatrix: [/* 6 × 5 矩阵 */],
  warnings: { warningTotal: 12, majorTotal: 3, topWords: [/* 10 个词 */] },
  topHotNews: [/* 10 条 */],
  latestNews: [/* 30 条,情感与平台均匀分布,风险条 4 条 */],
}
```

**路由层** `route.js`:

```js
const mockOn = req.nextUrl.searchParams.get('mock') === '1'
  ? (process.env.NODE_ENV !== 'production')
  : process.env.PUBLIC_OPINION_MOCK === '1'

if (mockOn) {
  const { MOCK_PAYLOAD } = await import('@/src/public-opinion/mock-payload.js')
  // ?slice=latest 时只回 latestNews
  if (req.nextUrl.searchParams.get('slice') === 'latest') {
    return Response.json({ latestNews: MOCK_PAYLOAD.latestNews, mock: true })
  }
  return Response.json(MOCK_PAYLOAD, { headers: { 'X-Mock': '1' } })
}
// ... 既有逻辑
```

前端在 payload.mock=true 时 console.info 提示。

### 决策 10:fetch 策略调整

```jsx
useEffect(() => {
  const url = new URL('/api/public-opinion/overview', location.origin)
  if (new URLSearchParams(location.search).get('mock') === '1') url.searchParams.set('mock', '1')
  fetch(url).then(...).then(payload => {
    setState({ status: 'ready', payload })
    if (!payload.mock) startPolling() // mock 模式关闭轮询
  })
}, [])

function startPolling() {
  const id = setInterval(async () => {
    const res = await fetch('/api/public-opinion/overview?slice=latest')
    const { latestNews } = await res.json()
    setState(s => ({ ...s, payload: { ...s.payload, latestNews } }))
  }, 30_000)
  return () => clearInterval(id)
}
```

## Risks / Trade-offs

- **sticky 与 ConsoleShell 内部滚动冲突**:`po-dashboard` 在 ConsoleShell 已是局部滚动容器(workbench-shell-ux 契约),sticky aside 需要 sticky 容器(scroll container)是 `.po-dashboard` 而非 window。实现前先验:如果 `.po-dashboard` 自带 `overflow: auto`,sticky 在其内部仍工作;若需调,把 sticky 改成 `.po-overview-aside` 自己作 sticky 的 ancestor 是 `.po-dashboard`。
- **轮询 vs 用户切走 Tab**:用 `document.visibilityState` 守护,隐藏时暂停。
- **mock 数据漂移**:mock 用固定值,不随时间变;若用户长时间停留 mock 模式,信息流时间戳会显得"过时"。可接受 — mock 用途是调样式,不是模拟生产。
- **新图 4 张导致左侧高度反而上升**:新图替了 2 张旧图(本周趋势 + 情感 5 小环 → 1 张 StackedSentimentArea;今日分时折线 → HourlyMediaHeat),净增 ~1 张。配合中等密度档,整体仍压缩。
- **响应式断点二级**:>1280 双列;≤1280 单列(aside 落底)。不再做"窄但保持双列"的中间档,简化心智。

## Migration Plan

视觉/前端改动为主,纯加法:

1. mock-payload.js + route.js mock 分支(可单独验证,先开发环境跑通 mock,改图时数据稠密)
2. 左 main / 右 aside sticky 双列骨架 + 中等密度 token
3. KpiTile 内嵌 Sparkline
4. StackedSentimentArea(替本周趋势 + 5 小环位置)
5. HourlyMediaHeat(替今日分时折线)
6. MediaSentimentPercentBar(新增 panel,与今日平台分布并列)
7. 信息流升级(条数 / chip / 色条 / risk / 轮询)
8. 守护测试 + viewport 校验

回滚 = 还原组件文件 + globals CSS 新增段 + route.js mock 分支 + 删 mock-payload.js。零数据/BFF/shell 改动。

## Open Questions(已敲定)

- ✅ 侧栏形态:页面内固定列(决策 1)
- ✅ 密度档:中等(决策 3)
- ✅ 图表库:recharts + d3 自定义(全部决策)
- ✅ 新图选项:Sparkline + StackedSentimentArea + MediaSentimentPercentBar + HourlyMediaHeat(决策 4–7)
- ✅ 信息流增强:全部(决策 8)
- ✅ mock 接入:后端开关 + URL query(决策 9)
- ⚠️ 实现前先验:ConsoleShell + .po-dashboard 的 sticky 容器关系,见 Risks
