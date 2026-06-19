## Why

大翻译数据处理工作台目前**没有"重置任务"入口**,只有 `重试任务`(`/retry` API)。`重试`是从失败处续上(`createAttempt` + 复用原 task 行),但它不能解决**任务彻底坏掉**的场景:

- task.status 不是 `failed` 也不是 `completed`(例如卡在 `processing`),retry API 直接拒绝(参考 [service.js:132](../../../apps/web/lib/translation-processing/service.js))
- 上传的源文件本身有问题(列位映射、表头不规范),用户想换文件但 task 行已存在 → 无法换
- 验证失败、AI 持续失败、status 与实际状态不一致等情况下,用户**唯一办法是清缓存或操作数据库**

国际日报已经有完整的 reset 实现 ([daily-report 的 service.js + route.js DELETE](../../../apps/web/app/api/daily-report/tasks/[taskId]/route.js))——按钮在 `生产链路` header,点击后弹 confirm 然后 DELETE,把 task 行整个清掉,用户可以重新创建任务。但翻译没对齐这套设计,导致用户截图里的"任务在处理中断"只能看运行日志、点不动任何按钮的窘境。

具体业务后果:
- 记者把含错列名的 Excel 上传后,系统进入 ready / queued 状态但持续失败,**无法清掉重新换文件**
- AI 服务长期不可用时,user 只能看着 task 行躺在数据库里,**没有合法的"放弃"入口**
- 如果 retry 也失败(模型服务连续不可用),用户被 100% 锁死

## What Changes

- **后端 service**:在 [apps/web/lib/translation-processing/service.js](../../../apps/web/lib/translation-processing/service.js) 新增 `resetTranslationTask(taskId)`,完全删除 task 行(repository.deleteTask),包括关联 attempt 与 artifact 元数据;返回 `{ ok: true }`
- **后端 API**:在 [apps/web/app/api/translation-processing/tasks/[taskId]/route.js](../../../apps/web/app/api/translation-processing/tasks/[taskId]/route.js) 新增 `DELETE` handler,与 daily-report 同款 200 / 500 错误形状
- **前端按钮**:在 [apps/web/components/translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx) 的 `workflow-status header` 加 `重置任务` 按钮(与国际日报对齐位置),`task && !busy` 时可点;点击后 `window.confirm` 提示"已上传的文件、所有重试记录、运行日志会清空" → 调 DELETE → `setTask(null)` 让工作台回到初始空态
- **测试**:
  - 新增 [apps/web/tests/translation-task-reset.test.js](../../../apps/web/tests/translation-task-reset.test.js):service 删除 + 重建 / API 路由 DELETE / 任意状态下都可重置
  - 既有 [translation-processing-service.test.js](../../../apps/web/tests/translation-processing-service.test.js) / [translation-processing-route.test.js](../../../apps/web/tests/translation-processing-route.test.js) 不动
- **修 retry 触发条件**(微调):[translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx) 的 `canRetry = task?.status === 'failed'` 不变,但增加一条文案补丁:当 status 不是 `failed` 也不是 `completed` 时,**给用户呈现"重置任务"为唯一 unblock 入口**;不扩展 retry API 的触发条件(那需要 service 层重构,另开 change)
- **spec**:在 `translation-task-runtime` capability 新增 1 条 Requirement:`Translation task supports user-triggered reset`

## Capabilities

### Modified Capabilities

- `translation-task-runtime`:在已有"task 持久化 / attempt 版本化 / storage 边界"3 条 Requirement 之上,新增"用户可主动重置任务到不存在状态"的契约,确保任务在任何状态下都有一条 unblock 路径。

## Impact

- 影响 [apps/web/lib/translation-processing/service.js](../../../apps/web/lib/translation-processing/service.js):+10 行(`resetTranslationTask` 函数)
- 影响 [apps/web/app/api/translation-processing/tasks/[taskId]/route.js](../../../apps/web/app/api/translation-processing/tasks/[taskId]/route.js):+15 行(DELETE handler)
- 影响 [apps/web/components/translation-workbench.jsx](../../../apps/web/components/translation-workbench.jsx):+25 行(handleResetTask + 按钮 + 文案)
- 新增 [apps/web/tests/translation-task-reset.test.js](../../../apps/web/tests/):约 80 行测试
- 新增 [openspec/specs/translation-task-runtime/spec.md](../../specs/translation-task-runtime/) 1 条 Requirement
- 不影响 Prisma schema、worker、daily-report、UX/scroll 架构、其它工作台
- 不引入新依赖
