## Why

当前控制台只有「工作台 / 管理」两个扁平导航分组([apps/web/components/console-shell.jsx:10-25](../../../apps/web/components/console-shell.jsx)),全部聚焦在「生产」侧(翻译处理、日报成稿)。产品还需要一个并列的「消费 / 洞察」入口——**舆情速览**:让用户从总览、每日舆情、情感倾向三个角度快速查看舆情态势。

这一步先把**信息架构与导航骨架**立起来(模块分组 + 可折叠子菜单 + 各条目的占位页),让后续每个分析页面有稳定的路由与导航锚点可以挂靠;真实的分析能力(情感引擎、正负面分类、趋势图表)留作后续 change 逐页填充。

## What Changes

- 在左侧 sidebar 新增**「舆情速览」导航模块**,与现有「工作台」「管理」分组**并列**,始终可见。模块内部结构按设计稿组织:
  - **舆情总览**(独立条目,模块首页)
  - **每日舆情**(可折叠子分组)→ 正负面舆情 / 每日舆情 / 趋势与占比
  - **情感倾向**(可折叠子分组)→ 今日情感分析 / 任意时间段情感分析
- 为 sidebar 引入**可折叠嵌套子分组**渲染能力。现有 sidebar 只支持「分组标题 + 扁平链接列表」,本次新增「分组标题 → 可展开/收起的子分组(带 chevron)→ 子条目」这一层级,且默认展开状态可控、键盘可达。
- 为模块内每个条目新增**占位页(route shell)**:统一的页面骨架(沿用 `ConsoleShell` 的 eyebrow/title/description + 空状态提示「功能建设中」),保证点击任一导航项都能落到一个真实路由,而非 404。
- 不改动现有「工作台 / 管理」分组的内容与行为;不改动 topbar 顶部导航 tab;不引入任何分析后端、API、数据模型或图表依赖(占位页不取数)。

## Capabilities

### New Capabilities

- `public-opinion-overview`:舆情速览模块的信息架构与导航契约——定义模块的分组层级(总览 / 每日舆情 / 情感倾向)、各条目对应的路由与占位页,以及该模块与「工作台」在 sidebar 中并列、持续可见的关系。后续每个舆情分析页面(正负面、趋势、情感分析等)的真实实现都挂在此 capability 下。

### Modified Capabilities

- `workbench-shell-ux`:sidebar 导航从「扁平分组」扩展为支持「可折叠嵌套子分组」。新增一条 Requirement 约束可折叠子分组的渲染与交互(展开/收起、当前项高亮、键盘可达、折叠态下仍保留导航语义),并明确其受既有「关键导航持续可见」「sidebar 内部独立滚动」契约约束。

## Impact

- 影响 [apps/web/components/console-shell.jsx](../../../apps/web/components/console-shell.jsx):`navigationGroups` 数据结构扩展以支持嵌套子分组;sidebar 渲染逻辑增加可折叠子分组分支(预计 +60 行,不改动既有扁平分组路径)。
- 影响 [apps/web/app/globals.css](../../../apps/web/app/globals.css):新增可折叠子分组相关样式(chevron、子条目缩进、展开/收起过渡),复用既有 `.nav-group` / `.nav-item` 体系。
- 影响 [apps/web/src/icons.jsx](../../../apps/web/src/icons.jsx):为舆情速览各条目新增图标 case(总览/每日舆情/情感倾向等)。
- 新增路由 / 占位页(Next.js app router),位于 `apps/web/app/public-opinion/` 下,覆盖 6 个条目对应的 6 个页面。
- 新增 [openspec/specs/public-opinion-overview/spec.md](../../specs/) capability spec;修订 [openspec/specs/workbench-shell-ux/spec.md](../../specs/workbench-shell-ux/) 增加可折叠子分组 Requirement。
- 新增 sidebar 导航结构测试(校验「舆情速览」分组、子分组可折叠、占位页可达)。
- **不影响**:Prisma schema、现有 API 路由、worker、翻译 / 日报业务逻辑、候选池、产物归档、权限管理;不引入新增运行时依赖。
- **非目标**:各舆情分析页面的真实取数与可视化(留作后续逐页 change);响应式 / mobile 适配;topbar 顶部 tab 的联动切换。
