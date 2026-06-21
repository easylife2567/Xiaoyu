## ADDED Requirements

### Requirement: Sidebar 导航支持可折叠的嵌套子分组

系统 SHALL 支持在 sidebar 导航分组内渲染**可折叠的嵌套子分组**:一个子分组由一个带 chevron 指示符的标题行与一组子条目构成,用户 SHALL 能够展开或收起该子分组。该能力是数据驱动的——导航条目数据中带有子条目集合(`children`)的项 SHALL 被渲染为可折叠子分组,不带 `children` 的项 SHALL 继续按既有扁平导航条目渲染。可折叠子分组 SHALL 受既有「关键导航持续可见」与「sidebar 内部独立滚动」契约约束:展开多个子分组撑高 sidebar 时,SHALL 通过 sidebar 自身的局部滚动容纳,而非引入新的滚动行为或撑破 shell。

#### Scenario: 用户展开一个收起状态的子分组

- **WHEN** 用户点击一个处于收起状态的可折叠子分组标题行
- **THEN** 该子分组 SHALL 展开并显示其全部子条目
- **AND** chevron 指示符 SHALL 反映展开状态(指向展开方向)
- **AND** 子分组标题行 SHALL 通过 `aria-expanded` 暴露当前展开/收起状态以便键盘与辅助技术访问

#### Scenario: 用户收起一个展开状态的子分组

- **WHEN** 用户点击一个处于展开状态的可折叠子分组标题行
- **THEN** 该子分组 SHALL 收起并隐藏其子条目
- **AND** 其它子分组与扁平导航条目的展开/可见状态 SHALL NOT 受影响

#### Scenario: 当前页面位于某子分组的子条目内

- **WHEN** 用户访问的页面对应某可折叠子分组下的一个子条目
- **THEN** 该子分组 SHALL 默认处于展开状态
- **AND** 当前子条目 SHALL 高亮(active)
- **AND** 其余未包含当前页面的子分组 SHALL 默认收起

#### Scenario: 既有扁平分组不受影响

- **WHEN** sidebar 渲染既有的扁平导航分组(如「工作台」中的工作台总览与各工作台、「管理」中的产物归档与权限管理)
- **THEN** 这些不带 `children` 的条目 SHALL 继续以扁平 `nav-item` 链接形式渲染
- **AND** 其行为与可折叠子分组能力引入前保持一致(无 chevron、无展开/收起交互)

#### Scenario: 多个子分组展开导致 sidebar 内容超出视口

- **WHEN** 同时展开的子分组使 sidebar 导航内容总高度超过其可用高度
- **THEN** sidebar SHALL 通过自身的局部垂直滚动访问被溢出的导航内容
- **AND** topbar 与 sidebar 框架 SHALL NOT 因此被撑破或随文档滚动(遵循既有「关键导航持续可见」契约)
