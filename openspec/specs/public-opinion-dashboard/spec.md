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

### Requirement: 舆情看板视觉遵循企业控制台(百炼)设计令牌体系

舆情总览看板 SHALL 遵循与 console-shell 同一套应用级设计令牌(对齐阿里云百炼 / Model Studio 设计语言)。KPI 磁贴、卡片 chrome、图表与状态视觉 SHALL 引用集中令牌而非硬编码。数值 SHALL 使用等宽数字(tabular-nums)。视觉改造 SHALL NOT 改变数据接入、归一化、聚合、降级或模块构成。

#### Scenario: KPI 磁贴呈现高信息密度指标卡

- **WHEN** 关键指标(今日量 / 本周量 / 当日信息量)渲染
- **THEN** 每张磁贴 SHALL 含标签、大号等宽数字与轻量描边图标(非 emoji)
- **AND** 磁贴 SHALL 使用令牌定义的底色、圆角、阴影,并在 hover 时反馈

#### Scenario: 图表使用统一主题与情感语义色

- **WHEN** 任一图表渲染
- **THEN** 图表 SHALL 使用统一主题(主色、分类色板、网格、坐标轴、tooltip)
- **AND** 情感相关图表 SHALL 保留语义色序(正面绿 → 负面红),不套用通用分类色

#### Scenario: 加载/空/错态视觉一致

- **WHEN** 模块处于加载 / 空 / 错态
- **THEN** 加载 SHALL 呈现与卡片同尺寸圆角的骨架且不引起布局跳变
- **AND** 空/错态 SHALL 使用令牌色与描边图标

#### Scenario: 数据行为不受视觉改造影响

- **WHEN** 视觉改造完成后看板加载
- **THEN** 各模块数据来源、归一化、BFF 聚合与单模块降级 SHALL 与改造前一致
- **AND** 模块构成 SHALL 不增不减

### Requirement: 看板采用高密度信息惯用语呈现

舆情总览看板 SHALL 以高信息密度的"控制台分区(banded sections)"形态呈现:1440×900 视口下前 9 个模块 SHALL 单屏可见(不依赖下滑)。看板顶部 SHALL 为「KPI rail」:横向 5 槽容器,包含 3 张 KPI tile、1 条 7d 态势 mini-sparkline、1 个预警徽标(alert badge),占满 12 列宽度,自身高度 ≤ 80px。看板中部分析区 SHALL 划分为三个语义 band:`态势 (trend)`、`结构 (composition)`、`热点 (hot spots)`,每个 band 由小写灰标签 + 1px 顶部 hairline 引导,band 内部图表槽(tile)SHALL 无独立边框、仅靠栅格留白与 hover 浅底色区分。视觉风格 SHALL 沿用既有令牌(主色 `--color-primary` 蓝、5 模态情感语义色),不引入新色板。

#### Scenario: 1440×900 视口下顶端无大幅留白

- **WHEN** 看板在 1440×900 视口加载完成
- **THEN** 顶部 KPI rail SHALL 横向占满主分析区可视宽度(`grid-column: 1 / -1`)
- **AND** 右侧 sticky 信息流头部 SHALL 与 KPI rail 顶部基线对齐(垂直差值 ≤ 8px)
- **AND** 顶部不存在高度 ≥ 100px 的连续空白带

#### Scenario: 中部分析区按 3 个 band 分组

- **WHEN** 看板中部分析区渲染
- **THEN** SHALL 渲染恰好 3 个 `<section class="po-band">`
- **AND** 三个 band 的语义标签 SHALL 分别为「态势 · trend」「结构 · composition」「热点 · hot spots」
- **AND** 每个 band 顶部 SHALL 有 1px hairline 与小写灰标签
- **AND** band 内部图表 SHALL 渲染为 `.po-tile`(无边框、无外阴影)

#### Scenario: 图表 tile 鼠标悬停反馈

- **WHEN** 用户鼠标悬停在任一 `.po-tile` 上
- **THEN** tile 背景 SHALL 切换为 `var(--color-bg-hover)` 浅灰
- **AND** tile 位置 SHALL 不发生位移、不增加阴影
- **AND** `prefers-reduced-motion: reduce` 偏好下,过渡 SHALL 仅作用于 `background-color`

#### Scenario: KPI 卡为横向紧凑条

- **WHEN** 关键指标(今日量 / 本周量 / 当日信息量)渲染
- **THEN** 每张 KPI tile SHALL 为水平布局:左侧描边图标、右上大号等宽数字、右下极小灰标签、底部 sparkline 行
- **AND** 三 tile 与态势 mini、预警徽标 SHALL 处于同一行(`.po-rail` 内)

#### Scenario: 媒体/热文以排行 + 三栏填满呈现

- **WHEN** 热点 band 渲染
- **THEN** SHALL 同时渲染「媒体来源占比」「Top 热门信息」「今日平台分布」三个 tile,各占 4 列
- **AND** 该 band 12 列 SHALL 自然铺满,不存在「半空」位

#### Scenario: 媒体×情感矩阵以真热力图呈现

- **WHEN** 结构 band 中的媒体×情感矩阵 tile 渲染
- **THEN** SHALL 为「行=平台、列=5 模态」的色块网格(非堆叠条形)
- **AND** 每格 SHALL 显示数字且背景深浅按值映射
- **AND** 字色 SHALL 随背景深浅自适应以保证对比度

#### Scenario: 趋势图加均值参考线

- **WHEN** 态势 band 中的情感×时间堆叠面积图渲染
- **THEN** 图表 SHALL 包含一条水平虚线,标注 `Avg <N>` 表示该窗口均值

#### Scenario: 数据接入与模块构成不变

- **WHEN** 控制台分区视觉重构完成
- **THEN** 数据来源、归一化、BFF 聚合、单模块降级 SHALL 与改造前一致
- **AND** 模块集合(KPI、堆叠面积时序、分时×媒体、百分比堆叠条、媒体×情感矩阵、情感分布、媒体占比、Top 热文、今日平台分布、预警、最新信息流)SHALL 完整保留(仅预警呈现形态从独立 Panel 改为 KPI rail 内徽标)

### Requirement: 高级可视化使用 d3 子包且尊重 reduced-motion

系统 SHALL 在看板引入 d3 子包(`d3-scale` / `d3-scale-chromatic` / `d3-shape` / `d3-array` / `d3-interpolate`)用于自定义可视化与微交互(蓝色单色阶热力图、MiniDonut SVG 弧、数值滚动动画);d3 SHALL NOT 直接操作 DOM(不引 `d3-selection`),所有渲染与事件 SHALL 由 React 接管。所有动画 SHALL 受 `prefers-reduced-motion: reduce` 守护:在该偏好下 SHALL 降级为瞬时显示,不引入位移、闪烁或描边动画。

#### Scenario: 看板在偏好减少动效下加载

- **WHEN** 用户设置系统偏好为 `prefers-reduced-motion: reduce`
- **THEN** KPI 数字 SHALL 直接显示最终值(无 CountUp 滚动)
- **AND** MiniDonut 弧 SHALL 直接显示完整(无描边绘制动画)
- **AND** 卡片入场 SHALL 不带 fade-in / translateY

#### Scenario: 热力矩阵采用 d3 蓝色单色阶

- **WHEN** 媒体×情感矩阵渲染
- **THEN** 格背景色 SHALL 由 `d3-scale` 的 `scaleSequential` 与 `interpolateBlues` 生成
- **AND** 色阶 SHALL 与情感语义色不冲突(单色阶蓝,情感语义色仅用于 MiniDonut)

### Requirement: 预警以 KPI rail 末端徽标常驻而非独立 Panel

看板 SHALL NOT 渲染独立的「预警概览」Panel(取消其在中部分析区占用 4 列或 8 列的卡片)。预警 SHALL 收编为 KPI rail 末端的 `.po-alert-badge`,呈现三态:(a) `重大预警 > 0` 时显示红底徽标 `重大 N`;(b) `预警总量 > 0 且重大 = 0` 时显示主色边框徽标 `预警 N`;(c) 二者皆为 0 时显示静默灰点,tooltip "当前无预警"。点击徽标 SHALL 就地展开 `.po-alert-popover`,内含「重大预警 N / 预警总量 N」与 `topWords` 关键词云。徽标 SHALL 满足 a11y:`role="button"`、`aria-expanded`、键盘可达、`cursor-pointer`。

#### Scenario: 当前无预警(0/0)

- **WHEN** `warnings.warningTotal === 0 && warnings.majorTotal === 0`
- **THEN** rail 末端 SHALL 渲染一个 8px 灰色静默 dot
- **AND** tooltip / `aria-label` SHALL 为「当前无预警」
- **AND** 中部分析区 SHALL NOT 存在「预警概览」Panel(`<Panel title="预警概览"` 不再被渲染)

#### Scenario: 存在重大预警

- **WHEN** `warnings.majorTotal > 0`
- **THEN** rail 末端 SHALL 渲染红底徽标,文字 `重大 N`(N 为 `majorTotal`)
- **AND** 徽标 SHALL 在 `prefers-reduced-motion: no-preference` 时含 ≤ 1.5s 周期的轻微脉冲
- **AND** `prefers-reduced-motion: reduce` 时 SHALL 静态

#### Scenario: 仅有普通预警

- **WHEN** `warnings.warningTotal > 0 && warnings.majorTotal === 0`
- **THEN** rail 末端 SHALL 渲染主色边框徽标,文字 `预警 N`
- **AND** 不脉冲

#### Scenario: 点击徽标展开关键词云

- **WHEN** 用户点击或键盘聚焦 + Enter 触发 `.po-alert-badge`
- **THEN** SHALL 在 rail 下方就地展开 `.po-alert-popover`
- **AND** popover 内容 SHALL 包含两行计数(重大/总量)与现有 `.po-wordcloud` 渲染的关键词
- **AND** ESC 键、点击 popover 外区域 SHALL 关闭 popover

### Requirement: 右侧 sticky 信息流头部与 KPI rail 顶部对齐

`.po-overview-aside` sticky `top` SHALL 设置为相对 `.po-dashboard` 滚动容器内部坐标的 `0`(而非旧值 `84px`),使右侧信息流头部与左侧 KPI rail 顶部基线对齐。若 `.po-dashboard` 不再是滚动容器(后续 ConsoleShell 重构),`top` SHALL 调整为「使 feed 头部与 rail 顶部基线垂直差值 ≤ 8px」的等价值。`≤1280px` 断点下,aside SHALL 回退为 `position: static`,顶端对齐契约失效但符合塌列预期。

#### Scenario: 1440×900 视口下 aside 与 rail 对齐

- **WHEN** 看板在 1440×900 视口加载完成且未滚动
- **THEN** 信息流 `.po-feed-head` 顶端 SHALL 与 KPI rail `.po-rail` 顶端基线垂直差值 ≤ 8px
- **AND** 右上角 SHALL NOT 存在 ≥ 100px 的连续空白

#### Scenario: 用户滚动 .po-dashboard 容器

- **WHEN** 用户在 `.po-dashboard` 容器内向下滚动
- **THEN** `.po-overview-aside` SHALL 保持 sticky 固定在容器内部顶端 `top: 0`
- **AND** rail 与中部 band SHALL 随容器滚动消失,aside 不消失

#### Scenario: ≤1280px 断点塌单列

- **WHEN** 视口宽度 ≤ 1280px
- **THEN** `.po-overview-aside` SHALL 失去 sticky 定位并回到页面底部(`position: static`)
- **AND** rail 与 band 仍按原序在上方堆叠

### Requirement: 看板视觉分组使用 band 容器与 hairline

看板中部分析区 SHALL 使用 `<section class="po-band">` 组合三个分组:每个 band SHALL 含一个 `.po-band-label`(包含中文小写灰标签 + latin 等价标记,如「态势 · trend」)以及一个 `.po-band-grid`(12 列子栅格)。band 顶部 SHALL 有 1px hairline(`border-top: 1px solid var(--color-divider)`),作为弱分隔。band 内部 tile SHALL NOT 含独立边框,改由栅格 `gap` 与 hover 浅底色 (`var(--color-bg-hover)`) 提供视觉分隔。band 标签的 `latin` 部分 SHALL 满足 i18n 可替换(挂在 `data-band` 属性上)。

#### Scenario: 三个 band 与对应 latin 标签

- **WHEN** 看板渲染
- **THEN** SHALL 渲染恰好 3 个 `.po-band` 元素
- **AND** 三个 band 的 `data-band` 属性 SHALL 分别为 `trend` / `composition` / `hot spots`(按出现顺序)
- **AND** 三个 band 的中文标签 SHALL 分别为「态势」/「结构」/「热点」

#### Scenario: band hairline 在低对比环境下仍可见

- **WHEN** 用户在标准对比度(WCAG AA)环境下查看 band
- **THEN** 顶部 hairline SHALL 使用 `var(--color-divider)` 1px 实线
- **AND** 对比比 SHALL ≥ 1.5:1 相对于 `.po-dashboard` 背景

#### Scenario: tile 无边框且 hover 反馈仅靠背景

- **WHEN** band 内 tile 处于默认态
- **THEN** tile SHALL 不渲染外边框、不渲染外阴影
- **WHEN** 鼠标悬停 tile
- **THEN** 仅 `background-color` SHALL 切换为 `var(--color-bg-hover)`,位置与尺寸 SHALL 保持不变

