## 1. 设计令牌与基础栅格

- [x] 1.1 `apps/web/app/globals.css` 调整 `.po-dashboard` 内 token:`--po-pad: 10px` / `--po-gap: 10px` / `--po-panel-radius: 8px` / `--po-title-size: 12px` / `--po-subtitle-size: 10.5px`
- [x] 1.2 验证 `.po-dashboard` 自身为滚动容器(`overflow-y: auto` 已存在);若上游 `ConsoleShell` 改为外部滚动,记录到 design.md Risks R1 并改回兼容方案
- [x] 1.3 新增辅助 token:`--po-band-label-size: 10.5px`、`--po-band-label-tracking: 0.06em`、`--po-tile-hover-bg: var(--color-bg-hover)`

## 2. KPI rail(取代 KpiBar + 预警 Panel)

- [x] 2.1 `apps/web/app/globals.css` 新增 `.po-rail`:`display: grid; grid-template-columns: repeat(3, minmax(0,1fr)) auto auto; gap: var(--po-gap); align-items: center; padding: 10px 12px; border-radius: var(--po-panel-radius); background: var(--color-bg);`,`grid-column: 1 / -1`
- [x] 2.2 新增 `.po-rail-mini`:第 4 槽,内含 7d 总量 sparkline(120×24)+ "近 7 天"小标签
- [x] 2.3 新增 `.po-alert-badge`:第 5 槽,三态(无/普通/重大)分别 `dot/badge--primary/badge--danger`,内联 SVG 图标 + 数字;`role="button"`、`aria-expanded`、`cursor-pointer`
- [x] 2.4 新增 `.po-alert-popover`:点击 badge 后向下展开,内含 `.po-wordcloud` 与 "重大预警 N / 预警总量 N" 两行;ESC 关闭、点击外部关闭(`useClickOutside` 或全局 click capture)
- [x] 2.5 `apps/web/components/public-opinion-overview-dashboard.jsx` 新增 `KpiRail({ kpis, weeklyPoints, warnings, error })`,接管原 `KpiBar` 三 tile + 新加 mini + alert badge;移除独立的 `预警概览` Panel
- [x] 2.6 KpiTile 复用现有结构,仅样式微调(`--po-pad` 10);sparkline 注入 `weeklyPoints` 与 `PO_CHART_THEME.primary`
- [x] 2.7 reduced-motion:sparkline 与徽标脉冲均跳过

## 3. Band 容器(分组带 + hairline + 标签)

- [x] 3.1 `apps/web/app/globals.css` 新增 `.po-band`:`display: block; padding: var(--po-pad) 0 0; position: relative;`,`::before` 渲染 `data-band-label` 属性值(JSX 改成 `aria-label` + 显式 `<span class="po-band-label">`,避免 attr() 兼容性问题)
- [x] 3.2 新增 `.po-band-label`:小写灰 `var(--color-text-secondary)`,12px 行高,`letter-spacing: 0.06em`,前置 1px 顶部 hairline(`border-top: 1px solid var(--color-divider)`),`padding-top: 6px`,`margin-bottom: 8px`
- [x] 3.3 新增 `.po-band-grid`:`display: grid; grid-template-columns: repeat(12, 1fr); gap: var(--po-gap);` 内部 `[data-span]` 选择器复用 1..12 整套(替代 v2 的 8 列)
- [x] 3.4 `apps/web/components/public-opinion-overview-dashboard.jsx` 新增 `function Band({ label, latin, children })`,渲染 `<section class="po-band" data-band={latin}><span class="po-band-label">{label} · {latin}</span><div class="po-band-grid">{children}</div></section>`
- [x] 3.5 重排主区为三个 `<Band>`:
  - `<Band label="态势" latin="trend">`:`<Tile data-span="12">情感×时间趋势</Tile>`、`<Tile data-span="12">今日分时×媒体</Tile>`
  - `<Band label="结构" latin="composition">`:`<Tile data-span="6">媒体×情感矩阵</Tile>`、`<Tile data-span="6">媒体×情感百分比</Tile>`、`<Tile data-span="12">情感分布</Tile>`
  - `<Band label="热点" latin="hot spots">`:`<Tile data-span="4">媒体来源占比</Tile>`、`<Tile data-span="4">Top 热门信息</Tile>`、`<Tile data-span="4">今日平台分布</Tile>`
- [x] 3.6 移除原 `.po-overview-grid` 顶层栅格(被三个 band 内部子栅格取代);loading 骨架同步改为三 band 占位形态

## 4. Tile(无边框图表槽)

- [x] 4.1 `apps/web/app/globals.css` 新增 `.po-tile`:`padding: 10px 12px; border-radius: var(--po-panel-radius); border: 0; background: transparent; transition: background 180ms ease;`
- [x] 4.2 hover:`.po-tile:hover { background: var(--po-tile-hover-bg); }`,**不移位、不加阴影**
- [x] 4.3 `.po-tile-head`:`display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px;` 标题 `font-size: var(--po-title-size); color: var(--color-title);`,副标题 `font-size: var(--po-subtitle-size); color: var(--color-text-secondary);`
- [x] 4.4 `apps/web/components/public-opinion-overview-dashboard.jsx` 修改 `function Panel(...)`:渲染外层从 `<section class="po-panel">` 切换到 `<div class="po-tile" data-span={span}>`,header 从 `.po-panel-head` 切换到 `.po-tile-head`(`<h3>` → `<span>` 标题,避免破坏外层 h2 语义)
- [x] 4.5 错误态 `.po-tile-state.is-error` 与空态 `.po-tile-state` 替代 `.po-panel-state`(保留旧规则,新规则同字体大小)
- [x] 4.6 reduced-motion:`.po-tile:hover` 的 `transition` 仅作用于 `background`,无 transform

## 5. aside 顶端对齐 rail

- [x] 5.1 `.po-overview-aside { top: 0; max-height: calc(100vh - 24px); }`(原 `top: 84px`)
- [x] 5.2 feed 顶部 padding 12px 维持不变;`.po-feed-head` 与 rail 内 KPI tile 顶部基线视觉对齐(1440 实测调整)
- [x] 5.3 验证 sticky 在 `.po-dashboard`(overflow-y: auto)内部 `top: 0` 行为:Chrome、Safari 17、Firefox 主流版本各跑一次
- [x] 5.4 ≤1280 单列塌:aside 回到底部 `position: static`,顶端对齐失效但符合预期

## 6. 字号节奏与移除冗余 panel

- [x] 6.1 字号回归 token 引用,移除 jsx 内硬编码;`Tile` head 内引用 `var(--po-title-size)` / `var(--po-subtitle-size)`
- [x] 6.2 删除组件 JSX 中的「`预警概览` Panel」并把派生 `warnings` 仅传给 `KpiRail`
- [x] 6.3 删除组件 JSX 中的「`情感分布` Panel 与「情感×时间趋势」并排的留白」结构,改为按 Band D2 排列

## 7. 测试与守护

- [x] 7.1 新增 `apps/web/tests/public-opinion-control-room-v3.test.js`:
  - 组件源文件含 `KpiRail` / `function Band` / `function Panel`(改造后)/ `.po-tile` / `.po-rail` / `.po-alert-badge` 标识
  - 组件源文件**不含**独立 `预警概览` Panel 渲染(`<Panel title="预警概览"` 不存在),改由 `KpiRail` 接管
  - 组件源文件含三个 `<Band>` 使用,且 `label` 集合等于 `['态势', '结构', '热点']`
  - 组件源文件含 `latin="trend"` / `latin="composition"` / `latin="hot spots"` 三个值
  - css 含 `.po-rail` / `.po-band` / `.po-band-label` / `.po-band-grid` / `.po-tile` / `.po-alert-badge` / `.po-alert-popover`
  - css 含 `.po-overview-aside` 块且声明 `top: 0`(允许同时存在历史 84px 注释)
- [x] 7.2 v1 / v2 守护测试不回归:
  - `apps/web/tests/public-opinion-densify.test.js` 与 `apps/web/tests/public-opinion-bailian-restyle.test.js` 仍通过(放宽断言:KPI tile / sparkline / 5 模态色板存在即可)
  - `apps/web/tests/public-opinion-sticky-feed-v2.test.js` 仍通过(双列布局、aside、StackedSentimentArea、HourlyMediaHeat、MediaSentimentPercentBar、feed chip 过滤、30s 轮询)
  - `apps/web/tests/public-opinion-overview-mock.test.js` 仍通过(mock 开关、slice=latest)
- [x] 7.3 `npm run build` 通过;SSR 友好(Band / KpiRail / AlertBadge 全是 React 纯组件,无 window 访问)
- [x] 7.4 1440 / 1280 / 1024 viewport 实测:
  - 1440:首屏可视 ≥ 9 模块,顶部无 ≥ 100px 真空带,aside feed 顶部与 KPI rail 顶部对齐(差值 ≤ 8px)
  - 1280:阈值塌单列,aside 在底部,顶部 rail 仍存在
  - 1024:band 内部 12 列在 768 断点全塌单列(沿用 v2 1080 断点规则)
- [x] 7.5 `openspec validate restyle-overview-control-room-v3 --strict`

## 8. 验收

- [x] 8.1 与原始截图(2026-06-24)对比:
  - 顶部留白消失(由 KPI rail 撑满)
  - 「预警概览」右侧空位消失(媒体来源占比迁入 / 预警进入 rail)
  - 卡片审美疲劳消失(11 个白卡 → 3 个 band + 无外框 tile)
- [x] 8.2 截图归档到 `docs/` 或 PR 描述:1440 改造前 vs 改造后
- [x] 8.3 reduced-motion 偏好下:rail sparkline 静态、alert badge 不脉冲、tile hover 仅背景切换无动画

## 9. 实现前先验

- [x] 9.1 验证 `.po-dashboard` 仍是 sticky 参考容器(`overflow-y: auto` 未被外层覆盖);Chrome devtools `position: sticky` "Sticking" 状态可见
- [x] 9.2 验证 ConsoleShell topbar 是否与 `.po-dashboard` 同滚动容器:若 topbar 是外层 fixed,rail `top: 0` 不会被遮;若 topbar 在 .po-dashboard 滚动容器内随滚,rail 需额外 `top: <topbar height>`
- [x] 9.3 验证现有快照测试(若存在 `.po-panel` 类名快照)需要更新的范围;若存在则在 7.1 测试用例中预先适配
