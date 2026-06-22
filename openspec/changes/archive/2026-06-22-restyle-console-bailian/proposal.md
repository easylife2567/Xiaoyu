## Why

舆情总览看板与整个控制台 shell(topbar / sidebar / utility rail)视觉是临时拼装的:配色硬编码、无统一令牌、层级与密度感弱,不够"产品级"。

本次做**全控制台的纯视觉/交互改造**,对齐**阿里云百炼(Model Studio)控制台**的设计语言——企业级、克制专业、数据密集:建立**应用级设计令牌**(色板 / 中性阶 / 背景 / 边框 / 阴影 / 圆角 / 间距 / 字体),据此重塑 console-shell 框架与舆情总览看板。不改任何布局结构、滚动契约、数据接入与业务逻辑。

## What Changes

- 引入**应用级设计令牌**(globals.css `:root` CSS 变量):阿里云/Ant 主色(`#1677FF` 家族)、中性色阶、页面/卡片背景、边框/分隔、阴影、圆角、间距;Chinese-first 字体栈,数值 `tabular-nums`。令牌全局可用,shell 与各页面共享。
- **console-shell 对齐百炼**:topbar(品牌 / 顶部导航 / 操作区 / 用户 chip)、sidebar(分组标题 / 导航项 / 可折叠子菜单 / 选中与 hover 态)、utility rail 全部改用令牌;选中项用主色、清晰的 hover/active/focus 态、规范分隔与留白。**严格保留** `workbench-shell-ux` 的布局与滚动契约(height/overflow/sticky/局部滚动),仅改视觉(颜色/间距/字体/状态)。
- **舆情总览看板对齐百炼**:KPI 磁贴(大号等宽数字 + 趋势小标 + 轻图标)、统一卡片 chrome、recharts 主题统一(`PO_CHART_THEME`)、加载/空/错态规范;情感 5 模态保留语义色(绿→红)。
- 交互规范:hover/focus 反馈、`cursor:pointer`、过渡 150–300ms、`prefers-reduced-motion` 友好、正文对比度 ≥ 4.5:1。
- 仅亮色(无暗色模式)。仅触视觉层:组件结构、数据流、路由、BFF、鉴权全部不动。

## Capabilities

### Modified Capabilities

- `workbench-shell-ux`:新增"console-shell 视觉遵循企业控制台(百炼)设计令牌体系"的 Requirement,并明确**视觉改造不得破坏既有持久导航 / 局部滚动 / flex 分布契约**。既有滚动与导航可见性 Requirement 不变。
- `public-opinion-dashboard`:新增"看板视觉遵循同一设计令牌体系"的 Requirement(KPI 磁贴 / 卡片 chrome / 图表主题 / 状态视觉)。数据/接入/模块构成 Requirement 不变。

## Impact

- 影响 [apps/web/app/globals.css](../../../apps/web/app/globals.css):`:root` 新增设计令牌;重写 shell 样式(`.console-topbar` / `.console-sidebar` / `.nav-*` / `.utility-rail` 等)与看板样式(`.po-*`)的颜色/间距/字体/状态,改为引用令牌。布局/几何(grid/height/overflow/sticky)不动。
- 影响 [apps/web/components/console-shell.jsx](../../../apps/web/components/console-shell.jsx):仅必要的 className / 结构性微调(如增加饰条容器),不动导航数据与折叠逻辑。
- 影响 [apps/web/components/public-opinion-overview-dashboard.jsx](../../../apps/web/components/public-opinion-overview-dashboard.jsx):className 与 recharts 主题 props 调整,不动数据获取与模块结构。
- 可能微调 [apps/web/app/layout.jsx](../../../apps/web/app/layout.jsx) 字体栈。
- 更新/新增视觉结构测试(令牌类名、图表主题常量);沿用 SSR 范式。守护 workbench-shell-ux 的滚动测试 SHALL 继续通过。
- **不影响**:数据接入、归一化、BFF、鉴权、路由、各页面业务逻辑、Prisma、worker;不影响 workbench-shell-ux 的滚动/导航行为本身。
- **非目标**:暗色模式;新数据模块;日期选择器;翻译/日报工作台内部内容的视觉重做(本次只统一 shell 框架 + 舆情看板;其余页面随 shell 框架受益,内容区精修可后续逐页)。

## Open Questions

- 翻译/日报工作台**内容区**是否本次也精修?默认**否**——本次统一 shell 框架 + 舆情看板内容;其余页面内容区的逐页精修留后续 change(它们会自动继承 shell 与令牌)。
