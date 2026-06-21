## Context

控制台 shell([apps/web/components/console-shell.jsx](../../../apps/web/components/console-shell.jsx))目前用一个静态 `navigationGroups` 数组驱动 sidebar:每个 group 是「灰色标题 + 扁平 `nav-item` 链接列表」,链接通过 `resolveHref(item)` 解析(`item.href` 或 `/workbenches/${item.slug}`)。没有任何嵌套或可折叠层级,所有路由要么是 `/workbenches/[slug]`,要么是 `/`、`/artifacts`、`/settings` 等顶层 page。

本次要新增的「舆情速览」模块比现有分组多一层:模块下既有独立条目(舆情总览),又有两个**可折叠子分组**(每日舆情、情感倾向),每个子分组再带 2~3 个子条目。这要求 sidebar 渲染从两层(group → item)扩展到三层(group → subgroup → item),并为子分组引入展开/收起状态。

约束:必须复用既有 `workbench-shell-ux` 契约(关键导航持续可见、sidebar 内部独立滚动),不破坏现有「工作台 / 管理」分组,不引入新依赖。本阶段所有目标页面均为占位页,不取数。

## Goals / Non-Goals

**Goals:**

- 在同一 sidebar 内新增「舆情速览」分组,与「工作台」「管理」并列、持续可见。
- 让 sidebar 支持「可折叠嵌套子分组」这一通用渲染层级(数据驱动,非硬编码 if/else),首个使用者即舆情速览。
- 为 6 个导航条目提供稳定路由 + 统一占位页骨架,点击不 404。
- 子分组交互:可展开/收起、当前页所在子分组默认展开、当前条目高亮、键盘可达(button + `aria-expanded`)。

**Non-Goals:**

- 不实现任何舆情/情感分析的真实取数、计算与图表(后续逐页 change)。
- 不做 mobile / 响应式断点适配。
- 不联动 topbar 顶部 tab(`工作台 / 任务 / 资源池 / 文档`)的切换语义。
- 不持久化子分组展开状态到 localStorage(本阶段用「按当前路由推导默认展开」即可)。

## Decisions

### 决策 1:导航数据结构——给 group item 增加可选 `children`,而非新增并行结构

`navigationGroups[].items[]` 的每个 item 增加可选字段:

```js
// 扁平条目(现状,保持不变)
{ slug, href, title }
// 可折叠子分组(新增)
{ slug, title, icon, children: [ { slug, href, title }, ... ] }
```

渲染时:`item.children` 存在 → 渲染为可折叠子分组(button + chevron + 子 `nav-item` 列表);否则 → 渲染为现有扁平 `nav-item`。

**为什么:** 单一数据结构 + 渲染分支,既不动现有扁平分组的代码路径,又让「舆情速览」自然表达三层结构。**备选**:为舆情速览单独写一套 JSX/组件——被否,会产生两套导航渲染逻辑,后续若其它模块也要折叠则重复。

### 决策 2:展开状态——受控 `useState(Set)`,默认展开「当前 active 条目所在子分组」

子分组展开态存在 `console-shell.jsx` 的 `useState` 里(一个记录已展开 subgroup slug 的 Set)。初始值由当前 `activeSlug` 反查:active 条目所属子分组默认展开,其余收起。

**为什么:** 用户进入某舆情页面时,该页面所在子分组应自动展开以提供上下文;符合既有 sidebar「当前项高亮」的心智。**备选**:全部默认展开 / 全部默认收起 / localStorage 持久化——本阶段都属过度设计,留作后续。

### 决策 3:路由布局——`apps/web/app/public-opinion/` 下按 IA 嵌套

| 导航条目 | 路由 |
|---|---|
| 舆情总览 | `/public-opinion` |
| 每日舆情 · 正负面舆情 | `/public-opinion/daily/polarity` |
| 每日舆情 · 每日舆情 | `/public-opinion/daily` |
| 每日舆情 · 趋势与占比 | `/public-opinion/daily/trends` |
| 情感倾向 · 今日情感分析 | `/public-opinion/sentiment/today` |
| 情感倾向 · 任意时间段情感分析 | `/public-opinion/sentiment/range` |

每个 page 复用 `ConsoleShell`,传入对应 `activeSlug` / `eyebrow` / `title` / `description`,正文渲染统一的「功能建设中」空状态。

**为什么:** 路由层级镜像导航 IA,后续逐页填充真实内容时路由稳定不变。**备选**:扁平路由 `/public-opinion/polarity` 等——被否,丢失 daily/sentiment 的归属语义。

### 决策 4:`activeSlug` 标识——子条目用唯一 slug,active 同时驱动「高亮 + 默认展开」

每个子条目分配全局唯一 slug(如 `po-daily-polarity`、`po-sentiment-today`),page 传入对应 slug 作为 `activeSlug`。`console-shell` 据此高亮条目,并反查其父子分组以决定默认展开。

**为什么:** 沿用现有 `item.slug === activeSlug` 高亮机制,无需新增标识体系。

## Risks / Trade-offs

- **[渲染分支让 console-shell 复杂度上升]** → 子分组渲染抽成一个局部函数/小组件,扁平分支保持原样,二者互不耦合;用导航结构测试锁定两条路径。
- **[占位页与未来真实页面的路由/slug 若不一致会导致后续返工]** → 在 design 与 spec 中固化路由表与 slug 命名,作为后续逐页 change 的契约。
- **[可折叠子分组与既有「sidebar 内部独立滚动」契约的高度交互]** → 展开多个子分组撑高 sidebar 时,依赖既有 `workbench-shell-ux` 的 sidebar `overflow-y: auto` 局部滚动兜底,不引入新滚动容器。
- **[图标缺失导致 `Icon` 渲染空白]** → 为每个新 slug 在 [icons.jsx](../../../apps/web/src/icons.jsx) 补 case,测试覆盖图标 case 存在性。

## Migration Plan

纯增量、可直接上线:新增路由与 sidebar 分组对既有页面零影响。回滚 = 移除「舆情速览」分组数据 + `public-opinion/` 路由目录,无数据迁移、无 schema 变更。建议分两步落地:① 导航数据结构 + 可折叠渲染 + 样式;② 6 个占位页路由。两步均可独立验证。

## Open Questions

- 各条目图标具体取哪个图形(总览/每日舆情/情感倾向)——可先用占位图标,视觉细化留作后续。
- 「每日舆情」子分组下同名条目「每日舆情」的最终措辞是否调整(与子分组标题重名)——按设计稿暂保持原样,实现时如确认重名歧义再定。
