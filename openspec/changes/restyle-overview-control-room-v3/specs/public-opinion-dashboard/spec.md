## MODIFIED Requirements

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

## ADDED Requirements

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
