# public-opinion-dashboard Specification

## Purpose
TBD - created by archiving change build-public-opinion-overview-dashboard. Update Purpose after archive.
## Requirements
### Requirement: 舆情数据经服务端 BFF 接入,凭据不暴露于浏览器

系统 SHALL 通过服务端 BFF 路由访问 legacy 舆情 ASMX 服务,浏览器 SHALL NOT 直接请求 ASMX,也 SHALL NOT 接触访问凭据或会话。原系统为会话式鉴权:须先以服务账号 `login` 取得 `ASP.NET_SessionId` 会话与 `token`,后续数据请求同时携带会话与 token。BFF SHALL 从服务端运行时配置读取 ASMX base URL 与服务账号凭据,在服务端维护登录会话,代浏览器发起请求并返回归一化后的数据。会话失效时 BFF SHALL 自动重新登录后重试。

#### Scenario: 浏览器加载舆情总览看板

- **WHEN** 用户打开舆情总览页,看板组件请求数据
- **THEN** 看板 SHALL 仅请求本应用的 `/api/public-opinion/overview`,而非直接请求 ASMX
- **AND** 服务账号凭据与会话 SHALL 仅存在于服务端,不出现在任何浏览器可见的响应或网络请求中

#### Scenario: 会话过期后自动重登

- **WHEN** 已缓存的会话过期,某数据请求因鉴权失败被拒
- **THEN** BFF SHALL 自动以服务账号重新登录获取新会话,并重试该请求
- **AND** 该自动重登对浏览器透明,不要求用户重新操作

#### Scenario: ASMX 以表单编码与 {code,data,message} 信封交互

- **WHEN** BFF 调用 ASMX 接口
- **THEN** 请求 SHALL 以 `application/x-www-form-urlencoded` 发送(JSON content-type 会被 .NET 拒绝)
- **AND** 接入层 SHALL 解析 `{ code, data, message }` 信封,`code` 非成功值时按失败处理

### Requirement: 原始 ASMX 响应经归一化层映射为稳定 DTO

系统 SHALL 设置一个归一化层,将每个 `overView` 接口的原始响应映射为稳定的内部 DTO。看板组件 SHALL 只消费 DTO,SHALL NOT 依赖 ASMX 原始字段名。当 legacy 响应结构变化时,SHALL 仅需修改归一化层而无需改动 BFF 路由与看板组件。

#### Scenario: 情感分布接口返回模态编码

- **WHEN** `getModMediaNumberByTime` 返回 legacy 情感模态编码
- **THEN** 归一化层 SHALL 将其映射为 `{ positive, neutral, negative }` 三个数值字段
- **AND** 看板情感分布组件 SHALL 仅依据该 DTO 渲染,不感知 legacy 编码

#### Scenario: 概况指标来自多个接口

- **WHEN** 看板需要今日量、本周量、当日信息量
- **THEN** 归一化层 SHALL 分别调用 `getDayNumber` / `getWeekNumber` / `getOneDayAllInfoNumber` 并合并为 `{ todayCount, weekCount, todayInfoCount }`

### Requirement: BFF 聚合返回看板数据且单组件可独立降级

系统 SHALL 提供聚合路由 `GET /api/public-opinion/overview`,在服务端并行调用各归一化函数并合并为单一看板数据负载,负载包含概况、今日vs昨日趋势、情感分布、情感趋势、媒体占比、Top10 媒体各数据块。任一接口失败 SHALL NOT 导致整页失败——失败块 SHALL 置空并在 `errors` 中记录原因,其余块照常返回。

#### Scenario: 全部接口成功

- **WHEN** 所有上游接口返回成功
- **THEN** 路由 SHALL 返回包含全部 6 个数据块的负载
- **AND** `errors` SHALL 为空

#### Scenario: 单个上游接口失败

- **WHEN** 仅情感趋势接口失败,其余成功
- **THEN** 路由 SHALL 仍返回 200 且包含其余 5 块数据
- **AND** 情感趋势数据块 SHALL 为 null,`errors` SHALL 记录该块失败原因
- **AND** 看板 SHALL 在情感趋势组件位置呈现错态,其余组件正常渲染

### Requirement: 缺少运行时配置时优雅降级为「未配置」态

系统 SHALL 在 ASMX base URL 或 token 未配置时,使 BFF 返回明确的未配置标识而非抛出服务端错误。看板 SHALL 据此呈现「请配置舆情接口」提示而非崩溃或空白。

#### Scenario: 开发环境未设置舆情接口 env

- **WHEN** `PUBLIC_OPINION_API_BASE` / `PUBLIC_OPINION_API_USERNAME` / `PUBLIC_OPINION_API_PASSWORD` 任一未配置,用户打开舆情总览
- **THEN** BFF SHALL 返回 `configured: false` 标识(HTTP 200,非 500)
- **AND** 看板 SHALL 渲染「未配置」提示,并仍展示页面布局骨架
- **AND** 系统 SHALL NOT 因缺配置而抛出未捕获错误

### Requirement: 舆情总览看板呈现概况、情感、媒体、信息流多层模块

系统 SHALL 在舆情总览页以图表与列表呈现多层洞察:概况层(今日量 / 本周量 / 当日信息量关键指标 + 本周趋势 + 今日分时趋势)、情感层(情感分布 + 媒体×情感矩阵)、媒体层(媒体来源占比 + 今日平台分布)、信息层(Top 热门信息 + 最新舆情信息流 + 预警概览)。主体内容区 SHALL 在内容超出视口高度时于自身容器内纵向滚动(遵循 `workbench-shell-ux` 局部滚动契约),而非整页或 shell 滚动。数据加载期间 SHALL 呈现骨架占位;某数据块为空或失败时,SHALL 在对应模块位置呈现空/错态而非影响其他模块。v1 数据窗口:关键指标与分时为「今天」,其余模块为「近 7 天」。

#### Scenario: 看板成功加载

- **WHEN** 用户打开已配置接口的舆情总览页且数据加载成功
- **THEN** 看板 SHALL 展示今日/本周/当日信息量关键指标卡
- **AND** SHALL 展示本周趋势、今日分时趋势、情感分布、媒体×情感矩阵、媒体来源占比、今日平台分布、Top 热门信息、最新舆情信息流与预警概览各模块

#### Scenario: 内容超出视口高度

- **WHEN** 看板模块总高度超过主体内容区高度
- **THEN** 主体内容区 SHALL 在自身容器内纵向滚动以展示更多模块
- **AND** topbar 与 sidebar SHALL 保持可见(遵循 `workbench-shell-ux` 契约)

#### Scenario: 数据加载中

- **WHEN** 看板数据请求尚未返回
- **THEN** 各模块位置 SHALL 呈现骨架占位,而非空白或布局跳变

#### Scenario: 某数据块为空或失败

- **WHEN** 某模块对应的数据块为空(无数据)或加载失败
- **THEN** 该模块 SHALL 呈现空/错态提示
- **AND** 其余有数据的模块 SHALL 正常渲染

