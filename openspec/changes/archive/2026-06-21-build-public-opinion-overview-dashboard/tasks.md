## 1. 探针:获取真实响应结构 ✅(已完成)

- [x] 1.1 取得 base URL 与服务账号凭据(`15666073269`,已配置于根 `.env.local`)
- [x] 1.2 探针确认:传输为 `application/x-www-form-urlencoded`;鉴权为会话式(`login`→`ASP.NET_SessionId`+`token`,数据请求同时带会话与 token);信封 `{code,data,message}`,`code:2`=失败
- [x] 1.3 抓取 8 个 overView 接口真实响应结构(getDayNumber/getWeekNumber/getOneDayAllInfoNumber/getTrendByTodayAndYestoday/getModMediaNumberByTime/getModTrendByTime/getEachMediaNumber/getSpanTimeTop10MediaInfo)
- [x] 1.4 确认情感 5 模态标签:正面 / 偏正面 / 中立 / 偏负面 / 负面;`MinuteHourDayMonth`/`SpanNumber` 为整数

## 2. 接入层与归一化层(server-only)

- [x] 2.1 新增 `apps/web/src/public-opinion/asmx-client.js`:表单编码 POST、模块级会话缓存、`ensureSession()` 自动 `login`、鉴权失败自动重登一次重试、解析 `{code,data,message}` 信封、超时(默认 10s)
- [x] 2.2 新增 `apps/web/src/public-opinion/config.js`:经 `runtime-env` 读取 `PUBLIC_OPINION_API_BASE` / `PUBLIC_OPINION_API_USERNAME` / `PUBLIC_OPINION_API_PASSWORD`,提供 `isConfigured()`
- [x] 2.3 新增 `apps/web/src/public-opinion/overview.js` 归一化函数:`getKpis` / `getWeeklyTrend` / `getSentimentDistribution` / `getMediaShare` / `getTopHotNews`(趋势改用 getWeekNumber);5 模态固定顺序;时间按今天+近7天推算
- [x] 2.4 归一化层单测(`tests/public-opinion-overview.test.js`):以真实响应样例为输入,断言每个函数输出符合 DTO 契约(含 5 模态映射)+ aggregateOverview 降级

## 3. BFF 聚合路由

- [x] 3.1 新增 `apps/web/app/api/public-opinion/overview/route.js`:`GET`,未配置时返回 `{ configured: false }`(HTTP 200)
- [x] 3.2 已配置时经 `aggregateOverview` 用 `Promise.allSettled` 并行调归一化函数,合并负载,失败块置 null 并记入 `errors`
- [x] 3.3 BFF 路由测试(`tests/public-opinion-route.test.js`)覆盖未配置降级;聚合+单组件降级由 aggregateOverview 单测覆盖

## 4. 看板组件与页面接入

- [x] 4.1 `apps/web/package.json` 新增 `recharts`(3.8.x,React 19 兼容)
- [x] 4.2 新增 `apps/web/components/public-opinion-overview-dashboard.jsx`(`'use client'`):KPI 卡 ×3、本周趋势(折线)、情感分布(5 模态环形饼)、媒体占比(横向条形)、Top 热文榜;`ResponsiveContainer`
- [x] 4.3 实现加载骨架、单组件空/错态、`configured:false` 时「未配置」态
- [x] 4.4 在 globals.css 新增看板栅格/卡片/骨架样式,复用 `.console-section`
- [x] 4.5 修改 `apps/web/app/public-opinion/page.jsx`:正文替换为 `<PublicOpinionOverviewDashboard />`

## 5. 测试与验证

- [x] 5.1 看板加载骨架经 SSR 测试覆盖(nav 测试断言 `po-dashboard`);数据/错/空态由数据层(aggregateOverview)与路由测试覆盖
- [x] 5.2 更新 `tests/public-opinion-nav.test.js`:总览页断言改为看板容器、不再「功能建设中」;其余 5 占位页断言保持
- [x] 5.3 全量 `npm test` 110/110 通过,无回归
- [x] 5.4 对真实 API 端到端验证:自动登录 → 5 widget 全部出数(本周 67、情感 1/8/21/4/0、媒体 Twitter18/谷歌16、热文)

## 6. 配置与收尾

- [x] 6.1 README 与 `.env.example` 登记 `PUBLIC_OPINION_API_BASE` / `PUBLIC_OPINION_API_USERNAME` / `PUBLIC_OPINION_API_PASSWORD`
- [x] 6.2 运行 `openspec validate build-public-opinion-overview-dashboard --strict`
- [x] 6.3 自检:非目标(其余 5 页、日期选择器、落库、原两个趋势接口、token 续期)未被夹带实现

## 7. 信息密度扩展(+5 模块,同一变更增量)

- [x] 7.1 探针验证候选接口:getDayNumber(分时)/ getSpanTimeMediaInfo(信息流)/ getModMediaNumberByTime(矩阵)/ getOneDayAllInfoNumber(平台)/ getYujing+getYujingZhongda(预警)均可靠出数
- [x] 7.2 新增归一化函数:`getTodayHourly` / `getMediaSentimentMatrix` / `getTodayPlatformShare` / `getWarnings` / `getLatestNews`,并纳入 `OVERVIEW_WIDGETS`(聚合自动包含)
- [x] 7.3 看板组件新增 5 个模块:今日分时趋势(折线)、媒体×情感矩阵(5 模态堆叠条形,wide)、今日平台分布(条形)、预警概览(量卡+高频词)、最新舆情信息流(列表,wide);宽模块 `po-panel--wide` 跨列
- [x] 7.4 globals.css 新增 wide 跨列、预警卡、高频词、信息流样式;`.po-dashboard` 局部滚动承载更多模块
- [x] 7.5 扩展归一化单测覆盖 5 个新函数 + 空预警优雅降级;aggregateOverview 断言全部 10 模块;全量 116/116 通过
- [x] 7.6 真实 API 端到端:10 模块全部出数(分时 12 桶、矩阵 2 平台、信息流 15 条、预警空态)
