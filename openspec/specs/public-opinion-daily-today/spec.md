# public-opinion-daily-today Specification

## Purpose
TBD - created by archiving change add-public-opinion-daily-today-feed. Update Purpose after archive.
## Requirements
### Requirement: 「每日舆情」原始流总入口在每日舆情分组下落地

系统 SHALL 在 `/public-opinion/daily/today` 提供一个名为「每日舆情」的页面,作为研究员"看料"的入口,与「舆情速览 / 每日舆情」分组下既有的「正负面舆情」(看情)与「趋势与占比」(看势)并列。本页 SHALL 不做聚合分析、不做榜单排序、不做 AI 摘要,只按发布时间倒序铺出"今天到底冒出来了哪些原始条目"。

#### Scenario: 路由可访问且页面挂载

- **WHEN** 用户访问 `/public-opinion/daily/today`
- **THEN** 系统 SHALL 渲染「每日舆情」页面,包含监测词下拉、时间档 chip、平台 chip、搜索框、迷你直方图、信息流、抽屉(关闭态)六个核心区
- **AND** 页面 SHALL 通过 URL 查询参数(`?keyword=&hours=`)恢复监测词与时间档状态,缺省时默认 `keyword=peking&hours=24`

#### Scenario: 沿用既有侧边栏占位契约升级为真实内容

- **WHEN** 用户进入「舆情速览 / 每日舆情」分组的侧边栏
- **THEN** 三个子项 SHALL 仍依次为「正负面舆情」「每日舆情」「趋势与占比」,**顺序与命名不变**
- **AND** 点击「每日舆情」子项 SHALL 跳转到 `/public-opinion/daily/today` 并呈现本 capability 定义的真实内容(不再是占位页)

### Requirement: 监测词驱动 + 时间档切换的全量数据范围

页面数据范围 SHALL 由「单个监测词 × 单个时间档」唯一确定。监测词切换或时间档切换 SHALL 触发整页 loading 与新一次 fetch;后端 SHALL 返回该范围下的全部条目(上限 5000 条)、24 桶时序直方图与各平台 facet 计数。监测词与译文 MVP 阶段 SHALL 来自 Mock,真实采集器与 AI 翻译留待下一期。

#### Scenario: 切换监测词触发全量重载

- **WHEN** 用户从监测词下拉选择不同的监测词
- **THEN** 系统 SHALL 触发新的 `GET /api/public-opinion/daily-today?keyword=<new>&hours=<current>` 请求
- **AND** 页面 SHALL 进入 loading 态,完成后用新 payload 替换 `items / histogram / platforms`
- **AND** 当前 `platformFilter / polarityFilter / searchQuery / selectedIds` SHALL 被清空

#### Scenario: 切换时间档触发全量重载

- **WHEN** 用户切换时间档 chip(6h / 12h / 24h)
- **THEN** 系统 SHALL 触发新的 fetch,`hours` 参数更新为对应数值
- **AND** 直方图 24 根柱在 6h/12h 档下 SHALL 分别代表 15min/30min 区间

#### Scenario: 全量加载上限保护

- **WHEN** 某监测词 × 时间档组合下条目数超过 5000
- **THEN** API 响应 SHALL 截断为最新 5000 条并设 `truncated: true`
- **AND** UI SHALL 在直方图下方显示提示文案:`结果超过 5000 条,仅显示最新 5000 条,建议收窄时间档或加平台过滤`

#### Scenario: MVP 监测词与译文来自 Mock

- **WHEN** API 路由在 `NEXT_PUBLIC_PUBLIC_OPINION_MOCK=true` 模式下被调用
- **THEN** 数据 SHALL 来自 `apps/web/lib/public-opinion/daily-today/` 下的 Mock 生成器
- **AND** 监测词清单 SHALL 包含至少 6 个 Mock 监测词,其中至少 1 个跨语种命中(同时存在 zh/en/ja/ru 中至少 3 种语言的命中条目)
- **AND** 非中文条目 SHALL 在 payload 中附 `translation: { zh: string }` 字段

#### Scenario: 真实数据未接入时返回明确状态

- **WHEN** API 路由在 `NEXT_PUBLIC_PUBLIC_OPINION_MOCK=false` 或未设置时被调用
- **THEN** 系统 SHALL 返回 HTTP 501 与 `{ error: 'real-data-source-not-connected' }`
- **AND** UI SHALL 显示加载失败态而非崩溃

### Requirement: 顶部筛选条 chip 多选与零延迟前端过滤

页面顶部 SHALL 提供监测词下拉、时间档 chip、平台 chip(多选)、关键词搜索框、情感三档筛选(更多筛选 popover)、导出按钮、手动刷新按钮七项控件。平台 chip 与搜索框与情感筛选 SHALL 走前端 filter,**切换后不触发后端 fetch**;直方图与 chip facet 计数 SHALL 跟随当前过滤同步重算。

#### Scenario: 平台 chip 多选切换为前端过滤

- **WHEN** 用户点击某个平台 chip(如 `Twitter`)
- **THEN** 系统 SHALL 仅在前端对 items 做过滤,**不触发新的 `GET /api/public-opinion/daily-today` 请求**
- **AND** 信息流、直方图、其他 chip 的 facet 计数 SHALL 即时同步更新(< 100ms)
- **AND** 已选中的 chip SHALL 视觉高亮,再次点击 SHALL 取消选中

#### Scenario: "全部" chip 清空平台过滤

- **WHEN** 用户点击"全部" chip
- **THEN** 所有平台 chip 的选中态 SHALL 被清空
- **AND** 信息流 SHALL 显示当前监测词 × 时间档下的全部条目(其他过滤维度不变)

#### Scenario: 搜索框前端模糊匹配

- **WHEN** 用户在搜索框输入关键词
- **THEN** 系统 SHALL 在 80ms debounce 后,对 `body | translation.zh | author.handle | author.displayName` 字段做大小写无关的 `includes` 匹配
- **AND** 匹配过程 SHALL 不触发后端 fetch

#### Scenario: facet 计数按 "除自身外其他过滤" 计算

- **WHEN** 多个过滤条件(平台 chip + 情感 + 搜索)同时启用
- **THEN** 每个平台 chip 后的计数 SHALL 表示"除去平台过滤本身、其他过滤条件均生效"时该平台的条目数
- **AND** 该机制 SHALL 防止某些 chip 在被排除时显示 0 而无法重新选回

#### Scenario: 直方图按当前过滤重算

- **WHEN** 用户切换任何前端过滤(平台 / 情感 / 搜索)
- **THEN** 顶部 24 根柱的直方图 SHALL 按过滤后的 items 重新计算高度
- **AND** 重算 SHALL 与 facet count 在同一次 reduce 内完成,避免双遍历

### Requirement: 迷你直方图 hover-tooltip 与点击 scrollTo

页面顶部 SHALL 包含一个 24 根固定柱的迷你直方图,占据约 64px 高度;hover 任一柱 SHALL 显示该时段的条目数与时间区间;点击柱子 SHALL 使信息流虚拟滚动到该时段的首个条目,并在直方图上保留视口锚点的视觉高亮。

#### Scenario: hover 显示时段 tooltip

- **WHEN** 用户鼠标悬停在直方图任一柱上
- **THEN** SHALL 显示 tooltip,24h 档下格式为 `HH:00–HH:00, N 条`,6h/12h 档下格式为 `HH:mm–HH:mm`

#### Scenario: 点击柱子跳转至对应桶

- **WHEN** 用户点击直方图任一柱
- **THEN** 系统 SHALL 调用虚拟滚动器的 `scrollToIndex` 跳转到该桶的首个条目
- **AND** 该柱 SHALL 进入"当前锚点"高亮状态

#### Scenario: 滚动时直方图锚点同步

- **WHEN** 用户在信息流中滚动
- **THEN** 直方图上对应当前视口首条目所在桶的柱 SHALL 自动高亮
- **AND** 切换桶时高亮 SHALL 平滑过渡(reduced-motion 偏好下立即切换)

### Requirement: 极简单行 + 命中词高亮 + 译文角标

信息流每条 SHALL 以 32–36px 行高的单行布局呈现,从左到右依次为:checkbox、平台徽(14px)、`HH:mm` 时间、作者句柄、单行截断正文、情感色点。命中监测词的字段 SHALL 在正文中以内联 `<mark>` 高亮;非中文条目 SHALL 在正文末尾加 `译` 角标提示抽屉内可见译文。

#### Scenario: 行高在 32–36px 范围内

- **WHEN** 信息流渲染
- **THEN** 单行行高(`--daily-today-row-height`)SHALL 在 32px–36px 区间
- **AND** 1080p(900px 视口高度)下首屏可见行数 SHALL ≥ 25

#### Scenario: 命中词内联高亮

- **WHEN** 条目的正文或译文中包含 `keyword.aliases` 任一别名
- **THEN** 该别名出现的位置 SHALL 用 `<mark>` 包裹,样式为黄底
- **AND** 匹配 SHALL 用 `indexOf` 实现,不使用正则(避免 unicode 边界问题)

#### Scenario: 外文条目显示译文角标

- **WHEN** 条目的 `body.language !== 'zh'`
- **THEN** 单行正文末尾 SHALL 显示一个小型角标(如 `<sup>译</sup>`)
- **AND** 角标 SHALL 提示研究员"打开抽屉可见中文译文"

#### Scenario: 情感色点与 polarity 阈值一致

- **WHEN** 行末渲染情感色点
- **THEN** ● 红色 SHALL 对应 `sentiment < -0.3`(负面),○ 灰色 SHALL 对应 `-0.3 ≤ sentiment ≤ +0.3`(中立),● 绿色 SHALL 对应 `sentiment > +0.3`(正面)
- **AND** hover 色点 SHALL 显示精确分数

#### Scenario: 行点击交互拆分

- **WHEN** 用户点击行的 checkbox 区域
- **THEN** SHALL 切换该条目的勾选状态,**不打开抽屉**

- **WHEN** 用户点击行的非 checkbox 区域
- **THEN** SHALL 打开右侧抽屉显示该条目详情,**不切换勾选状态**

### Requirement: 默认时间倒序,不提供排序切换

信息流 SHALL 始终按 `publishedAt` 倒序排列,**不提供任何排序切换控件**。"按热度/按情感强度/按互动数"等排序需求 SHALL 通过跳转到 `daily/trends` 或 `daily/polarity` 子页满足。

#### Scenario: 进页默认时间倒序

- **WHEN** 用户首次访问页面或切换监测词
- **THEN** 信息流首条 SHALL 是该范围下 `publishedAt` 最大的条目
- **AND** 信息流末条 SHALL 是 `publishedAt` 最小的条目

#### Scenario: 不渲染排序控件

- **WHEN** 页面渲染完成
- **THEN** 顶部筛选条 SHALL NOT 包含任何"排序"下拉或按钮
- **AND** 信息流头部 SHALL NOT 包含可点击的排序列头

### Requirement: 虚拟滚动 + DOM 节点恒定

信息流 SHALL 使用 `@tanstack/react-virtual` 实现虚拟滚动,渲染当前视口 + 上下 8 行缓冲;DOM 总节点数 SHALL 与 `filteredItems.length` 无关、恒定保持在 ≤ 80 行节点;5000 条上限下滚动 FPS SHALL ≥ 50。

#### Scenario: 5000 条数据下 DOM 节点恒定

- **WHEN** 信息流装载 5000 条数据
- **THEN** 可见 DOM 行节点数(`.daily-today-row` 等同类)SHALL ≤ 80
- **AND** 滚动到任意位置 DOM 节点数 SHALL 保持稳定

#### Scenario: 抽屉打开期间虚拟滚动正常工作

- **WHEN** 用户在打开抽屉的同时滚动信息流
- **THEN** 信息流 SHALL 继续按虚拟滚动机制工作
- **AND** 抽屉内显示的条目 SHALL NOT 受滚动影响

### Requirement: 右侧抽屉承载单条详情与抽屉内勾选

点击行 SHALL 从右侧滑入宽 360px 的抽屉(`FeedItemDrawer`),展示该条目的完整详情:平台/作者完整信息、发布时间、情感分(数值 + 色点)、全文(命中词高亮)、Mock 中文译文(仅外文条目)、互动数、跳原文链接、"加入勾选"按钮、关闭与全屏切换按钮。抽屉内"加入勾选"与列表 checkbox SHALL 双向同步同一份 `selectedIds`。

#### Scenario: 抽屉滑入与关闭

- **WHEN** 用户点击行的非 checkbox 区域
- **THEN** 抽屉 SHALL 从右侧滑入(240ms ease-out 动画;reduced-motion 偏好下立即出现)
- **AND** 抽屉宽度 SHALL 为 360px
- **AND** 按 ESC 键、点击遮罩、点击关闭按钮 SHALL 关闭抽屉

#### Scenario: 抽屉全屏切换

- **WHEN** 用户点击抽屉右上的 ⤢ 全屏按钮
- **THEN** 抽屉 SHALL 扩展至视口宽度的 80% 以应对 1280px 屏的主流区挤压
- **AND** 再次点击 SHALL 恢复 360px

#### Scenario: 抽屉显示完整字段

- **WHEN** 抽屉打开
- **THEN** SHALL 显示以下字段:平台徽 + 来源名 + 作者句柄 + 显示名、发布时间(含原始时区)、情感分数值与色点、全文(无截断,含命中词 mark 高亮)、互动数(转发/点赞/评论)、↗ 查看原文链接、✓ 加入勾选按钮
- **AND** 外文条目 SHALL 额外显示中文译文 + 一个 disabled 的"重新翻译"按钮(tooltip: "下一期上线")

#### Scenario: 抽屉勾选与列表 checkbox 双向同步

- **WHEN** 用户在抽屉内点击 ✓ 加入勾选
- **THEN** 列表对应行的 checkbox SHALL 变为已勾选状态

- **WHEN** 用户在列表行点击 checkbox 切换勾选
- **AND** 抽屉正显示该条目
- **THEN** 抽屉内的勾选按钮状态 SHALL 同步切换

### Requirement: 90s 新数据轮询 + 顶部横条 + 视口锁定

页面 SHALL 每 90 秒(可由 `NEXT_PUBLIC_DAILY_TODAY_POLL_MS` 覆盖)轮询 `/api/public-opinion/daily-today/count` 检查自上次 fetch 后是否有新条目。新增数 > 0 时 SHALL 显示顶部横条 `↑ N 条新条目 [点击加载]`,**视口位置 SHALL 不因新条目灌入而改变**。Tab 失焦时 SHALL 暂停轮询,focus 回来时立即拉一次。

#### Scenario: 新数据出现时横条显示

- **WHEN** `/count` 接口返回 `newCount > 0`
- **THEN** 页面顶部 SHALL 显示横条 `↑ N 条新条目 [点击加载]`
- **AND** N === 0 或自上次点击后无新增时 SHALL 隐藏横条
- **AND** 新增持续累积时 N SHALL 持续增长(不重置)

#### Scenario: 点击横条灌入新数据且视口不跳

- **WHEN** 用户点击横条
- **THEN** 系统 SHALL fetch 最新增量并 unshift 到 items 顶部
- **AND** 灌入的前 N 条 SHALL 加 `isFresh=true` 标记,左侧出现 4px 短彩竖线
- **AND** 5 秒后 `isFresh` SHALL 自动转为 false,竖线淡出
- **AND** 当前滚动视口 SHALL 保持在用户原本浏览的条目附近(`scrollOffset` 补偿)
- **AND** 横条 SHALL 隐藏

#### Scenario: Tab 失焦暂停轮询

- **WHEN** `document.visibilityState` 变为 `'hidden'`
- **THEN** 轮询 SHALL 暂停(清空 interval)
- **AND** 切换回 `'visible'` 时 SHALL 立即调用一次 `/count` 并重新启动 interval

#### Scenario: 连续失败后暂停轮询

- **WHEN** `/count` 接口连续 3 次失败
- **THEN** 系统 SHALL 显示 toast "自动刷新已暂停,请手动刷新"
- **AND** 自动轮询 SHALL 停止直到用户点击手动刷新按钮

### Requirement: 行级勾选 + CSV 导出 + 与 polarity 列对齐

页面 SHALL 提供行级 checkbox 与顶部「⬇ 导出」按钮,导出格式为 CSV,通过流式响应下载;字段列序与 `public-opinion-daily-polarity` 导出对齐,末尾追加 `translation_zh` 与 `matched_keyword` 两列。导出范围 SHALL 由当前 `selectedIds` 决定:勾选 0 条时导出全部当前过滤后的 items,勾选 ≥ 1 条时仅导出勾选条目。

#### Scenario: 导出按钮文案动态

- **WHEN** `selectedIds.size === 0`
- **THEN** 按钮 SHALL 显示 `⬇ 导出全部 (N)`,N 为当前 filteredItems 数量

- **WHEN** `selectedIds.size >= 1`
- **THEN** 按钮 SHALL 显示 `⬇ 导出 (M/N)`,M 为勾选数,N 为 filteredItems 数量

#### Scenario: CSV 列序与 polarity 对齐

- **WHEN** 用户触发导出
- **THEN** 服务端返回的 CSV 首行 SHALL 严格为以下列序:`id,platform,publishedAt,author_handle,author_display_name,body,translation_zh,sentiment,polarity,reposts,likes,replies,source_url,matched_keyword`
- **AND** 前 6 列 + 后续 sentiment/polarity/reposts/likes/replies/source_url 与 polarity 导出同名同序
- **AND** `translation_zh` 与 `matched_keyword` 为本页新增列,中文条目的 `translation_zh` 为空

#### Scenario: 文件命名带监测词与时间戳

- **WHEN** CSV 下载触发
- **THEN** 文件名 SHALL 为 `daily-today-<keyword>-<yyyyMMdd-HHmm>.csv` 格式

### Requirement: 空 / 截断 / 错误三种边界态有明确文案

页面 SHALL 对 0 条结果、5000 条上限触达、加载失败三种边界态分别给出清晰、可操作的提示文案,避免空白页或崩溃。

#### Scenario: 0 条结果空态

- **WHEN** filteredItems.length === 0
- **THEN** 流区域 SHALL 显示文案 `当前筛选下没有条目,尝试切换平台或扩大时间档`
- **AND** SHALL 提供一键 [清空筛选] 按钮重置 `platformFilter / polarityFilter / searchQuery`

#### Scenario: 5000 条上限提示

- **WHEN** API 响应 `truncated === true`
- **THEN** UI SHALL 在直方图下方显示提示条:`结果超过 5000 条,仅显示最新 5000 条,建议收窄时间档或加平台过滤`

#### Scenario: 加载失败保留上次数据

- **WHEN** `/api/public-opinion/daily-today` 请求失败
- **THEN** UI SHALL 显示 `数据加载失败 [重试]` 提示
- **AND** 上次成功加载的 items 与状态 SHALL 不被清空,研究员仍可操作

### Requirement: 视觉令牌与 v3 控制台范式对齐

页面 SHALL 沿用 v3 控制台令牌(`--po-pad`、`--po-gap`、`--po-panel-radius`、`--po-title-size`、`--po-subtitle-size`);新增令牌仅限本页专用作用域:`--daily-today-row-height`、`--daily-today-aside-width`、`--daily-today-histogram-height`、`--daily-today-fresh-stripe`。SHALL NOT 引入新色板;5 模态情感色与平台徽色板沿用既有变量。

#### Scenario: 沿用 v3 控制台令牌

- **WHEN** 页面渲染
- **THEN** 筛选条与流区域的 padding/gap/radius/font-size SHALL 引用 v3 既有 token,不出现硬编码像素值

#### Scenario: 新令牌仅限本页作用域

- **WHEN** 检视 CSS
- **THEN** `--daily-today-*` 系列令牌 SHALL 仅在 `.daily-today-page`(或同类页面根类)及其后代选择器内生效
- **AND** 不污染全局令牌空间

#### Scenario: 不引入新色板

- **WHEN** 页面渲染
- **THEN** 所有颜色 SHALL 来自既有 CSS 变量(`--color-primary`、`--color-bg-hover`、5 模态情感色、平台徽色)
- **AND** SHALL NOT 出现新的颜色 hex/rgb 字面量

