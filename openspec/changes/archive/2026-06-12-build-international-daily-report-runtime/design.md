## Context

`国际日报` 当前在产品形态上已经被 [openspec/specs/international-daily-report/spec.md](../../specs/international-daily-report/spec.md)、[openspec/specs/daily-report-workflow/spec.md](../../specs/daily-report-workflow/spec.md)、[openspec/specs/news-candidate-pool/spec.md](../../specs/news-candidate-pool/spec.md)、[openspec/specs/report-drafting/spec.md](../../specs/report-drafting/spec.md)、[openspec/specs/report-export/spec.md](../../specs/report-export/spec.md) 五份 spec 共同约束清楚，但是后端没有任何实现：

- 候选池只有定义，没有数据；
- 工作台 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) 是静态占位；
- 没有日报相关的数据库模型、API、worker 入口；
- 翻译工作流 [apps/web/lib/translation-processing/](../../../apps/web/lib/translation-processing/) 已经沉淀了一整套"task runtime repository + storage adapter + Python worker via execFile"模式，但还没有被日报复用过。

本次变更要在不引入真实候选池采集的前提下，先用仓库 seed fixture 打通整条链路，让日报工作台从"占位"升级为"可演示、可验证、可在此之上增量替换数据源"的最小可用产品。

## Goals / Non-Goals

**Goals:**
- 沿用翻译工作流已经验证过的 runtime repository + storage adapter 模式，把日报任务、选择记录、草稿版本、产物纳入 Prisma 持久化与 storage adapter 抽象。
- 候选池在本轮以仓库 seed fixture 作为唯一数据源，每天对应一个 fixture 文件；服务层暴露"按工作流 + 日期"读取候选的接口，让未来真实采集只需替换 fixture provider。
- 起草采用"一次性整篇"额度：用户选完 6 条后，前端触发一次起草任务，后端汇总 6 条上下文向 AI 发起一次调用，模型一次性返回 6 段中文报告。
- 草稿支持轻量编辑（按段重写文本），编辑动作落到草稿版本表，导出始终基于"当前草稿版本"，不在 AI 起草之后再改动数据库以外的瞬时状态。
- 导出首轮覆盖 DOCX 报告与资源池 XLSX 追加，并强制三类校验（命名、期号、一页内）作为产物落地前的硬门槛。
- 工作台改造保留现有 ConsoleShell + WorkflowFrame 视觉骨架，主流程区域接入真实候选池、已选篮子、草稿编辑、导出区。

**Non-Goals:**
- 不接入真实候选池采集（爬虫、外部新闻 API、去重聚类、回链）。
- 不实现 PDF / 加密 / 期号自动累计（期号本轮由 fixture 或环境变量给定）。
- 不接入图片生成或附图，仅 DOCX 文本 + 资源池 XLSX。
- 不实现 `国际热点日报二处` 的工作台改造，但在 `daily-report-task-runtime` 数据模型与 service 抽象中保留多 workflowSlug 扩展能力。
- 不在本轮引入 Celery / Redis / MinIO；任务执行继续延续翻译工作流"web 触发 + Python worker via execFile"模式。
- 不重构 [packages/contracts/translation-processing.js](../../../packages/contracts/translation-processing.js) 或翻译工作流的现有契约。
- 不在本轮接入多用户、权限、并发占用与冲突解决，假设单用户串行操作工作台。

## Decisions

### 1. 数据模型沿用翻译工作流的"task + attempt + artifact"骨架，并叠加日报特有的 selection / draft-version 表

新增四张表：
- `DailyReportTask`：(id, workflowSlug, issueDate, issueNumber, status, summary, failure, events, timestamps)
- `DailyReportSelection`：(id, taskId, candidateId, candidateSnapshot Json, position, createdAt) — 用 `candidateSnapshot` 把 fixture 当时的候选 payload 完整冻结，避免起草时 fixture 已经被改写。
- `DailyReportDraftVersion`：(id, taskId, attemptId, version, sections Json, source Json, createdAt) — `sections` 是 6 段（或 N 段）的有序数组；`source` 区分 ai_generated / user_edited。
- `DailyReportArtifact`：(id, taskId, draftVersionId, kind enum, fileName, objectKey, sizeBytes, validationReport Json, createdAt) — `kind` 区分 `docx_report` / `resource_pool_xlsx`。

**Why:** 翻译工作流的 task/attempt/artifact 已被验证能稳定承载"启动 → 进行中 → 完成 / 失败 → 重试"的状态机，复用同一套生命周期模型可以让 service / API / 前端轮询协议直接对齐已有模式；selection 与 draft-version 是日报独有的，因此独立建模而不是塞进通用 events JSON。

**Alternative considered:** 完全平铺到 `DailyReportTask` 一张表里，用 JSON 字段承载所有结构。优点是落地快，缺点是后续要让"草稿版本可追溯""选择可单独查询/统计"时必须再拆，且无法用外键保证选择/草稿与 task 的一致性。

### 2. 候选池开发期数据源 = 仓库 seed fixture，长期接口 = `candidatePoolProvider`

`apps/web/lib/daily-report/candidate-pool/` 暴露一个 `getCandidatePool({ workflowSlug, issueDate })` 接口；本轮提供 `FixtureCandidatePoolProvider` 一种实现，从 `.data/daily-report/fixtures/<workflowSlug>/<YYYY-MM-DD>.json` 读取。fixture 文件按 spec 要求保留 source name / url / publishedAt / retrievalMetadata，并显式标注 `sourceType: 'fixture'`。

**Why:** 把"候选池数据源"做成 provider 边界，未来接入真实采集时只是新增 `ScheduledCollectorProvider` 之类的实现，不需要重写起草/编辑/导出链路，也不需要前端改动。spec 中"基于真实源"的语义通过 fixture 也带 source name / url / publishedAt / retrievalMetadata 来保留——`sourceType: 'fixture'` 字段让审计端能识别本轮数据是开发期种子。

**Alternative considered:** 直接把候选写死在 React 组件里，或塞进 `src/workbenches.js`。优点是 0 抽象成本，缺点是上线/线下切换数据源时必须改前端代码，与 spec 中"候选池作为数据"的定位偏离。

### 3. 起草以"一次性整篇" AI 调用为运行时形状，复用 `services/worker/shared/ai.py`

起草流程：
1. 用户在前端确认 6 条已选后点击"生成草稿"。
2. API 创建 `DailyReportTask` 的一个新 attempt，状态置为 `processing`。
3. 后端调用 Python worker 入口 `services/worker/daily_report/worker.py draft`，传入 task/attempt/选择快照。
4. Worker 拼装一次 system+user prompt，调用 `generate_chinese_summaries_batch_with_trace` 的同侧 API（新增 `generate_international_daily_report_with_trace`，强制 JSON 返回 `{sections: [{index, title, body}]}`），一次性获取 6 段。
5. Worker 返回结果到 Node 端，Node 创建 `DailyReportDraftVersion` v1（source=`ai_generated`），attempt 标记为 `completed`，task 状态转 `drafting_ready_for_review`。

**Why:** 一次性整篇符合用户答复的额度选择，最大化 AI 对"段间衔接 / 标题统一"的把握；继续走 Python worker + execFile 模式可以直接复用已经被翻译工作流验证过的 AI 调用、重试、trace 上报、失败分类机制。

**Alternative considered:** 每段独立调用并并发。优点是失败粒度小、可独立重生；缺点是段间风格难统一，spec 中 `国际日报` 强调"统一编号结构、统一信源命名"，整篇调用更稳。后续如果发现整篇失败重生成本过高，可以在 `report-drafting` capability 上加 ADDED Requirement 切到逐条额度。

### 4. 轻量编辑落到独立 `DailyReportDraftVersion` 版本，导出锁定"最新版本"

每次用户保存编辑都会写入一条新的 `DailyReportDraftVersion`（source=`user_edited`，version 自增），不覆盖之前的草稿。导出动作从"当前最新版本"取数据生成 DOCX / XLSX，并把 `draftVersionId` 记录到 artifact，确保产物可以追溯到具体草稿。

**Why:** 草稿版本化是 spec 隐含要求（"用户可见编辑前的稿件"），同时为后续"对比 / 回滚 / 显示 AI 原稿 vs 编辑后"留出空间；导出锁定版本能避免"导出过程中用户继续编辑导致产物和数据库状态错位"。

**Alternative considered:** 直接 in-place 更新草稿。改动小但失去版本追溯能力，且与"AI 原稿"做对比展示时只能现场缓存。

### 5. 导出在 Python worker 内完成，校验失败即不交付

`services/worker/daily_report/worker.py export` 接收 task / draftVersionId / 模板 ID / 期号 / 命名规则，使用 `python-docx` 渲染 DOCX 报告，使用 `openpyxl` 在 fixture 资源池 XLSX 副本上追加当期 6 条记录。导出后立即执行三类校验：
- 命名校验：文件名严格匹配命名规则（`国际日报-<issueDate>-<issueNumber>.docx` 等），不一致即报错。
- 期号校验：`issueNumber` 必须为正整数且与 task 记录的期号一致。
- 一页内校验：用 `python-docx` 估算渲染段落总长度（保守上限 = 2000 中文字符），超限即报错。

校验失败时不写入 artifact 表，attempt 标记 `failed` 并附带 `validationReport`，前端展示"导出未通过校验"。

**Why:** spec [report-export](../../specs/report-export/spec.md) 要求"校验失败即不交付"；这条规则作为运行时硬门槛能避免上线后产生不合规产物。一页内校验在没有真实 Word 渲染引擎的前提下用字符长度作保守估计，先满足"不可超长"语义，等接入真正的渲染再换更精确的算法。

**Alternative considered:** 在 Node 端用 `docx` npm 包写文档。优点是少一次 execFile，缺点是要新增 npm 依赖且无法复用 Python 侧已经验证的 worker + AI trace 机制。

### 6. DOCX 模板与资源池 XLSX fixture 入版本控制，候选池 fixture 仍走 `.data/`

DOCX 模板（`services/worker/daily_report/templates/international-daily-report.docx`）和资源池 XLSX 起始 fixture（`services/worker/daily_report/templates/resource-pool.xlsx`）作为 worker 代码的一部分入仓；候选池 fixture 仍按 §2 决策落在 `.data/daily-report/fixtures/<workflowSlug>/<YYYY-MM-DD>.json`。

**Why:** 模板是"规则"（导出形状的硬契约）而非"数据"，与起草/导出代码的版本同步至关重要——模板改了 worker 行为也要跟着改，放仓库内能让 git 历史完整记录模板演进。候选池 fixture 是"开发期种子数据"，放 `.data/` 既能避免污染主代码树，也能让未来接入真实采集时只换 provider 不动模板。

**Alternative considered:** 模板也放 `.data/`。优点是模板与运行时数据物理位置一致，缺点是 PR 评审看不到模板变化、回滚也要协调两套来源。

### 7. 候选池本轮只支持 `issueDate = today`，但接口已带 issueDate 参数

`getCandidatePool({ workflowSlug, issueDate })` / `POST /api/daily-report/tasks` / `GET /api/daily-report/candidate-pools/[workflowSlug]/[issueDate]` 全部带 `issueDate` 参数，且 fixture 文件按日期命名；本轮的 provider 实现 + 工作台 UI 仅允许 `issueDate = today`（其他日期返回 `unsupported_issue_date` 错误）。

**Why:** "今天 only" 是产品形态的事实约束（日报当日生产），把它落在 provider 层让"未来扩展到补做某天"只是放宽 provider 校验，不需要重新设计 API 形状。Spec 与 API 已经承载了 issueDate 维度，避免日后再次破契约。

**Alternative considered:** 完全不暴露 issueDate（按当前服务器时间隐式拉今天）。改动更少但未来要补做历史日期时需要破改 API。

### 8. API 复用翻译工作流的"接口契约 + 轮询"模式，无 SSE

| Method | Path | 用途 |
| --- | --- | --- |
| GET | `/api/daily-report/candidate-pools/:workflowSlug/:issueDate` | 读取候选池（fixture） |
| POST | `/api/daily-report/tasks` | 创建 task（绑定 workflowSlug + issueDate + issueNumber） |
| GET | `/api/daily-report/tasks/:taskId` | 拉取任务状态 / 当前草稿 / 产物 |
| POST | `/api/daily-report/tasks/:taskId/selections` | 提交本轮选择（6 条） |
| POST | `/api/daily-report/tasks/:taskId/drafts` | 触发一次起草 attempt（一次性整篇） |
| PATCH | `/api/daily-report/tasks/:taskId/drafts/:versionId/sections/:index` | 提交单段编辑（写入新版本） |
| POST | `/api/daily-report/tasks/:taskId/exports` | 触发导出 attempt |
| GET | `/api/daily-report/tasks/:taskId/artifacts/:artifactId/download` | 下载产物文件 |

前端继续使用 setInterval 轮询 task 状态，沿用翻译工作流相同的"启动后短间隔轮询 + 完成/失败后停止"逻辑。

**Why:** 翻译工作流的轮询模式在产品里已经稳定运行，复用同套交互模型可以让前端代码体量保持在最小；spec 不要求实时推送。

**Alternative considered:** 接入 SSE / WebSocket。优点是更"实时"，缺点是要额外引入服务端长连接基础设施，与"先打通最小闭环"的目标冲突。

### 9. 不为 `DailyReportArtifact.draftVersionId` 建反向索引，等真实查询场景出现再加

`DailyReportArtifact` 表保留 `draftVersionId` 字段（满足 spec 中的可追溯要求），但本轮不在 Prisma schema 上为它单独建索引；artifact 的主要查询路径是"按 taskId 拉全部 artifact"（已有 `(taskId)` 索引），而非"按 draftVersionId 反查 artifact"。

**Why:** 反向查询场景目前不存在；过早加索引等于先付写入开销与 schema 复杂度，却没有任何读路径受益。Prisma migration 后续追加索引是非破坏性变更，等到出现真实查询需求（例如"对比 AI 原稿与导出稿的 diff"）再加。

**Alternative considered:** 现在就加 `@@index([draftVersionId])`。优点是"以后想用就有"，缺点是为推测中的需求付固定写入与维护成本。

## Risks / Trade-offs

- **[fixture 候选与真实采集的字段差异]** → 把 fixture 字段集对齐 spec 要求（source name / url / publishedAt / retrievalMetadata），未来真实采集只需 1:1 映射；fixture 显式标注 `sourceType: 'fixture'` 让线上数据可以审计。
- **[整篇 AI 调用失败一次就需要全部重生成]** → attempt 模型本就允许重试，UI 上仅暴露"重新生成草稿"按钮，让用户感知一致；如果后续观察到重生频率过高，下一轮可以新增"按段重生"额度。
- **[一页内校验用字符长度做近似]** → 在 design 里把阈值（2000 中文字符）写到代码常量并加注释；接入真实模板渲染时把阈值替换成"渲染分页判断"。
- **[资源池 XLSX 追加是 in-place 操作]** → fixture XLSX 在 storage adapter 上以"读 fixture → 追加 → 写回新对象"的方式实现，不破坏 fixture 本体；artifact 记录指向追加后的产物对象。
- **[草稿版本会无限增长]** → 本轮接受不做清理；archive 时可以以 task 为单位整体保留，未来如有清理需求再加 retention 规则。
- **[同一日期重复创建 task]** → 数据库层面对 `(workflowSlug, issueDate)` 加唯一约束，重复创建直接拒绝；前端在 issueDate 选择时只允许"今天"以及"今天未被占用"。

## Migration Plan

1. 在 [apps/web/prisma/schema.prisma](../../../apps/web/prisma/schema.prisma) 新增四张表的模型并跑 `prisma migrate dev`。
2. 在 [packages/contracts/](../../../packages/contracts/) 新增 `daily-report.js`，导出 `DAILY_REPORT_TASK_STATUS` / `DRAFT_VERSION_SOURCE` / `ARTIFACT_KIND` 等枚举与默认 summary 工厂。
3. 在 [apps/web/lib/daily-report/](../../../apps/web/lib/) 实现 candidate-pool / runtime-repository / storage-adapter / service / python-worker 模块（mirror 翻译工作流目录结构）。
4. 在 [services/worker/daily_report/](../../../services/worker/) 实现 `worker.py`（draft / export 两个子命令）+ `templates/`（DOCX 模板 + 资源池 XLSX fixture）。
5. 在 [.data/daily-report/fixtures/international-daily-report/](../../../.data/) 放置至少 1 个日期的候选池 fixture（含 8+ 条候选，便于体验 6 选 N 流程）。
6. 在 [apps/web/app/api/daily-report/](../../../apps/web/app/api/) 实现 7 条 API 路由。
7. 重写 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) 为可操作组件。
8. 补 service 层、API 层、worker 层、端到端的测试。
9. 更新 [.env.example](../../../.env.example) 添加日报相关变量；更新 [.gitignore](../../../.gitignore) 排除运行时数据但保留 fixture。

**Rollback strategy:** 日报相关数据库表与新增路由完全独立于翻译工作流；如本轮整体回退，只需 `prisma migrate reset` + 删除日报新增文件，翻译工作流不受影响。

## Open Questions

_None — 起草阶段的全部未决问题已合入上述 Decisions §6 / §7 / §9。_
