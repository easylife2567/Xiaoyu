# workbench-shell-ux Specification

## Purpose
TBD - created by archiving change 2026-06-18-fix-workbench-scroll-architecture. Update Purpose after archive.
## Requirements
### Requirement: Workbench shell preserves persistent navigation across all content scales

The system SHALL preserve the workbench shell's primary navigation (top brand / global controls / sidebar / utility rail) as persistently visible regardless of the content size loaded inside any workbench. The shell SHALL behave as a fixed-frame container — only the inner content regions are allowed to scroll. Users SHALL never lose access to navigation, the user identity chip, the workflow progress indicator, or the workbench switcher because of long content lists.

#### Scenario: Candidate pool grows large enough to exceed viewport height

- **WHEN** the international daily report workbench is opened with a candidate pool exceeding the viewport vertical height
- **THEN** the topbar containing the brand, global tools, and operator chip SHALL remain visible at the top of the viewport at all times
- **AND** the sidebar containing primary workbench navigation SHALL remain visible at the left of the viewport at all times
- **AND** the workflow progress indicator (`生产链路`) SHALL remain visible at the top of the workbench area at all times

#### Scenario: User scrolls within any single workbench section

- **WHEN** the user scrolls within any one workbench section (candidate pool, selected basket, draft area, delivery area)
- **THEN** scrolling SHALL be contained within that section only
- **AND** other sections, the topbar, the sidebar, and the workflow progress indicator SHALL NOT scroll

#### Scenario: Browser viewport height changes

- **WHEN** the browser window is resized vertically (e.g., from 1200px tall to 800px tall) or zoomed
- **THEN** the shell layout SHALL adapt to the new viewport height without producing a horizontal scrollbar at the document level
- **AND** the topbar height SHALL remain constant (driven by `--shell-topbar-height` CSS variable)
- **AND** all internal scroll containers SHALL recalculate their available height accordingly

### Requirement: Workbench content regions scroll within isolated containers

The system SHALL contain workbench content scrolling within isolated regions — different sections within the same workbench (e.g., candidate pool, selected basket, draft area, delivery area on the daily-report workbench; metric column and task list on the translation workbench) SHALL each scroll independently. The vertical extent of one section's content SHALL NOT cause other sections' content to scroll, nor cause the shell-level navigation to scroll.

#### Scenario: One section's content is much longer than another's

- **WHEN** one workbench section (e.g., candidate pool with 250 entries) is significantly longer than another (e.g., draft area with 6 sections)
- **THEN** each section SHALL maintain its own scroll position
- **AND** scrolling in the longer section SHALL NOT affect the shorter section's visible content
- **AND** the shorter section SHALL show all of its content within its allocated height

#### Scenario: Section header context preservation during scroll

- **WHEN** the user scrolls within a section that has a header (e.g., `候选池` or `已选篮子` containing a counter such as `已选 3/6`)
- **THEN** the section's header SHALL remain visible at the top of that section, providing the user with persistent context (counts, action buttons, filter chips) regardless of the scroll position within that section's content body

### Requirement: Workbench section flex distribution preserves natural content density

The system SHALL distribute available vertical space among workbench sections such that **fixed-content sections** (e.g., 已选篮子 / 文件输入 / 运行设置 / 产物交付) display at their natural content height without compression, and **elastic-content sections** (e.g., 草稿 / 候选池 / 任务列表) absorb remaining space and scroll independently within their allocated slot. The system SHALL NOT compress all sections proportionally when the workbench is taller than the viewport — instead, the user SHALL see fixed sections at full natural height and scroll only within elastic sections.

#### Scenario: User views the daily-report workbench with 6 selected items

- **WHEN** the user has populated `已选篮子` to 6 items and the draft area is filled with 6 sections of long-form content
- **THEN** all 6 selected items SHALL be visible in `已选篮子` without that section requiring its own scroll
- **AND** the draft area SHALL display its first sections immediately, with subsequent sections accessible by scrolling within the draft area only
- **AND** `产物交付` SHALL remain visible at its natural height regardless of the draft length

#### Scenario: User views the translation workbench with the file-input region

- **WHEN** the user opens the translation workbench
- **THEN** the `文件输入` upload region SHALL display at its natural content height
- **AND** the `运行设置` action area SHALL display at its natural content height
- **AND** neither section SHALL be stretched to occupy the full grid track height nor compressed below its natural content height

#### Scenario: Browser viewport is unusually short (e.g., 800px tall) and total content exceeds available space

- **WHEN** the total height required by all fixed-content sections exceeds the available main-column height
- **THEN** the main column SHALL provide its own vertical scroll as a fallback
- **AND** individual fixed-content sections SHALL still preserve their natural content height when scrolled into view (no proportional compression)

#### Scenario: User scrolls within the elastic section while looking at fixed-content sections

- **WHEN** the user scrolls within `草稿` (elastic) or `任务列表` (elastic)
- **THEN** the scroll position of fixed-content sections (`已选篮子`, `产物交付`, `文件输入`, `运行设置`) SHALL NOT change
- **AND** the workbench shell navigation (topbar, sidebar, progress bar) SHALL remain visible per the existing `Workbench shell preserves persistent navigation` requirement

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

### Requirement: console-shell 视觉遵循企业控制台(百炼)设计令牌体系

控制台 shell(topbar / sidebar / 可折叠导航 / utility rail)SHALL 遵循统一的应用级设计令牌(对齐阿里云百炼 / Model Studio 设计语言)。shell 的所有视觉属性(主色与中性色阶、背景、边框、阴影、圆角、间距、字体)SHALL 由集中定义的设计令牌驱动,而非散落硬编码。主色 SHALL 为阿里云/Ant 蓝家族;字体栈 SHALL Chinese-first。该视觉改造 SHALL NOT 改变 shell 的布局与滚动行为——既有「关键导航持续可见」「内容区独立滚动」「section flex 分布」契约 SHALL 完全保留。

#### Scenario: shell 应用统一令牌且选中态清晰

- **WHEN** 任意页面在控制台 shell 内渲染
- **THEN** topbar、sidebar、可折叠子菜单与 utility rail SHALL 取自集中设计令牌
- **AND** sidebar 当前选中项 SHALL 以主色文字 + 主色浅底 + 左侧主色饰条呈现,hover/focus SHALL 有清晰反馈

#### Scenario: 视觉改造不破坏滚动与导航契约

- **WHEN** 视觉改造完成后加载长内容页面(如候选池超出视口)
- **THEN** topbar 与 sidebar SHALL 仍持久可见,内容区 SHALL 仍在自身容器内独立滚动
- **AND** 既有 shell 的 `height` / `overflow` / `sticky` / flex 分布行为 SHALL 与改造前一致

#### Scenario: 仅亮色且满足无障碍

- **WHEN** shell 渲染
- **THEN** SHALL 仅提供亮色主题(无暗色模式)
- **AND** 文字对比度 SHALL ≥ 4.5:1,焦点态 SHALL 键盘可见,`prefers-reduced-motion` 下 SHALL 禁用位移/闪烁动画

