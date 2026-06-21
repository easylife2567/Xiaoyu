## 1. 导航数据结构与可折叠渲染(workbench-shell-ux)

- [x] 1.1 在 [console-shell.jsx](../../../apps/web/components/console-shell.jsx) 的 `navigationGroups` 中新增「舆情速览」分组,并采用支持 `children` 的条目结构:`舆情总览`(独立条目)+ `每日舆情`(含 children)+ `情感倾向`(含 children),slug/href/title 按 design 路由表填写
- [x] 1.2 扩展 sidebar 渲染:抽出子分组渲染分支,`item.children` 存在时渲染为「带 chevron 的可折叠标题行 + 子条目列表」,否则保持既有扁平 `nav-item` 渲染路径不变
- [x] 1.3 实现展开/收起受控状态(`useState` 记录已展开子分组 slug 集合),初始值由当前 `activeSlug` 反查所属子分组并默认展开
- [x] 1.4 子分组标题行用 `button` + `aria-expanded` 实现,保证键盘可达;当前子条目按既有 `item.slug === activeSlug` 机制高亮
- [x] 1.5 在 [globals.css](../../../apps/web/app/globals.css) 新增子分组样式(chevron 指示、子条目缩进、展开/收起过渡),复用既有 `.nav-group` / `.nav-item` 体系,不引入新滚动容器
- [x] 1.6 在 [icons.jsx](../../../apps/web/src/icons.jsx) 为舆情速览各 slug 新增图标 case(总览 / 每日舆情 / 情感倾向 / 各子条目),缺省回退到占位图标

## 2. 占位页路由(public-opinion-overview)

- [x] 2.1 在 `apps/web/app/public-opinion/` 下创建模块首页 `page.jsx`(舆情总览,`/public-opinion`),复用 `ConsoleShell` + 「功能建设中」空状态
- [x] 2.2 创建每日舆情子条目占位页:`daily/page.jsx`(每日舆情)、`daily/polarity/page.jsx`(正负面舆情)、`daily/trends/page.jsx`(趋势与占比)
- [x] 2.3 创建情感倾向子条目占位页:`sentiment/today/page.jsx`(今日情感分析)、`sentiment/range/page.jsx`(任意时间段情感分析)
- [x] 2.4 每个 page 传入与导航一致的 `activeSlug` / `eyebrow` / `title` / `description`,验证点击导航条目可达对应页面且当前项高亮、所属子分组默认展开

## 3. 测试与验证

- [x] 3.1 新增 sidebar 导航结构测试:校验「舆情速览」分组存在且与「工作台」「管理」并列、两个子分组可折叠(`aria-expanded` 切换)、既有扁平分组渲染不变
- [x] 3.2 测试默认展开逻辑:给定某子条目为 active 时其父子分组默认展开、其余子分组收起
- [x] 3.3 校验 6 个占位路由均可达(非 404)且在 `ConsoleShell` 内渲染、当前条目高亮
- [x] 3.4 运行既有测试套件确认工作台 / 翻译 / 日报 / 产物归档 / 权限管理无回归
- [x] 3.5 手动验证:展开多个子分组撑高 sidebar 时走 sidebar 局部滚动,topbar 与导航持续可见(符合 workbench-shell-ux 契约)

## 4. 收尾

- [x] 4.1 运行 `openspec validate add-public-opinion-overview-nav --strict` 确认 spec/任务无结构错误
- [x] 4.2 自检 design 路由表与实际实现一致,确认非目标(真实取数 / 图表 / 响应式 / topbar 联动)未被夹带实现
