## Why

[fix-workbench-scroll-architecture](../2026-06-18-fix-workbench-scroll-architecture/proposal.md)(尚未归档)把工作台从全局滚动改为 viewport 锁定 + 局部滚动,topbar / sidebar 持续可见,这是一次成功的架构改造。但这次改造引入了一个**反作用力**:section 之间的高度由 flex 自动分配,默认 `flex-shrink: 1` 让所有子 section 一起按比例**被压缩**。

具体表现(用户实际反馈):
- **国际日报**:已选篮子(短内容,6 条候选)和草稿区(长内容,6 段)、产物交付(短内容)在主列里**一起被压缩**,已选篮子原本只需 ~280px 显示 6 条记录,现在被强制收缩到看不清
- **翻译处理**:文件输入(短内容,upload-console)和运行设置(短内容,几个按钮)在双列网格里**被强制 stretch 到一样高**,但内部子元素(upload-console / button)被 flex 压缩

**根因**:`flex-shrink: 1` 是 flex 子元素默认值,在外层容器空间不够时所有子元素一起按比例收缩;`grid` 子元素默认 `align-items: stretch`,在 grid track 用 auto 时会让短内容被强制拉到与长内容同高(从而内部被压缩)。

**修复方向**:给 section 分级 — 短/固定内容(已选篮子 / 文件输入 / 运行设置 / 产物交付)`flex-shrink: 0` 按内容自然展开;长/弹性内容(草稿 / 任务列表 / 候选池)`flex: 1 1 0; overflow-y: auto` 占剩余空间并独立滚动。

不修这条,所有视觉刷新工作都会受 section 压缩干扰;并且这是用户在使用层面立刻能感知的问题——记者盯着已选篮子做选择时,看不全 6 条意味着每次操作都得人工滚动。

## What Changes

- 修订 [apps/web/app/globals.css](../../../apps/web/app/globals.css):**给工作台 section 分级 flex 权重**,短内容不收缩,长内容占剩余空间并独立滚动
  - **国际日报主列** `.report-main-column` 三 section 分级:
    - `.selected-zone`(已选篮子)→ `flex: 0 0 auto`,按 6 条候选 + 操作按钮自然高度展开
    - `.report-main-column .console-section:not(.selected-zone)` 草稿区 → `flex: 1 1 0; min-height: 0`(草稿内部已有 `.draft-zone-body` overflow,自身可滚动)
    - 产物交付(最后一个 console-section)→ `flex: 0 0 auto`,内容很短按需展开
  - **国际日报侧列** `.report-side-column` 候选池:候选池容器 `flex: 1 1 0`,内部候选 list `overflow-y: auto`(已存在)
  - **翻译双列** `.translation-layout > .console-section` 改为不滚动 + `display: flex; flex-direction: column`,内部子元素分级:
    - 短内容(upload-console / action-stack / button-row)→ `flex: 0 0 auto`
    - 长内容(任务列表 / runtime-log / process-insight 等需自身滚动的子区域)→ `flex: 1 1 0; min-height: 0; overflow-y: auto`
  - **`.translation-layout` 加 grid-template-rows: minmax(0, 1fr)**,确保双列被正确锁定到剩余高度,不会因 grid auto-row 撑大父容器
  - **`.report-main-column` / `.report-side-column`** 自身保留 `overflow-y: auto`(超出 flex 总和时主列整体滚动作为兜底)
- 修订 [openspec/specs/workbench-shell-ux/spec.md](../../specs/workbench-shell-ux/) capability,新增 1 条 Requirement:**Workbench section flex distribution preserves natural content density**——明确"短内容 section 按内容自然高度、长内容 section 独立滚动"的契约
- 修订 [apps/web/tests/console-shell-scroll.test.js](../../../apps/web/tests/console-shell-scroll.test.js):新增 4 条用例测试 flex 分配规则,删除"翻译 console-section overflow-y: auto"的旧断言(已不再适用)

## Capabilities

### Modified Capabilities

- `workbench-shell-ux`:在已有"shell 持续可见 + section 独立滚动"基础上,新增"section flex 权重分级"契约 — 短内容按自然高度,长内容自身滚动,避免一起按比例被压缩。

## Impact

- 影响 [apps/web/app/globals.css](../../../apps/web/app/globals.css):预计 +25 / -5 行,核心是给 6 个左右关键 section 加 flex 分级
- 影响 [apps/web/tests/console-shell-scroll.test.js](../../../apps/web/tests/console-shell-scroll.test.js):重写 2 条断言、新增 4 条 flex 分级断言
- 不影响 jsx 结构(零修改)、Prisma schema、API 路由、worker、业务逻辑
- 不引入新依赖
- 不影响 fix-workbench-scroll-architecture 已经做对的滚动架构(本 change 是 polish 而非回滚)
