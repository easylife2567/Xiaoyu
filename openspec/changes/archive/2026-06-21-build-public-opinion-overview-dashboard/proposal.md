## Why

「舆情速览」模块的导航与占位页已由 [add-public-opinion-overview-nav](../archive/2026-06-20-add-public-opinion-overview-nav/proposal.md) 立起,但 6 个页面全是「功能建设中」空状态,**没有任何真实数据**。系统里也不存在舆情/情感数据模型——舆情数据来自一套既有的 legacy .NET ASMX 服务(`/yuqing-Toolkits-New/jsonNew.asmx/`,见根目录 `NPOL_接口梳理_副本.xlsx`),其中 `overView` 模块的一组接口正好覆盖总览看板所需的全部维度。

本次把「舆情总览」从占位页升级为**真实数据看板**:打通 ASMX 接入,呈现概况指标、情感分布与媒体来源三层洞察。这是舆情速览模块第一个接真实数据的页面,确立后续各舆情页面复用的接入范式(BFF 代理 + 归一化层 + 图表)。

## What Changes

- 新增**舆情 ASMX 接入层**(仅服务端):统一的 client 封装 base URL / 服务账号自动登录与会话维护 / 表单编码请求 / `{code,data,message}` 信封解析 / 超时与错误处理,是全系统唯一直连 legacy 接口的位置。
- 新增**归一化层**:把 8 个 `overView` 接口的原始响应映射为稳定内部 DTO。响应字段映射集中在此一处,屏蔽 legacy 接口结构对上游的影响。
- 新增 **BFF 聚合路由** `GET /api/public-opinion/overview`:服务端并行调用各接口、合并为一份看板数据;**每个 widget 数据块独立可空**,单接口失败只降级该组件而非白屏整页。
- 新增**舆情总览看板组件**(`'use client'`),用 recharts 渲染多模块:关键指标卡 ×3(今日量 / 本周量 / 当日信息量)、本周趋势(折线)、今日分时趋势(折线)、情感分布(5 模态环形饼)、媒体×情感矩阵(堆叠条形)、媒体来源占比(条形)、今日平台分布(条形)、Top 热门信息(榜单)、最新舆情信息流(列表)、预警概览(量卡+高频词)。主体内容区局部滚动承载更多模块;含骨架屏与单模块空/错态。
- 修改 `app/public-opinion/page.jsx`:正文由「功能建设中」占位替换为看板组件(路由 / slug / shell 不变)。
- 新增运行时配置 `PUBLIC_OPINION_API_BASE` / `PUBLIC_OPINION_API_USERNAME` / `PUBLIC_OPINION_API_PASSWORD`(服务账号凭据,沿用 `runtime-configuration` 范式);**未配置时看板呈现明确的「未配置」态**,保证无凭据开发机可跑通布局。
- 引入前端依赖 **recharts**(项目首个图表库;React 19 兼容)。
- v1 时间窗口固定为「今天」(服务端推算 start/end/oneday/day);日期选择器留作后续。

## Capabilities

### New Capabilities

- `public-opinion-dashboard`:舆情数据看板的接入与呈现契约——legacy ASMX 接入层(服务账号自动登录会话)、响应归一化、BFF 聚合与单组件降级、凭据配置与「未配置」降级、舆情总览 v1 的概况/情感/媒体三层组件。后续其余舆情页面(正负面 / 趋势 / 情感分析)接入真实数据时复用此 capability 的接入范式。

### Modified Capabilities

- `public-opinion-overview`:将「每个舆情导航条目落到占位页」要求收窄——**已交付真实能力的条目(舆情总览)呈现真实内容而非占位**,其余未交付条目继续保持占位;路由 / slug / shell 内渲染等导航契约不变。

## Impact

- 新增 `apps/web/src/public-opinion/asmx-client.js`(ASMX 接入层)、`apps/web/src/public-opinion/overview.js`(归一化层)。
- 新增 BFF 路由 [apps/web/app/api/public-opinion/overview/route.js](../../../apps/web/app/api/)。
- 新增 `apps/web/components/public-opinion-overview-dashboard.jsx`(看板组件)。
- 修改 [apps/web/app/public-opinion/page.jsx](../../../apps/web/app/public-opinion/page.jsx):接入看板组件。
- 修改 [apps/web/package.json](../../../apps/web/package.json):新增 `recharts` 依赖。
- 修改运行时配置(env 约定):新增 `PUBLIC_OPINION_API_BASE` / `PUBLIC_OPINION_API_USERNAME` / `PUBLIC_OPINION_API_PASSWORD`。
- 修改 [apps/web/tests/public-opinion-nav.test.js](../../../apps/web/tests/public-opinion-nav.test.js):总览页不再断言「功能建设中」(改为断言看板容器);其余 5 个占位页断言不变。
- 新增测试:归一化层映射、BFF 聚合 + 降级、看板组件结构。
- 新增 [openspec/specs/public-opinion-dashboard/spec.md](../../specs/);修订 [openspec/specs/public-opinion-overview/spec.md](../../specs/public-opinion-overview/)。
- **不影响**:翻译 / 日报业务逻辑、候选池、Prisma schema(看板不落库,直连 ASMX)、其余 5 个舆情占位页。
- **非目标**:正负面 / 趋势 / 情感分析等其余舆情页面的真实接入;日期范围选择器(窗口固定今天/近7天);看板数据的本地缓存 / 落库;token 自动续期(会话过期靠自动重登)。

## 已解决(探针确认)

- base URL = `https://mcc.cuc.edu.cn/yuqing-Toolkits-New/jsonNew.asmx/`。
- 鉴权为会话式:服务端以 `login(userName,passWord)` 取 `ASP.NET_SessionId` + `token`,数据请求同时带会话与 token,会话约 20 分钟过期 → BFF 自动重登。配置改为服务账号凭据(见上)。
- 8 个 overView 接口真实响应结构已抓取;情感为 5 模态:`正面 / 偏正面 / 中立 / 偏负面 / 负面`。传输为 `application/x-www-form-urlencoded`,信封 `{code,data,message}`。

## Open Questions / 实现期依赖

- 服务账号凭据由使用方配置于 `.env.local`(已配置 `15666073269`)。
- 趋势接口的时间粒度(`MinuteHourDayMonth`,整数)与跨度(`SpanNumber`)对"今天"视图的最优取值——实现期据真实数据观感微调。
- 需确认部署环境到 `mcc.cuc.edu.cn` 的网络可达性(本地探针已通)。
