# Design — fix-workbench-scroll-architecture

## R1. 为何创建独立 capability `workbench-shell-ux`

工作台前端的 UX 契约目前散落在多个业务 capability 里(daily-report-workflow、translation-task-runtime 等),并且 v1 workbench shell 的归档 change 没有为 shell 自身建立 spec。**滚动架构、键盘流、视觉规范** 这类**跨业务、跨工作台的 UX 治理约束**应该独立成 capability,理由:

1. **不污染业务 spec**。daily-report-workflow 描述"用户选 6 条 → AI 起草 → 导出"的业务语义,不应混入"sidebar 必须 sticky"这种 UX 实现约束。
2. **后续多个 UX change 有挂钩点**。视觉刷新、键盘快捷键、流式 AI 反馈、错误状态文案、响应式适配,都会修改这个 capability 的 Requirement 集合,而不是动业务 spec。
3. **跨工作台一致性**。国际日报、翻译处理、未来的国内日报、行业日报,都应共享同一套 shell UX 契约,而不是各自演化。

不放在 `system-architecture` 是因为后者是技术架构(进程边界、数据存储),不是用户体验。

## R2. 为何选"局部滚动"而不是"虚拟列表 / 分页"

候选池有 200+ 条候选时,有 3 种技术路线:

- **A. 虚拟列表(react-window / react-virtual)**:渲染窗口内可见行,性能最好。但需要引入新依赖,与现有"零 UI 依赖"风格冲突,且会改变 candidate-row 的 DOM 结构(对外暴露的 DOM API 会变),触发其他组件的连锁修改。
- **B. 分页 / 加载更多**:每次只显示 N 条,有"上一页/下一页"。改动小,但对挑选 6 条的用户场景反而更慢——因为记者要在不同候选间反复切换比较,翻页打断流程。
- **C. 局部滚动 + 不限渲染数**(本 change 选择):候选池容器自身 `overflow-y: auto`,主页面不滚动。所有候选都渲染在 DOM 里,但只有候选池容器内可见;sidebar / topbar / 其他工作区不被影响。性能在 200~500 条范围内充分够用(候选池的 DOM 节点数 ~5K,远低于浏览器渲染瓶颈)。

未来候选数超过 500 条时再考虑引入虚拟列表(届时另开 change)。当前的 200~300 条规模,**局部滚动是改动最小、收益最大、风险最低的路线**。

## R3. 滚动架构的几何模型

修复后的 layout 高度模型:

```
viewport (height: 100vh, overflow: hidden)
└── .console-shell (height: 100vh)
    ├── .console-topbar (sticky, top: 0, height: 56px) ─── 永远可见
    └── .console-shell-body (height: calc(100vh - 56px))
        ├── .console-sidebar (height: 100%, overflow-y: auto) ─── 内部独立滚动
        └── .console-stage (height: 100%, overflow: hidden)
            ├── .console-content (overflow: hidden)
            │   ├── .page-heading (常驻顶部)
            │   ├── .report-progress-bar (sticky, top: 0)
            │   └── .report-console / .translation-layout (height: 100%; grid)
            │       ├── .console-section.candidate-zone (overflow-y: auto)
            │       ├── .console-section.selected-zone (overflow-y: auto)
            │       ├── .console-section.draft-zone (overflow-y: auto)
            │       └── .console-section.delivery-zone (overflow-y: auto)
            └── .utility-rail (sticky)
```

**关键约束**:

- 每一层有且仅有一处 `overflow-y: auto`(`auto` 而非 `scroll`,避免空内容时强制出现滚动条)
- 每一层有明确的 `height` 来源(`100vh`、`calc(100vh - 56px)`、`100%`),不依赖 `min-height`
- `position: sticky` 仅用于真正需要"内部滚动时锚定"的元素,不滥用以避免 z-index 复杂度

## R4. CSS 改造的最小破坏面

不能保证"全部测试覆盖到"的纯 CSS 改动,要把破坏面降到最小。我的策略:

1. **先动 .console-shell / .console-topbar / .console-sidebar / .console-stage 这 4 个 root 容器的 height + overflow + sticky**——这是必要且充分的,改完之后已经能解决用户报告的"sidebar 跟着下拉"问题。
2. **再动 .report-console / .candidate-zone 等子区域**—— 这一步让候选池区域内独立滚动,提升体验。
3. **不动现有 className 命名**——只在必要处加 className(例如把 `.report-console` 内的 `header` 区域 class 化为 `.report-progress-bar`,以便加 sticky 而不影响其他 `header`)。
4. **不动响应式断点**——现有 `@media (max-width: ...)` 的简单堆叠保持不变,移动端的 sticky 行为先沿用,后续 change 单独优化。

## R5. 测试策略

CSS 滚动行为难以做单元测试。我采用 3 层测试:

- **DOM 结构 + className 测试**(`apps/web/tests/console-shell-scroll.test.js`):用 `node:test` + DOM 库验证 root 容器、子区域的 className 应用正确,sticky / overflow 类被加到对的 element 上。
- **手工 viewport 测试**:dev server 起来后,把候选池数量人工撑到 200+(用 fixture 或开发期 mock),滚动 6 个场景:
  1. 候选池滚到底,sidebar / topbar 仍可见
  2. sidebar 滚到底,topbar 仍可见
  3. 候选池滚到底切到草稿区,草稿独立滚动不串
  4. 草稿滚动时候选池保持位置
  5. 控制台缩放(浏览器 zoom 50% / 150%),布局不破坏
  6. 全屏 → 800px 高度切换,无横向滚动条
- **e2e (Playwright) 留给未来**:本 change 不引入,测试成本太高。

## R6. 工作台特定 section 的滚动设计

### 国际日报 ([daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx))

| section | 滚动行为 | sticky 元素 |
|---|---|---|
| `.candidate-zone` | 独立 `overflow-y: auto` | header(标题 + 已选 N/6 计数)|
| `.selected-zone` | 独立 `overflow-y: auto` | header + 主操作按钮 |
| `.draft-zone`(`.console-section.console-section--draft`) | 独立 `overflow-y: auto` | 段落计数 / 编辑提示 |
| `.delivery-zone` | 内容少,通常不滚 | — |

进度条 `.report-progress-bar` sticky 在 `.console-content` 顶部。

### 翻译处理 ([translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx))

布局类似但 section 不同:`.workspace-grid` 是双列 metric + 任务列表,任务列表加 `overflow-y: auto`,metric 列保持原样(内容不长)。

## R7. 不在本期范围

- **响应式 / 平板**:`@media` 断点优化、平板侧滑抽屉等留给 `workbench-shell-responsive` change。
- **键盘流**:J/K 候选池导航、Cmd+Enter 起草等,留给 `workbench-keyboard-flow` change。
- **视觉刷新 v2**:字号 / 间距 / 卡片层级,留给 `workbench-visual-refresh-v2` change。
- **微互动**:hover / 加载 skeleton / 流式输出,留给后续。
- **虚拟列表**:候选池 DOM 性能暂不需要,等候选池数量稳定超过 500 条再考虑。

## R8. 风险与回滚

- **风险**:CSS 局部滚动在某些浏览器(主要是 Safari 旧版本 < 15)对 `position: sticky` 的实现有 quirk,可能导致 sticky 不工作。**应对**:加 `-webkit-sticky`(虽然现在大部分都已支持原生 `sticky`),并在 README 注明最低浏览器版本。
- **风险**:`overflow: hidden` 可能造成某些 dropdown / popover 被裁剪。**应对**:本 change 仅 toolbar 没有 popover,不会立即受影响;后续如果加 popover,改用 `floating-ui` / portal 渲染避免。
- **回滚**:CSS 改动是单文件、可还原的。git revert 1 个 commit 即可回到改动前。
