## Why

国际日报工作台在候选池内容超出 viewport 高度后(实测真实 RSS 采集会产生 200+ 条候选),整个文档会发生**全局滚动**:用户向下滚动时,**topbar(品牌 + 帮助 + 用户名)**和**sidebar(主导航)**都会一起被滚出屏幕,完全失去导航能力。这是 [stabilize-candidate-pool-fixture-supply](../archive/2026-06-17-2026-06-15-stabilize-candidate-pool-fixture-supply/proposal.md) 与 [build-candidate-pool-real-collector](../archive/2026-06-18-2026-06-18-build-candidate-pool-real-collector/proposal.md) 上线后才暴露的真实问题——之前 fixture 是 25 条左右,内容刚好不撑出 viewport。

根因在 [apps/web/app/globals.css:36-40](../../../apps/web/app/globals.css):
- `.console-shell` 用 `min-height: 100vh` + grid,**没有任何容器是固定高度**
- `.console-topbar` 不是 `position: sticky`,会跟随文档滚动
- `.console-sidebar` 是 grid 第一列,主区候选池高度撑大它也跟着撑大,出现"侧边栏跟着下拉"的视觉问题

这不是一个 bug 修复,而是**架构层面的 UX 契约确立**:工作台 shell 必须保证关键导航在任何内容尺寸下持续可见,工作台内的不同区域必须各自独立滚动。这条契约也将作为后续所有工作台视觉改造、键盘快捷键、流式 AI 反馈等 UX 优化的物理基础。

## What Changes

- 新增 capability `workbench-shell-ux`,定义工作台 shell 的 UX 契约。首批 2 条 Requirement:**关键导航持续可见** + **工作台内容区独立滚动**。后续视觉刷新 / 键盘快捷键 / 流式反馈等 UX 改动都挂在此 capability 下。
- 修订 [apps/web/app/globals.css](../../../apps/web/app/globals.css) 的 layout 系统,将全局滚动改为局部滚动:
  - `.console-shell` 由 `min-height: 100vh` 改为 `height: 100vh; overflow: hidden`
  - `.console-topbar` 加 `position: sticky; top: 0; z-index: 10`
  - `.console-sidebar` 限定 `height: calc(100vh - 56px); overflow-y: auto`(sidebar 内部独立滚动,内容也不撑出 viewport)
  - `.console-content` 限定 `height: calc(100vh - 56px); overflow: hidden`(主内容区不直接滚动,留给子区域)
  - `.console-stage` 内 `.utility-rail` 也跟着 sticky
- 修订 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) 配合的 CSS:
  - `.report-console` 内的 4 个 `.console-section`(候选池 / 已选篮子 / 正文草稿 / 产物交付)各自获得 `overflow-y: auto` + `max-height` 约束,**独立局部滚动**
  - `.report-progress-bar` 加 sticky,任意区域滚动时进度条始终在顶部可见
- 修订 [apps/web/components/translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx) 同样模式:`.translation-layout` 子区域独立滚动,顶部 metric 卡片 sticky
- 不动 console-shell.jsx 的结构(只改 css 与必要的 className 添加),**不引入新依赖**,**不影响既有业务逻辑**(候选池兜底 / 起草 / 编辑 / 导出 / 翻译 等运行时全部保留)
- 新增 `apps/web/tests/console-shell-scroll.test.js` 验证关键 className 与 sticky 行为(只校验 DOM 结构 + 计算样式;CSS 真实滚动行为留给手工 / e2e)

## Capabilities

### New Capabilities

- `workbench-shell-ux`:工作台 shell 的 UX 契约——关键导航持续可见、工作台内容区独立滚动。是 v1 console shell 之后的 UX 治理基线,后续视觉 / 交互优化挂钩此 capability。

## Impact

- 影响 [apps/web/app/globals.css](../../../apps/web/app/globals.css):layout 系统重写(预计 +40 / -10 行,核心是 height + overflow + sticky 的语义化)
- 影响 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx):增加 wrapper className 让子区域可被 css 局部滚动选中(不动业务逻辑)
- 影响 [apps/web/components/translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx):同上
- 新增 [apps/web/tests/console-shell-scroll.test.js](../../../apps/web/tests/) 测试用例
- 新增 [openspec/specs/workbench-shell-ux/spec.md](../../specs/workbench-shell-ux/) capability spec
- 不影响 Prisma schema、API 路由、worker、起草 / 编辑 / 导出业务逻辑、候选池兜底、翻译模块。
- 不影响响应式断点设计(mobile/tablet 适配留给后续 change `workbench-shell-responsive`)。
- 不引入键盘快捷键(留给后续 change `workbench-keyboard-flow`)。
