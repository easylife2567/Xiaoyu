## Why

v2「sticky-feed」已把信息流移到右侧常驻,但当前线上界面(2026-06-24 截图)仍有三处显著的「卡片化」结构性问题:

1. **顶部大留白**:KPI 横向条只放在左半幅顶部,右侧 sticky 信息流的 `top: 84px` 让它从中段才开始,造成右上角约 1/4 视口的空白区。
2. **预警概览右半空**:`预警概览` 与一个不存在的卡片(空格子)并排,占满 8 列却只用 4 列内容,产生「半空」感。
3. **卡片审美疲劳**:11 个面板每一个都是「白底 + 1px 边 + 圆角 10 + 12px padding + 标题杠 + 副标题」,视觉密度反而被「外框装饰」吃掉,信息层级丢失——所有图表看起来都同等重要。

参照 ui-ux-pro-max 的「Data-Dense Dashboard」与「Real-Time Monitoring」风格指引(`--card-padding: 12px`、minimal padding、ruled sections、KPI rail),把"卡片网格"重构为"控制台分区":强分区用细横线 + 区组小写标签,弱分区用栅格留白本身;只保留 KPI rail 与右侧 feed 两块「真容器」,中间所有图表共享一块连续画布。

## What Changes

- **顶部 KPI 与状态条整合为单条 rail**:KPI 三格 + 一条 mini「态势条」(7d 总量 sparkline + 当前情感占比微条)横向占满 12 列,**右侧 aside 改成与 KPI rail 同高 `top: 0`(沿 .po-dashboard 内部坐标)**,信息流头部对齐 KPI rail 顶部,消除右上留白。
- **去卡片化(ruled sections)**:中间分析区从「11 张白卡」改为 **3 个分组带(band)**:`态势 (Trend)` / `结构 (Composition)` / `热点 (Hot Spots)`,每个 band 由一行小写灰标签 + 一条 1px 顶部分隔横线引导,band 内部图表无独立外框,只用栅格分列;hover 时单图浮起一层极浅底色而非边框。
- **预警从面板升级为「态势条」徽标**:`预警总量 / 重大预警` 不再是 4-列卡片,而是 KPI rail 末端的徽标点(0 时静默 dot,>0 时红色徽标 + 数字),点击展开关键词云抽屉;**`媒体来源占比` 接管原预警占位的 4 列**,与「Top 热门信息」「情感分布」组成「热点 band」,该 band 自然填满 12 列。
- **媒体×情感矩阵与情感堆叠面积合并为一组「双轴并排」**:同属 `结构` band 的两张图共用一根 y 轴标签轴(媒体清单),阅读时只需扫一次媒体行;高度统一,栅格 8+4 改为 6+6 等高并排。
- **典型字号下调一档**:面板标题 13→12px、副标题 11→10.5px,卡间隙 12→10px;在 1440 视口下整页可视模块数从 6 提升到 9。
- **配色不变 / 数据接入不变**:沿用 `--color-primary` 蓝 + 5 模态情感色;不引入新依赖、不动 BFF;mock 与 30s 轮询行为保留。

## Capabilities

### Modified Capabilities

- `public-opinion-dashboard`:看板视觉范式从「卡片网格」改为「ruled-section 控制台」;顶栏整合为 KPI rail(含预警徽标与态势 mini);中部图表去外框、按 3 个语义 band 分组;`媒体来源占比` 进入「热点 band」消除预警旁的空位。
- `public-opinion-overview`:看板渲染态保留(导航/路由/占位契约不变),仅视觉呈现升级。

## Impact

- **修改** `apps/web/components/public-opinion-overview-dashboard.jsx`:
  - 引入 `KpiRail`(KPI 三格 + 态势 mini + 预警徽标),取代独立 `KpiBar` 与 `预警概览` Panel
  - 引入 `Band` 组件(小写灰标签 + 1px hairline + 子栅格槽),取代各处 `Panel` 外框
  - 重排 `Panel` 容器:态势 band(情感×时间趋势 / 今日分时×媒体)、结构 band(媒体×情感矩阵 / 媒体×情感百分比 / 情感分布)、热点 band(媒体来源占比 / Top 热门信息 / 今日平台分布)
  - aside `top` 与 KPI rail 同步对齐(`top` 由 `84px → 与 .po-overview-main 顶端对齐`)
- **修改** `apps/web/app/globals.css`:
  - 新增 `.po-rail`(KPI 横条容器,内部 grid 5 槽:3 KPI + 1 mini-trend + 1 alert-badge)
  - 新增 `.po-band`(分组容器:`::before` 渲染小写标签 + 1px 顶部 hairline,inner `.po-band-grid` 是 12 列子栅格)
  - 新增 `.po-tile`(无边框图表槽,hover 时 `background: var(--color-bg-hover)`,圆角 8,padding 10)
  - 调整 `.po-overview-aside { top: 60px; max-height: calc(100vh - 72px) }`,与 rail 底对齐
  - 弃用(保留向后兼容,但新结构不使用):`.po-panel-head` 边框线、`.po-panel` 外框
- **修改** `apps/web/src/public-opinion/overview.js`(若需要):为预警徽标提供精简派生 `warningBadge: { total, major, severity }`,不影响现有 `warnings` 字段
- **新增守护测试** `apps/web/tests/public-opinion-control-room-v3.test.js`:
  - 断言组件包含 `KpiRail` 与 `Band`,且 `Band` 标签集合等于 `['态势', '结构', '热点']`
  - 断言不再渲染独立 `预警概览` Panel(改为 rail 中的 `.po-alert-badge`)
  - 断言 `.po-overview-aside` 与 KPI rail 在同一 `top` 锚点(CSS 中 `.po-overview-aside { top: 60px` 或 css var 同值)
  - 断言至少 3 个 `.po-tile`(去外框图表槽)且 v2 守护测试仍通过
- **不影响**:BFF 接入、数据归一化、mock 开关、30s 轮询、ConsoleShell、其他页面、5 模态情感语义色板

## Open Questions

- 「预警徽标」点击行为:抽屉展开关键词云 vs. 直接跳预警子页面?→ 当前无预警子页路由,先做「点击切换徽标自身展开/折叠的内联关键词云」,与 v2 已有 `.po-wordcloud` 复用样式。
- 「band 标签」是否使用全大写英文(`TREND / COMPOSITION / HOT SPOTS`)以更贴控制台审美?→ 默认中文小写灰标签,保留可通过 i18n 替换的语义类名 `data-band="trend|composition|hot"`。
- aside `top` 是否仍需 84px 留给浮动 topbar?→ 经实测 ConsoleShell topbar 高度 56px;`.po-dashboard` 自身已是滚动容器,aside `top` 改为相对滚动容器(`top: 0`)即可与 rail 顶对齐;tasks 9.1 先验。
