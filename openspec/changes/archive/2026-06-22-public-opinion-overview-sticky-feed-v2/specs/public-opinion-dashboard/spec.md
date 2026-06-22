## ADDED Requirements

### Requirement: 看板布局为左分析区 + 右信息流区双列控制台

舆情总览看板 SHALL 拆分为左侧 8 列分析区与右侧 4 列信息流区的双列布局;信息流区 SHALL position: sticky 固定于视口顶部(top: 84px)并支持内部独立纵向滚动。≤ 1280px 断点以下 SHALL 塌回单列流式布局,信息流区回到页面底部。

#### Scenario: 1440×900 视口下信息流常驻右侧

- **WHEN** 看板在 1440×900 视口加载
- **THEN** 左侧分析区 SHALL 展示 KPI 紧凑栏、堆叠面积时序、分时×媒体热力、百分比堆叠条、两个排行模块、预警概览与情感热力矩阵;所有左侧 SHALL 不需要滚动
- **AND** 右侧信息流 SHALL 固定且 SHALL 展示完整信息流 SHALL 独立滚动,其最新 30 条内容,同时 SHALL 支持过滤、色条高亮与 30 秒轮询

#### Scenario: ≤1280 自动塌回单列

- **WHEN** 浏览器窗口缩至 ≤1280px 宽度
- **THEN** 信息流区 SHALL 失去 sticky 定位并回到页面底部
- **AND** 分析区 SHALL 恢复为全宽流式布局

### Requirement: 关键指标卡内嵌 Sparkline 趋势

看板关键指标卡 SHALL 内嵌 30px 高的 Sparkline 迷你趋势线,展示近 7 日舆情量趋势。Sparkline SHALL 显示为纯 SVG,d3-shape.line() 绘制,不引入新数据请求或增加卡片高度。

#### Scenario: 三张 KPI 卡各自带有迷你趋势

- **WHEN** KPI 卡(今日舆情量 / 本周舆情量 / 当日信息量)渲染完成
- **THEN** 每张卡底部 SHALL 显示一条对应时间粒度的 Sparkline 趋势线
- **AND** 三张 Sparkline SHALL 各自采用与该 KPI 卡语义色(今日舆情=主色蓝、本周舆情=强调色青、当日信息=中性灰)

### Requirement: 情感 × 时间堆叠面积时序

看板 SHALL 以一张 7 日 × 5 情感模态的堆叠面积图展示舆情趋势与情感构成的联合视图。该图 SHALL 替代原"本周舆情趋势"柱图与"情感分布"5 小环,信息密度 SHALL 不低于原两张图之和。

#### Scenario: 堆叠面积图同时展示趋势与情感构成

- **WHEN** 用户查看看板时
- **THEN** SHALL 看到一张全宽面积图,纵轴为当日舆情总量
- **AND** 图中 SHALL 按 5 情感语义色分层堆叠
- **AND** 鼠标悬停 SHALL 显示当日各情感具体数值与占比

### Requirement: 媒体 × 情感百分比堆叠条

看板 SHALL 提供媒体 × 情感 100% 横向堆叠条,展示各媒体的情感构成比例,与现有媒体 × 情感热力矩阵形成互补。

#### Scenario: 百分比堆叠条展示平台情感倾向

- **WHEN** 用户查看媒体情感模块时
- **THEN** SHALL 看到每行一个媒体的横向堆叠条
- **AND** 每条 SHALL 横向铺满至 100% 宽度
- **AND** 5 色 SHALL 对应 5 情感模态语义色

### Requirement: 今日分时 × 媒体小热力

看板 SHALL 以 12 个 2 小时桶 × N 媒体的色块网格展示今日舆情在不同时段与不同平台上的分布。该图 SHALL 替代原"今日分时趋势"折线图。

#### Scenario: 分时 × 媒体热力一目了然

- **WHEN** 今日有多个平台产生舆情
- **THEN** SHALL 看到 N 行媒体 × 12 列时间桶的色块网格
- **AND** 色块深浅 SHALL 对应该平台该时段舆情量
- **AND** 鼠标悬停 SHALL 显示具体量值

### Requirement: 信息流支持前端过滤与情感色条高亮

信息流 SHALL 支持按"全部 / 风险 / 各平台"前端过滤 SHALL 在每条左侧增加 3px 宽情感语义色条;带有 risk 标记的条目 SHALL 整行淡红底高亮。

#### Scenario: 用户只看风险舆情

- **WHEN** 用户点击信息流顶部"风险" chip
- **THEN** 信息流 SHALL 仅展示带有 risk 标记的条目
- **AND** 这些条目 SHALL 以淡红底突出

#### Scenario: 情感色条快速扫读

- **WHEN** 用户快速扫视信息流
- **THEN** SHALL 通过左侧颜色条直观感知各条目情感倾向
- **AND** 负面/偏负面条目 SHALL 以红色/橙色条突出

### Requirement: 信息流 30 秒轮询更新且尊重页面可见性

看板 SHALL 每 30 秒重新拉取信息流分段数据,以保持信息最新。轮询 SHALL 在页面不可见(visibilityState 为 hidden)时暂停,页面重新可见时恢复。mock 数据模式下 SHALL 不触发轮询。

#### Scenario: 信息流后台轮询

- **WHEN** 看板在前台且未使用 mock 数据
- **THEN** SHALL 每 30 秒发起一次仅含 latestNews 分段的请求
- **AND** 响应 SHALL 仅更新信息流局部状态,不触发全页重绘

#### Scenario: 切走 Tab 暂停轮询

- **WHEN** 用户切换到其他浏览器标签页,本页面变为 hidden
- **THEN** 30 秒轮询 SHALL 暂停
- **AND** 用户切回本页面后 SHALL 恢复轮询

### Requirement: 开发环境一键 mock 丰满数据

看板 SHALL 支持开发环境一键 mock 数据开关(URL `?mock=1` 或 `PUBLIC_OPINION_MOCK=1` env)。mock 数据 SHALL 包含 5+ 媒体、情感均匀分布、30 条信息流、风险条目、预警词云,数据量 SHALL 足够稠密以支撑所有新图表的样式调试。生产环境 SHALL 忽略 URL query 开关,仅 env 生效。

#### Scenario: 本地开发调样式使用 mock

- **WHEN** 开发者打开看板时
- **THEN** SHALL 看到稠密、均匀分布的 mock 数据
- **AND** 所有新图表 SHALL 展示充分的真实感观
- **AND** console SHALL 打印一条 INFO 提示当前为 mock 模式

#### Scenario: 生产环境 mock 开关安全

- **WHEN** 生产环境用户在 URL 加 `?mock=1`
- **THEN** SHALL 忽略 query 开关,继续使用真实数据
- **AND** 若 `PUBLIC_OPINION_MOCK` env 为 1 时 SHALL 启用 mock
