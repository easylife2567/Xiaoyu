## ADDED Requirements

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
