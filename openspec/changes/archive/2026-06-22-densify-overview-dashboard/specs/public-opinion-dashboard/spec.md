## ADDED Requirements

### Requirement: 看板采用高密度信息惯用语呈现

舆情总览看板 SHALL 以高信息密度的"控制台一眼概览"形态呈现:1440×900 视口下前 6 个模块 SHALL 单屏可见(不依赖下滑)。看板 SHALL 采用 12 列网格栅格;模块按内容自然占列(KPI 与跨行模块全宽,排行/小图占 4–6 列)。视觉风格 SHALL 沿用既有令牌(主色 `--color-primary` 蓝、5 模态情感语义色),不引入新色板。

#### Scenario: 1440×900 视口下单屏可见前 6 模块

- **WHEN** 看板在 1440×900 视口加载完成
- **THEN** 前 6 个模块(KPI 行、本周趋势、情感分布、今日分时趋势、今日平台分布、Top 排行行)SHALL 单屏可见,无需滚动
- **AND** 剩余模块(热力矩阵、信息流)SHALL 通过 `.po-dashboard` 容器局部滚动访问

#### Scenario: KPI 卡为横向紧凑条

- **WHEN** 关键指标(今日量 / 本周量 / 当日信息量)渲染
- **THEN** 每张 KPI 卡 SHALL 为水平布局:左侧描边图标、右上大号等宽数字、右下极小灰标签
- **AND** KPI 卡高度 SHALL 显著低于改造前(参照 ~56px 而非 ~88px)

#### Scenario: 情感分布以 5 个微环并排呈现

- **WHEN** 情感分布模块渲染
- **THEN** SHALL 渲染 5 个微环(MiniDonut),每环对应一个情感模态
- **AND** 每环 SHALL 显示数值与模态名,色彩 SHALL 沿用 5 模态语义色(正面绿 → 负面红)

#### Scenario: 媒体/热文以双 chip 排行呈现

- **WHEN** 媒体来源占比与 Top 热文模块渲染
- **THEN** 列表 SHALL 为「序号 + 名称 + 主指标 chip + 次指标 chip」结构
- **AND** 主指标 chip SHALL 使用主色浅底 + 主色文字,次指标 chip SHALL 使用中性深底 + 白文字

#### Scenario: 媒体×情感矩阵以真热力图呈现

- **WHEN** 媒体×情感矩阵模块渲染
- **THEN** SHALL 为「行=平台、列=5 模态」的色块网格(非堆叠条形)
- **AND** 每格 SHALL 显示数字且背景深浅按值映射(行内归一化或全局归一化)
- **AND** 字色 SHALL 随背景深浅自适应以保证对比度

#### Scenario: 趋势图加均值参考线

- **WHEN** 本周趋势与今日分时趋势渲染
- **THEN** 图表 SHALL 包含一条水平虚线,标注 `Avg <N>` 表示该窗口均值

#### Scenario: 数据接入与模块构成不变

- **WHEN** 密度化重构完成
- **THEN** 数据来源、归一化、BFF 聚合、单模块降级 SHALL 与改造前一致
- **AND** 模块集合(KPI、本周趋势、今日分时、情感分布、媒体占比、媒体×情感矩阵、今日平台分布、预警、Top 热文、最新信息流)SHALL 完整保留

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
