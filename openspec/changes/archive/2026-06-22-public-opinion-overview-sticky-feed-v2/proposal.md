## Why

[v1 密度化](../archive/2026-06-22-densify-overview-dashboard)已将看板从 4–5 个/屏提升至 6–7 个/屏,但信息架构仍为"单列流式下滑"——底部「最新舆情信息流」永远在视口外,需要翻页才能看到。实际使用中,舆情信息流是看板最高频查看的模块,却因位置原因关注度最低。

参考「Datadog / Splunk 监控控制台」模式:右侧固定一个常驻实时流面板,左侧是分析图表区域。这样信息流始终可视,滚动只在左侧分析区发生,右侧流自管自滚,整体阅读动线从「Z 形下滑」变为「左分析→右流」,舆情监控的体感从"翻报告"变成"控制台"。

本次在 v1 密度化基础上叠加:① 右侧 sticky 信息流常驻 ② 左侧再压缩并补 3–4 张高信息密度图 ③ 开发环境 mock 数据(解决线上数据偏稀疏、新图调参难的问题)。

## What Changes

- **布局架构**:从「.po-grid-12 全宽流式」→「.po-dashboard 拆左 main(8 列)+ 右 aside(4 列 sticky)」。信息流常驻右侧,aside 内部独立滚动;≤1280 自动塌回底部单列。
- **左侧再压缩**:KPI 卡加内嵌 sparkline(不增高度);栅格从 12 列细分化到左 8 列内部自由组合;面板 padding 从 16→12,卡间隙从 16→12,整体高度再压 ~20%。
- **新图 4 张(全部 d3 + recharts,无新依赖)**:
  1. `StackedSentimentArea`(情感堆叠面积时序,7d×5 情感):一张图替掉 v1 的「本周趋势柱 + 情感 5 小环」,信息密度 ×2
  2. `MediaSentimentPercentBar`(媒体×情感 100% 堆叠条):补充 v1 热力矩阵的百分比维度
  3. `HourlyMediaHeat`(今日分时×媒体小热力,24 格 × N 媒体):替掉 v1 单调的今日分时折线
  4. `Sparkline`(内嵌 KPI 卡的 30px 趋势线):零占地密度提升
- **信息流升级**:条数 15→30;顶部情感/平台 chip 过滤(前端);左侧 3px 情感色条;risk 整条淡红高亮;30s 轮询只拉流分段(后端新增 `?slice=latest`)。
- **开发环境 mock**:`/api/public-opinion/overview?mock=1` 或 `PUBLIC_OPINION_MOCK=1` 开关,返回丰满版数据(5+ 媒体、7d 均匀分布、30 条流)。零侵入生产、不污染真实接口逻辑,本地调样式、测密度、跑快照都能跑。

## Capabilities

### Modified Capabilities

- `public-opinion-dashboard`:信息架构升级为「左分析区 + 右流区」双列控制台;新增 4 张高信息密度图(堆叠面积时序、百分比堆叠条、分时×媒体小热力、KPI 内嵌 sparkline);信息流变为 sticky 常驻并支持过滤/高亮/30s 轮询;新增开发 mock 数据开关。

### New Capabilities

- `public-opinion-overview:mock`:看板支持开发环境 mock 数据(URL query 或 env 开关),丰满数据用于调样式、跑测试、演示。

## Impact

- **新增** `apps/web/src/public-opinion/mock-payload.js`:丰满版 mock 数据(5+ 媒体、情感均匀分布、30 条流)
- **修改** `apps/web/components/public-opinion-overview-dashboard.jsx`:拆左 main + 右 aside sticky;KpiTile 加 sparkline 插槽;4 张新图组件;信息流 chip 过滤 + 30s 轮询;fetch 支持 `?mock=1` 与 `?slice=latest`
- **修改** `apps/web/app/globals.css`:`.po-overview-main` / `.po-overview-aside` 双列 sticky 布局;`.po-overview-grid` 左 8 列细分;`.po-feed-chip` 过滤条 + `.po-feed-item` 情感色条;中等密度 padding/gap 档位
- **修改** `apps/web/app/api/public-opinion/overview/route.js`:支持 `mock=1` query 与 env 开关直接返回 mock;支持 `slice=latest` 只拉流分段
- **新增守护测试** `apps/web/tests/public-opinion-sticky-feed-v2.test.js`:断言双列布局、4 张新图、aside sticky、信息流过滤、mock 分支、轮询存在
- **不影响**:生产环境数据逻辑、BFF 鉴权与会话、shell、其他页面、v1 已落地的密度化特性

## Open Questions

- ✅ 侧栏采用页面内固定列(不摸 ConsoleShell)
- ✅ 密度档位:中等(12px pad,卡间隙 12px,KPI 内嵌 sparkline)
- ✅ 图表库:继续 recharts + 自定义 d3(无 echarts 引入)
- ✅ 信息流增强:全部(过滤/色条/30s 轮询/30 条)
- ✅ mock 方式:后端开关 + URL query(生产零侵入)
- 信息流 30s 轮询在 mock 开启时是否关闭?→ 默认关闭,避免无意义请求
