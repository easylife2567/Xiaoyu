# Design — tune-workbench-section-density

## R1. 为何 flex-shrink: 0 而不是 max-height

让短内容 section 不被压缩有两条技术路线:

- **A. 显式 max-height 限制每个 section 高度**(例如 `.selected-zone { max-height: 320px }`)
- **B. flex 分级,让短内容 `flex: 0 0 auto`,长内容 `flex: 1 1 0; overflow-y: auto`**(本 change 选择)

A 路线的问题:
- 6 条候选的高度依赖字体、行高、padding,固定 max-height 容易溢出或留空白
- 不同视口下需要不同 max-height,会引入大量响应式断点
- 长草稿仍然挤压短 section,根因没解决

B 路线优势:
- 短内容自动用其内容的"自然高度",视觉一致
- 长内容(草稿 / 任务列表)显式占满剩余空间并独立滚动
- 是 flex 容器的"标准"分级方法,代码量小,可推广到所有工作台
- 与 fix-workbench-scroll-architecture 的"局部滚动"哲学一致

## R2. 主列与侧列的 overflow 兜底策略

国际日报主列 `.report-main-column` 经过本 change 改造后:

- 短内容(已选篮子 + 产物交付)`flex: 0 0 auto` 按内容
- 长内容(草稿)`flex: 1 1 0; overflow-y: auto`(自身滚动)

理论上,主列总高度 ≥ 短内容总和,长内容自身滚动覆盖剩余。**但极端情况下**(浏览器窗口很矮、已选篮子有 6 条 + 操作按钮 + 产物交付 = 总和 > 主列高度),怎么办?

**保留 `.report-main-column` 自身 `overflow-y: auto` 作为兜底**:
- 正常情况:子元素 flex 分配 + 草稿独立滚动,主列不出现滚动条
- 极端情况:子元素总和超过主列高度,主列整体滚动(虽然不优,但比裁剪强)

这是"两层防御"的设计:第一层是 flex 分级让常规场景无压缩,第二层是主列 overflow 让极端场景仍可访问完整内容。

## R3. 草稿区独立滚动的细节

草稿区 (`.report-main-column .console-section:not(.selected-zone)` 中的草稿那一个,即 [daily-report-workbench.jsx:502](../../../apps/web/components/daily-report-workbench.jsx)) 内部有 6 段草稿,内容长。

让草稿区 `flex: 1 1 0; min-height: 0; overflow-y: auto`:
- `flex: 1 1 0` = `flex-grow: 1; flex-shrink: 1; flex-basis: 0` —— 占剩余空间,基础大小为 0(不被自身内容撑大)
- `min-height: 0` —— 允许 flex 子元素收缩到比自身内容还小(默认 `min-height: auto` 会等于内容大小)
- `overflow-y: auto` —— 内容超出时滚动

但草稿区的 header(`<header><h2>正文草稿</h2></header>`)在 section 内,要不要单独 sticky?**本 change 不做**:草稿区已经是局部滚动容器,header 在 section 顶部自然可见,sticky 是锦上添花,留给后续视觉刷新。

## R4. 翻译工作台的特殊性

翻译工作台 [translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx) 的结构与国际日报不同 —— `.workspace-grid.translation-layout` **实际有 7 个 grid 子元素**(不是 2 个):

| Grid 占位 | 内容 |
|---|---|
| row 1 col 1 | `.console-section.primary-workspace` 文件输入 |
| row 1 col 2 | `.console-section.side-workspace` 运行设置 + action-stack(按钮) + compact-facts |
| row 2+ col 1/col 2 | 多个 `.console-subsection`(process-insight / empty-state / live-delivery-card / runtime-log)沿 grid auto-flow 自动排列 |

**实施期间踩过的坑**:最初版本给 `.translation-layout` 加了 `grid-template-rows: minmax(0, 1fr)`,试图与国际日报"双列锁定到剩余高度"对齐。但翻译工作台有 5+ 个 console-subsection 沿 implicit row 排列,锁单行 1fr 会让 **row 1 col 2 的 action-stack(包含重试/刷新按钮)被裁剪到看不到**,而 implicit row 的 console-subsection 反而正常显示——表现为"运行设置"标题下方直接显示"结果交付错误诊断",用户看不到操作按钮。

**最终设计**:
- **不要**给 `.translation-layout` 设 `grid-template-rows`,让 grid auto-rows 按内容排列
- `.workspace-grid` 自身 `overflow-y: auto` 作为整体兜底滚动(总内容超出容器时)
- `.translation-layout > .console-section` 是 flex 列,但**不嵌套 overflow**(避免双层滚动条)
- 内部子元素 `.upload-console / .action-stack / .button-row / .console-subsection` 全部 `flex: 0 0 auto`,按内容自然展开

国际日报 `.report-console` 因为只有少数固定 grid 子元素(focus-strip / progress-bar / main-column / side-column),**显式 `grid-template-rows: auto auto auto minmax(0, 1fr)` 是对的**;但不能直接套到翻译工作台。这是这次实施的关键学习。

## R5. 新 spec Requirement 的措辞

"Workbench section flex distribution" 的措辞要避免技术细节(具体 px、具体 selector)而表达**用户行为契约**:

- 用户应能在不滚动的情况下看到"已选篮子"的全部 6 条
- 用户应能在不滚动的情况下看到"文件输入"的完整 upload 区域
- 草稿 / 任务列表内容多时,应在自己的 section 内滚动而不影响其他 section
- 极端窗口(矮 / zoom 高)下,主列整体可滚动作为兜底

这些是产品契约,实现方式(flex / grid / max-height)在 design.md 而非 spec 描述。

## R6. 不在本期范围

- **响应式**:平板/手机的 section 重新堆叠 — 留给 `workbench-shell-responsive`
- **视觉刷新 v2**:字号 / 间距 / 颜色 — 留给 `workbench-visual-refresh-v2`
- **键盘流**:J/K 候选池导航 — 留给 `workbench-keyboard-flow`
- **草稿 section header sticky**:留给 v2 视觉刷新
- **已选篮子的 reorder 动画 / 选中飞过去的微互动**:留给 v2

## R7. 与 fix-workbench-scroll-architecture 的关系

本 change 是 fix-workbench-scroll-architecture 的**直接后继**,两者**应当一起归档** — 单独保留 fix-workbench-scroll-architecture 的归档会让 spec 主线短期内呈现"压缩"问题。建议:

1. 本 change 实施完成、测试通过、用户视觉验证后
2. 同 batch 归档 fix-workbench-scroll-architecture + tune-workbench-section-density
3. workbench-shell-ux capability 一次性补齐 3 条 Requirement
