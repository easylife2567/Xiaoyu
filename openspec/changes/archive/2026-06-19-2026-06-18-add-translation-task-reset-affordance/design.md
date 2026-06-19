# Design — add-translation-task-reset-affordance

## R1. 为何 reset 是"完全删除 task 行"而不是"就地复位状态"

让任务从坏掉状态恢复有两条技术路线:

- **A. 就地复位**:把 task.status 改回 `ready` 或 `queued`,清掉 attempt / artifact 子记录,但保留 task 行
- **B. 完全删除**(本 change 选择):`repository.deleteTask(taskId)` 直接清掉 task 行 + 级联删除 attempt / artifact

A 路线的问题:
- 复位语义不明 — `ready` 是上传后等待开始,`queued` 是已入队,从 `failed` / `processing` 复位到哪个状态没有产品默认
- 用户的实际诉求往往是"换个文件重来"而不是"再用这个文件试一次",就地复位反而不对
- attempt 表保留旧记录,后续状态查询要过滤,代码复杂度上升
- daily-report 已经选 B 路线,翻译同 capability 同模式更一致

B 路线优势:
- 语义清晰 — `重置 = 这个任务不存在了`,用户感知与"清空"完全对齐
- 实现简单 — 复用 repository.deleteTask
- 与 daily-report 一致,不引入新模式
- 用户重置后,工作台回到初始空态,新建任务的入口(上传 Excel)自然可见

## R2. 为何 spec 加在 `translation-task-runtime` 而不是 `workbench-shell-ux`

reset 是**业务能力的状态机契约**(任务的可达状态包括"不存在"),不是 UX 契约。translation-task-runtime 已经定义了"task 持久化 / attempt 版本化 / storage 边界",reset 是这套状态机的延伸 — `unblock 入口` 属于 task 自身的生命周期。

`workbench-shell-ux` 关注的是**展现层契约**(滚动、布局、导航、视觉密度),即便后续要加"长任务必须有 unblock 入口"这种横向 UX 原则,也是另一条 Requirement,不应混淆。

不在本 change 抽取横向 UX 契约的理由:目前只有 2 个工作台,横向规则需要 3+ 才有价值。等下一个工作台加进来再说。

## R3. 重试 vs 重置的语义区分

修复后,用户在翻译工作台失败状态下应该能清楚区分两个按钮:

| 按钮 | 触发条件 | 后果 | 适用场景 |
|---|---|---|---|
| **重试任务** | `status === 'failed' \|\| status === 'completed'` | 创建新 attempt,沿用原 task / 文件 | AI 临时失败、网络抖动、想看新 attempt 的差异 |
| **重置任务** | `task` 存在,**任何状态** | 删除 task 行,工作台回到空态 | 文件错了想换、status 卡死、放弃这个任务 |

"立即刷新"是第三个按钮,只是触发 `GET task` 重读最新状态,不改变 task 本身,与本 change 无关。

为避免文案歧义:重置按钮的 confirm 文案要明示**会清空已上传文件、所有重试记录、运行日志**,且**该操作不可逆**。

## R4. confirm 弹窗的 UX 与可访问性

对齐 daily-report 的实现:`window.confirm('确定要重置当前翻译任务吗？已上传的文件、所有重试记录、运行日志都会清空。')`。

为什么用浏览器原生 `confirm` 而不是自定义 modal:
- 浏览器原生 confirm 自带键盘焦点 / Enter / Esc 处理,可访问性零成本
- 不引入新组件 / 状态管理
- daily-report 已经这么做,保持工作台一致

后续视觉刷新(workbench-visual-refresh-v2)里如果要替换为自定义 modal,需要保证 keyboard accessibility 和 focus trap,届时另开 change。

## R5. retry 触发条件不在本期扩展

[service.js:132](../../../apps/web/lib/translation-processing/service.js) 的 `retryTranslationTask` 只允许 `failed` / `completed` 状态。如果 task 卡在 `processing` 但实际 worker 已死,retry 会拒绝。

理论上可以扩展为也接受 `processing`(配合超时检测自动转 `failed`),但这需要:
- 设计 attempt 超时阈值
- 工作台 polling 检测超时并自动 mark failed
- 边界处理:正在跑的 attempt 怎么处理?是杀掉还是让它跑完?

这是 attempt 状态机的**重大重构**,不在本 change 范围。本期通过"重置任务"提供 unblock 路径足以覆盖卡死场景 — 用户重置后从头开始,没有数据丢失风险(源文件用户本地仍在)。

## R6. 不在本期范围

- **retry 触发条件扩展** — 留给 `add-translation-task-timeout-detection`
- **横向 UX 契约**(所有工作台必须有 unblock 入口)— 留给 v3 加新工作台时再抽取
- **重置批量任务**(同时重置多个 task)— 暂无产品需求
- **重置后保留运行日志归档** — 当前删除即清掉,后续如果有审计需求另做
- **国际日报 reset 文案与翻译重置文案统一** — 文案 polish 留给视觉刷新
