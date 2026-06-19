## 1. 国际日报主列 section 分级

- [x] 1.1 在 [apps/web/app/globals.css](../../../apps/web/app/globals.css) 给 `.report-main-column > .selected-zone` 加 `flex: 0 0 auto`(已选篮子按内容自然展开,6 条候选不被压缩)
- [x] 1.2 给 `.report-main-column > .console-section:not(.selected-zone):not(:last-child)`(草稿区)加 `flex: 1 1 0; min-height: 0; overflow-y: auto`(占剩余空间 + 自身滚动)
- [x] 1.3 给 `.report-main-column > .console-section:last-child`(产物交付)加 `flex: 0 0 auto`(按内容自然展开)
- [x] 1.4 保留 `.report-main-column` 自身 `overflow-y: auto`(极端场景兜底)

## 2. 国际日报侧列(候选池)分级

- [x] 2.1 在 [apps/web/app/globals.css](../../../apps/web/app/globals.css) 给 `.report-side-column > .candidate-zone` 加 `flex: 1 1 0; min-height: 0; display: flex; flex-direction: column`(候选池占满整个侧列高度)
- [x] 2.2 候选池内部 list 的 `overflow-y: auto` 已存在,本期无需新增

## 3. 翻译工作台双列分级

- [x] 3.1 删除 `.translation-layout > .console-section` 原 `overflow-y: auto`(误判),改为 `display: flex; flex-direction: column; min-height: 0`,并保留 `overflow-y: auto` 作为兜底
- [x] 3.2 给 `.translation-layout` 加 `grid-template-rows: minmax(0, 1fr)`(锁定双列高度)
- [x] 3.3 给 `.translation-layout > .console-section > header` 加 `flex: 0 0 auto`
- [x] 3.4 给 `.translation-layout .upload-console` 加 `flex: 0 0 auto`
- [x] 3.5 给 `.translation-layout .action-stack, .translation-layout .button-row` 加 `flex: 0 0 auto`
- [x] 3.6 兜底已包含在 3.1 的 `overflow-y: auto`

## 4. 翻译工作台 console-subsection 分级

- [x] 4.1 给 `.translation-layout .console-subsection` 加 `flex: 0 0 auto`(默认按内容自然展开)
- [ ] 4.2 (可选)`.runtime-log` / `.process-insight` 自身滚动:暂不做,等用户报告再加

## 5. 测试更新

- [x] 5.1 修改 [apps/web/tests/console-shell-scroll.test.js](../../../apps/web/tests/console-shell-scroll.test.js) 的"翻译工作台双列"断言:不再期待 console-section 直接 overflow-y: auto,改为期待 `display: flex; flex-direction: column; min-height: 0`(同时保留 overflow-y: auto 作兜底)
- [x] 5.2 新增 4 条断言:
  - 国际日报主列短内容 section 不被 flex 压缩(selected-zone + 最后一个 console-section 各 `flex: 0 0 auto`)
  - 国际日报草稿区 `flex: 1 1 0` + `overflow-y: auto`
  - 国际日报候选池 `flex: 1 1 0` 占满侧列
  - 翻译工作台 upload-console / action-stack / console-subsection 各 `flex: 0 0 auto`
- [x] 5.3 串行 `npm test` 全绿(77/77,原 73 + 新增 4)
- [ ] 5.4 dev server 手工验证 4 个场景(交给用户在自己机器上完成,详见 design.md 与 spec scenarios)

## 6. spec 与文档

- [x] 6.1 写明新 Requirement 到 [openspec/changes/2026-06-18-tune-workbench-section-density/specs/workbench-shell-ux/spec.md](specs/workbench-shell-ux/spec.md)
- [x] 6.2 `npx openspec validate 2026-06-18-tune-workbench-section-density --strict` 通过

## 7. 收尾

- [ ] 7.1 与 [fix-workbench-scroll-architecture](../2026-06-18-fix-workbench-scroll-architecture/) 一起归档(详见 design.md R7)
- [ ] 7.2 commit 信息链回本 change
- [ ] 7.3 归档时由用户执行 `npx openspec archive 2026-06-18-tune-workbench-section-density`
