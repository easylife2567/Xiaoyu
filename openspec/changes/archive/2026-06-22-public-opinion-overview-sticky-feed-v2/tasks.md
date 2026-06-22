## 1. Mock 数据基础设施

- [x] 1.1 新增 `apps/web/src/public-opinion/mock-payload.js`,导出 `MOCK_PAYLOAD`:KPI / weeklyTrend / todayHourly / sentimentDistribution / mediaShare(6 个) / todayPlatformShare / mediaSentimentMatrix(6×5) / warnings / topHotNews(10) / latestNews(30,情感与平台均匀分布,4 条 risk)
- [x] 1.2 修改 `apps/web/app/api/public-opinion/overview/route.js`:解析 `mock` query 与 `PUBLIC_OPINION_MOCK` env,生产环境(`NODE_ENV=production`)忽略 query,只看 env;命中时返回 MOCK_PAYLOAD,响应头 `X-Mock: 1`,payload 携带 `mock: true`
- [x] 1.3 同一路由支持 `?slice=latest`:命中时只回 `{ latestNews: [...], mock?: true }`,跳过其余聚合;mock 模式下也支持 slice
- [x] 1.4 单测覆盖:mock 开关命中、未命中(走真实链路)、slice=latest 路径

## 2. 布局架构(左 main + 右 aside sticky)

- [x] 2.1 `apps/web/app/globals.css` 新增中等密度 token:`--po-pad: 12px` / `--po-gap: 12px` / `--po-panel-radius: 10px` / `--po-title-size: 13px` / `--po-subtitle-size: 11px`,作用域 `.po-dashboard`
- [x] 2.2 `.po-dashboard` 改为 `display: grid; grid-template-columns: 8fr 4fr; gap: var(--po-gap)`,断点 ≤1280px 塌成 1fr 单列
- [x] 2.3 新增 `.po-overview-main` / `.po-overview-aside`;aside `position: sticky; top: 84px; max-height: calc(100vh - 96px); overflow-y: auto`(并验证 sticky 容器 = `.po-dashboard` 是否需要 `overflow:auto` 调整,见决策风险)
- [x] 2.4 新增 `.po-overview-grid`:左 main 内 8 列 repeat 栅格,`[data-span='4'|'8']` 选择器;≤1280 回退到 12 列 grid(复用 v1 数据 span)
- [x] 2.5 修改 `apps/web/components/public-opinion-overview-dashboard.jsx`:
  - 外层拆 `<div className="po-overview-main">` + `<aside className="po-overview-aside">`
  - main 内用 `.po-overview-grid`,移除 v1 `.po-grid-12`(或保留作 fallback,见 2.4)
  - aside 内放信息流(实现见 6)
  - loading 骨架同步两列

## 3. KPI 内嵌 Sparkline

- [x] 3.1 `apps/web/src/public-opinion/d3-utils.js` 新增 `sparklinePath(points, {w, h})`:`d3-scale.scaleLinear` + `d3-shape.line()` 返回 SVG path d 字符串
- [x] 3.2 新增 `Sparkline` 子组件:小型 SVG(width=120, height=22),接收 points + color,渲染 path + 末点小圆
- [x] 3.3 修改 `KpiTile` 加 children/`spark` 插槽;KpiBar 三张卡分别注入 weeklyTrend.points + 各自配色(`primary` / `accent` / `#86909c`)
- [x] 3.4 sparkline 在 `prefers-reduced-motion` 下不做 path 描边动画

## 4. 新图 1:StackedSentimentArea(替代本周趋势 + 情感 5 小环)

- [x] 4.1 路由层归一化:在 `route.js` 的 mock / 真实链路里都补出 `weeklySentiment: [{date, 正面, 偏正面, 中立, 偏负面, 负面}]`(从 mediaSentimentMatrix × weeklyTrend 派生,缺数据时按当日总量 × 情感分布比例派生)
- [x] 4.2 新增 `StackedSentimentArea` 组件:用 `d3.stack().keys(EMOTION_LABELS)` + `d3-shape.area()`;5 个 path 颜色映射 `EMOTION_COLORS`;x = 日期(d3-scale.scaleBand),y = 累计量(scaleLinear)
- [x] 4.3 hover/move 二分定位日期,React state 显示 tooltip(沿用 `PO_CHART_THEME.tooltipStyle`)
- [x] 4.4 移除原"本周舆情趋势"柱图与"情感分布"5 小环 panel;新 panel `data-span="8"`
- [x] 4.5 仍提供 `<ReferenceLine y={avg}>` 等价:在面积图上叠一条虚线 SVG line,标 `Avg N`

## 5. 新图 2 & 3:MediaSentimentPercentBar + HourlyMediaHeat

- [x] 5.1 新增 `MediaSentimentPercentBar` 组件:recharts `BarChart layout="vertical"`,5 个 `<Bar stackId="a">`,百分比换算;复用 `EMOTION_COLORS`;`data-span="4"`,与"今日平台分布"并列
- [x] 5.2 路由层归一化:从 `todayHourly` + `todayPlatformShare` 派生 `todayHourlyByMedia: [{media, hours: number[12]}]`;mock 数据稠密支持
- [x] 5.3 新增 `HourlyMediaHeat` 组件:SVG `<g>` 网格,N 行 × 12 列 `<rect>`,色 = `blueScale(count)`,字色 = `contrastTextOn(bg)`;键盘 Tab 可达 + hover title
- [x] 5.4 移除原"今日分时趋势"折线 panel;新 HourlyMediaHeat panel `data-span="8"`

## 6. 信息流升级(右侧 aside)

- [x] 6.1 信息流条数 15 → 30:`route.js` 中 latestNews 的 limit 改 30
- [x] 6.2 新增 `.po-feed-chips` 头部:全部 / 风险 / 各平台 chip,使用 v1 已有的 `.po-chip` 风格;chip 显示对应过滤后的条数
- [x] 6.3 前端过滤:`useMemo` 按 selected 过滤 latestNews(全部 / risk / 单平台)
- [x] 6.4 `.po-feed-item` 加左侧 3px 情感色条 `.po-feed-emo-bar`:背景 `EMOTION_COLORS[sentiment]`,无情感字段时回退 `#dcdfe6`
- [x] 6.5 `.po-feed-item.is-risk` 背景 `#fff1f0`,与 `po-tag.is-risk` 共存
- [x] 6.6 aside header 加 `.po-live-dot`:8px 圆点,绿色脉冲;mock 模式下置灰(显示"mock"提示)
- [x] 6.7 30s 轮询:`useInterval(30_000)` 调 `/api/public-opinion/overview?slice=latest`,只 setState 局部更新 latestNews;`document.visibilityState === 'hidden'` 时暂停;mock 模式不启动轮询
- [x] 6.8 aside 内 `overflow-y: auto`,scrollbar 风格沿用全局

## 7. 入场动画 / a11y / reduced-motion

- [x] 7.1 chip 与 feed item `:focus-visible` 可见;chip 用 `role="button"` + `aria-pressed`
- [x] 7.2 sparkline / StackedSentimentArea / HourlyMediaHeat 全部尊重 `prefers-reduced-motion: reduce`:无 path 描边、无 fade-in
- [x] 7.3 aside live-dot 在 reduced-motion 下不做脉冲,保持静态

## 8. 测试与守护

- [x] 8.1 新增 `apps/web/tests/public-opinion-sticky-feed-v2.test.js`:
  - 组件文件含 `po-overview-main` / `po-overview-aside` / `po-overview-grid` 类名
  - 含 `StackedSentimentArea` / `HourlyMediaHeat` / `MediaSentimentPercentBar` / `Sparkline` 组件定义或引用
  - 含信息流 chip 过滤、`.po-feed-emo-bar`、`is-risk`、`po-live-dot`
  - 含 30s 轮询逻辑(`setInterval` 或 `useInterval` 引用 + `30000` 或 `30_000`)
- [x] 8.2 新增 `apps/web/tests/public-opinion-overview-mock.test.js`:
  - route.js 含 `mock=1` query 解析与 `PUBLIC_OPINION_MOCK` env 检查
  - 含 `slice=latest` 分支
  - mock-payload.js 导出 `MOCK_PAYLOAD`,字段集合完整
- [x] 8.3 保留 v1 守护测试不回归:`public-opinion-bailian-restyle.test.js` / `public-opinion-densify.test.js`
- [x] 8.4 `npm run build` 通过(d3 子包 SSR 友好,Sparkline / StackedArea / HeatGrid 全是纯 SVG 无 window 依赖)
- [x] 8.5 人工 viewport 校验(1440 / 1280 / 1024):双列 / 单列塌回正确;aside sticky 工作;mock 数据稠密;轮询触发可在 DevTools Network 验证
- [x] 8.6 `openspec validate public-opinion-overview-sticky-feed-v2 --strict`

## 9. 实现前先验

- [x] 9.1 验证 `.po-dashboard` 当前是否为 scroll container(workbench-shell-ux 局部滚动契约)。若是,`.po-overview-aside` sticky 在其内部生效;若否,需调整 sticky 容器或 `.po-dashboard` 的 `overflow` 设置 — 记录验证结果到 design.md Risks
- [x] 9.2 验证 `useInterval` 是否已存在或需 inline 实现(查 `apps/web/src/hooks` 与 console-shell)
