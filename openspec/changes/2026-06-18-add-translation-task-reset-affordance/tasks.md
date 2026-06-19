## 1. 后端 service 与仓储

- [x] 1.1 在 [apps/web/lib/translation-processing/service.js](../../../apps/web/lib/translation-processing/service.js) 加 `resetTranslationTask(taskId)`,通过 store 门面调 `deleteTask`,返回 `{ ok: true }`,幂等
- [x] 1.2 在 [runtime-repository.js](../../../apps/web/lib/translation-processing/runtime-repository.js) 给 3 个后端(File / Memory / Prisma)各加 `deleteTask(taskId)`;Prisma 后端按依赖顺序删 `translationArtifact` / `translationUpload` / `translationTaskAttempt` / `translationTask`(schema 未声明 onDelete: Cascade)
- [x] 1.3 在 [store.js](../../../apps/web/lib/translation-processing/store.js) 暴露 `deleteTask` facade,统一通过 store 调 repository

## 2. 后端 API 路由

- [x] 2.1 在 [apps/web/app/api/translation-processing/tasks/[taskId]/route.js](../../../apps/web/app/api/translation-processing/tasks/[taskId]/route.js) 加 `DELETE` handler:200 `{ ok: true }`,500 `{ error: '任务重置失败。' }`
- [x] 2.2 不需要 401 / 403(本仓库无 auth 体系)

## 3. 前端按钮与状态机

- [x] 3.1 在 [translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx) 加 `handleResetTask`:`window.confirm` → `fetch DELETE` → `setTask(null) + setHydratedFromCache(false)`;catch 通过 `setError` 复用 inline-error banner
- [x] 3.2 在 `<section className="workflow-status">` 的 header 区右侧加 `<button className="reset-task-button">重置任务</button>`,与 status badge 横向并列
- [x] 3.3 按钮 disable 条件:`!task || busy`;且仅当 `task` 存在时才渲染按钮
- [x] 3.4 retry 按钮位置 / 触发条件不动(留给后续 timeout-detection change 处理)
- [x] 3.5 [globals.css](../../../apps/web/app/globals.css) 加 `.workflow-status-actions` 横向并列样式(沿用既有 `.reset-task-button` 视觉)

## 4. 测试

- [x] 4.1 新增 [apps/web/tests/translation-task-reset.test.js](../../../apps/web/tests/translation-task-reset.test.js),7 个用例:
  - reset ready / processing(retry 不可达)/ failed 三种状态的任务
  - reset 不存在的 taskId 幂等返回 ok
  - DELETE 路由 200 响应 + body { ok: true }
  - DELETE 路由对不存在任务幂等
  - reset 后可重建任务,新旧 ID 独立
- [x] 4.2 既有 [translation-processing-service.test.js](../../../apps/web/tests/translation-processing-service.test.js) 不动
- [x] 4.3 既有 [translation-processing-route.test.js](../../../apps/web/tests/translation-processing-route.test.js) 不动
- [x] 4.4 `npm test` 全绿(84/84,原 77 + 新增 7)
- [ ] 4.5 dev 手工验证:卡死任务 → 点重置 → 工作台回到空态(交给用户)

## 5. spec 与文档

- [x] 5.1 写明 1 条新 Requirement 到 [specs/translation-task-runtime/spec.md](specs/translation-task-runtime/spec.md),3 个 Scenario(processing 卡死可重置 / 不存在幂等 / 重置后新建)
- [x] 5.2 `npx openspec validate 2026-06-18-add-translation-task-reset-affordance --strict` 通过

## 6. 收尾

- [ ] 6.1 commit 信息链回本 change(`feat(web): 翻译任务重置入口` / `test:` / `docs:`)
- [ ] 6.2 归档时由用户执行 `npx openspec archive 2026-06-18-add-translation-task-reset-affordance`(可与 fix-workbench-scroll-architecture / tune-workbench-section-density 一起 batch 归档)
