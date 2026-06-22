## ADDED Requirements

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
