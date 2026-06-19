## 1. CSS 根容器架构改造

- [x] 1.1 在 [apps/web/app/globals.css](../../../apps/web/app/globals.css) 修改 `.console-shell`:`min-height: 100vh` → `height: 100vh; overflow: hidden`,grid-template-rows 引用 `var(--shell-topbar-height)`
- [x] 1.2 修改 `.console-topbar`:加 `position: -webkit-sticky / sticky; top: 0; z-index: 10`,确保顶部锚定
- [x] 1.3 修改 `.console-sidebar`:`min-height calc(100vh - 56px)` → `height: 100%; min-height: 0; overflow-y: auto; overflow-x: hidden`,内部独立滚动
- [x] 1.4 修改 `.console-content`:`min-height calc(100vh - 56px)` → `height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden`,工作台主体子区域 `flex: 1 1 0; min-height: 0; overflow: hidden`
- [x] 1.5 修改 `.console-stage`:加 `height: 100%; min-height: 0; overflow: hidden`(`.utility-rail` 已有 `position: absolute`,不需要 sticky)

## 2. 国际日报工作台局部滚动

- [x] 2.1 在 [apps/web/app/globals.css](../../../apps/web/app/globals.css) 给 `.workspace-grid, .report-console` 公共规则加 `height: 100%; min-height: 0; overflow: hidden`;给 `.report-console` 加 `grid-template-rows: auto auto auto minmax(0, 1fr)`(对齐 jsx 显式 `grid-row: 4` 用法)
- [x] 2.2 `.report-progress-bar` 加 `position: -webkit-sticky / sticky; top: 0; z-index: 5; background: #fff`,工作台任意场景下进度条始终在工作台顶部可见;**不需要在 jsx 加 className**(已经是 `report-progress-bar`)
- [x] 2.3 `.report-main-column` / `.report-side-column` 各自加 `min-height: 0; overflow-y: auto; overflow-x: hidden`,**双列各自独立局部滚动**(已选篮子/草稿/产物交付在主列内、候选池在侧列内,各自滚动互不影响)
- [x] 2.4 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) **不需要加 distinguishing className**:本 change 选择"双列各自滚动"模式(min-column 整体 overflow-y: auto),所有 section 在所属列内自然排列,无需为草稿 / 产物交付增加专属 css 控制点。后续 v2 视觉刷新若需更细粒度滚动,再单独动 jsx

## 3. 翻译处理工作台局部滚动

- [x] 3.1 在 [apps/web/app/globals.css](../../../apps/web/app/globals.css) 给 `.workspace-grid / .report-console / .translation-layout` 应用 `height: 100%; min-height: 0; overflow: hidden`(同 2.1)
- [x] 3.2 在同文件给 `.translation-layout > .console-section` 加 `display: flex; flex-direction: column; min-height: 0; overflow-y: auto; overflow-x: hidden`,主工作区 / 侧工作区各自独立滚动;**不需要改 [translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx)**
- [x] 3.3 给 `.console-content > .workflow-status` 加 `flex: 0 0 auto; position: -webkit-sticky / sticky; top: 0; z-index: 5; background: #fff`,翻译工作台滚动时状态栏始终在顶部可见

## 4. CSS 变量与防御

- [x] 4.1 在 [apps/web/app/globals.css](../../../apps/web/app/globals.css) `:root` 加 `--shell-topbar-height: 56px` 与 `--shell-body-height: calc(100vh - var(--shell-topbar-height))`;后续工作台几何统一引用变量
- [x] 4.2 在 `.console-topbar` / `.console-content > .workflow-status` / `.report-progress-bar` 给 sticky 加 `-webkit-sticky` 兼容
- [x] 4.3 `.sidebar-nav` 的 padding 由 `16px 12px` 改为 `16px 12px 24px`,sidebar 滚到底最后一项不被裁剪

## 5. 测试

- [x] 5.1 新增 [apps/web/tests/console-shell-scroll.test.js](../../../apps/web/tests/console-shell-scroll.test.js),11 个用例:
  - `:root` 变量 / `.console-shell` 锁定 / `.console-topbar` sticky / `.console-sidebar` 独立滚动 / `.console-stage` & `.console-content` 局部滚动
  - `.report-console` 4-row grid + 双列局部滚动 / `.report-progress-bar` sticky
  - 翻译工作台双列局部滚动 / `.workflow-status` sticky
  - SSR 渲染保留所有关键 className(国际日报 + 翻译两个工作台分别测)
- [x] 5.2 既有 7 个 daily-report / 6 个 translation 业务测试无需改动(纯 CSS 重构不影响业务逻辑),实测保持通过
- [x] 5.3 `npm test` 全绿(73/73,原 62 + 新增 11);`next build` 通过
- [ ] 5.4 dev server 手工验证 6 个滚动场景(交给用户在自己机器上完成,详见 design.md R5)

## 6. 文档

- [x] 6.1 [README.md](../../../README.md) 不需要改动(用户使用方式不变)
- [x] 6.2 `npx openspec validate 2026-06-18-fix-workbench-scroll-architecture --strict` 通过
- [ ] 6.3 (可选)在归档后于 README 项目结构里登记一句"工作台 UX 契约"——用户决定是否补

## 7. 收尾

- [ ] 7.1 PR 描述里附 4 张截图:改动前/后、候选池滚到底、多 viewport 对比 — 由用户在 PR 阶段补
- [ ] 7.2 commit 信息链回本 change
- [ ] 7.3 归档时由用户执行 `npx openspec archive 2026-06-18-fix-workbench-scroll-architecture`
