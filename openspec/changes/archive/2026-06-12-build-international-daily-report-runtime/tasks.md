## 1. 数据模型与共享契约

- [x] 1.1 在 `apps/web/prisma/schema.prisma` 新增 `DailyReportTask` / `DailyReportSelection` / `DailyReportDraftVersion` / `DailyReportArtifact` 四张模型；其中 `DailyReportTask` 增加 `(workflowSlug, issueDate)` 唯一约束；运行 `npx prisma generate`（项目走 `prisma db push` 模式，无 migrations/）
- [x] 1.2 在 `packages/contracts/` 新增 `daily-report.js`，导出 `DAILY_REPORT_TASK_STATUS` / `DAILY_REPORT_ATTEMPT_STATUS` / `DRAFT_VERSION_SOURCE` / `ARTIFACT_KIND` / `EXPORT_VALIDATION_CODE` 等枚举与 `createEmptyDailyReportSummary` / `createEmptyValidationReport` 工厂
- [x] 1.3 在 `apps/web/lib/daily-report/config.js` 暴露 `DATA_ROOT` / `FIXTURE_ROOT` / `TEMPLATE_ROOT` / `resolveDailyReportStorageAdapterMode` / `resolveDailyReportRuntimeRepositoryMode` / `resolveWorkerScript`，参照 `lib/translation-processing/config.js` 风格

## 2. 候选池 fixture 与 provider

- [x] 2.1 在 `.data/daily-report/fixtures/international-daily-report/` 放置至少一个 fixture 文件 `<YYYY-MM-DD>.json`，含 8+ 条候选；字段含 `sourceType: 'fixture'`、source name / URL / publishedAt / retrievalMetadata；并在 `.gitignore` 中允许该目录入库（其他 `.data/daily-report/runtime/` 仍忽略）
- [x] 2.2 在 `apps/web/lib/daily-report/candidate-pool/` 实现 `FixtureCandidatePoolProvider`，并通过 `getCandidatePoolProvider({ workflowSlug })` 装配；对非今天的 issueDate 返回 `unsupported_issue_date`；对今天但 fixture 缺失返回 `candidate_pool_fixture_missing`
- [x] 2.3 实现 `getCandidatePool({ workflowSlug, issueDate })` 服务方法，从 provider 读取候选并按 spec 字段约束做最小校验

## 3. 运行时仓库与存储适配

- [x] 3.1 在 `apps/web/lib/daily-report/storage-adapter.js` 实现本地文件 storage adapter（读取 fixture、写入 artifact 至 `.data/daily-report/runtime/artifacts/`，提供 readBytes / persistArtifact / resolveFixturePath 接口）
- [x] 3.2 在 `apps/web/lib/daily-report/runtime-repository.js` 实现 `PrismaDailyReportRuntimeRepository`（task CRUD、selection 批量替换、draft version append、artifact append、attempt 生命周期）+ `MemoryDailyReportRuntimeRepository`（仅用于测试）+ `getDailyReportRuntimeRepository` 装配函数
- [x] 3.3 在 `apps/web/lib/daily-report/service.js` 实现高层服务：`createDailyReportTask` / `getDailyReportTask` / `submitSelections` / `startDraftAttempt` / `saveSectionEdit` / `startExportAttempt` / `readArtifactBytes`
- [x] 3.4 在 `apps/web/lib/daily-report/python-worker.js` 实现 `runDailyReportWorker(command, args)`，参照 `lib/translation-processing/python-worker.js` 错误处理

## 4. Python worker（起草 + 导出）

- [x] 4.1 在 `services/worker/daily_report/__init__.py` + `worker.py` 创建入口；支持 `draft` / `export` 两个子命令；进度文件落到 `.data/daily-report/runtime/progress/<taskId>.<attemptId>.json`
- [x] 4.2 在 `services/worker/daily_report/drafting.py` 实现"一次性整篇" prompt 拼装：把 6 条候选 snapshot 组装成 system+user prompt，要求模型返回 JSON `{sections: [{index, title, body}] }`，长度必须等于选择数；复用 `services/worker/shared/ai.py` 的 OpenAI 兼容调用 + 重试 + trace
- [x] 4.3 在 `services/worker/shared/ai.py` 新增 `generate_international_daily_report_with_trace(selections, *, trace_context)` 函数，复用现有 retry/trace 机制并强制 JSON schema 校验；为 `stub` provider 提供固定 6 段假数据，为 `fail` provider 维持失败行为
- [x] 4.4 在 `services/worker/daily_report/templates/` 放置 DOCX 模板与资源池 XLSX placeholder（worker 导出时直接从代码生成版式，模板为可选 Override）
- [x] 4.5 在 `services/worker/daily_report/exporting.py` 用 `python-docx` 渲染 DOCX、用 `openpyxl` 追加资源池 XLSX；导出后执行命名、期号、一页内（≤2000 中文字符常量化）三类校验，校验失败返回 `ok: false` + `validationReport`
- [x] 4.6 在 `services/worker/daily_report/worker.py` 暴露 `argparse` CLI，统一输入 `--task-id` `--attempt-id` `--selection` `--sections-json` `--output-dir` 等参数

## 5. API 路由

- [x] 5.1 `GET /api/daily-report/candidate-pools/[workflowSlug]/[issueDate]` 返回候选池
- [x] 5.2 `POST /api/daily-report/tasks` 创建任务（body: `{ workflowSlug, issueDate, issueNumber }`），返回任务；非今天 issueDate 返回 400 `unsupported_issue_date`；重复 `(workflowSlug, issueDate)` 返回 409 + 已有任务引用
- [x] 5.3 `GET /api/daily-report/tasks/[taskId]` 返回任务全部状态（含最新 draft version 与 artifact 列表）
- [x] 5.4 `POST /api/daily-report/tasks/[taskId]/selections` 提交 6 条选择（body: `{ selections: [{candidateId, position, snapshot}] }`），原子替换
- [x] 5.5 `POST /api/daily-report/tasks/[taskId]/drafts` 触发起草 attempt，返回任务最新状态
- [x] 5.6 `PATCH /api/daily-report/tasks/[taskId]/drafts/[versionId]/sections/[index]` 提交单段编辑，写入新 DraftVersion
- [x] 5.7 `POST /api/daily-report/tasks/[taskId]/exports` 触发导出 attempt
- [x] 5.8 `GET /api/daily-report/tasks/[taskId]/artifacts/[artifactId]/download` 流式下载产物（Content-Disposition 按 `fileName` 设置）

## 6. 工作台前端改造

- [x] 6.1 重写 `apps/web/components/daily-report-workbench.jsx` 为 client 组件：开局根据 workflowSlug + 当日日期拉取候选池或现有 task；维护 task 状态轮询（启动后短间隔，完成/失败后停）
- [x] 6.2 候选池区：列表展示候选（标题 / 来源 / 时间 / 摘要），按钮切换选择；已选篮子区：上移下移调整顺序，显示 `已选 N / 6`
- [x] 6.3 草稿编辑区：6 段卡片展示，每段可"编辑"（弹出输入框 → 保存 → 调 PATCH → 写入新版本）；提供"重新生成全部草稿"按钮
- [x] 6.4 导出区：按钮触发导出 → 进度反馈 → 完成后显示 DOCX / XLSX 下载链接 + 校验报告；失败时显示 validationReport
- [x] 6.5 错误与空态：候选池 fixture 缺失、任务被占用、AI 失败、导出校验失败的文案与按钮路径
- [x] 6.6 复用 `WorkbenchFrame` 的 `workflow-status` 视觉骨架，生产链路步骤映射调度替换

## 7. 配置与说明

- [x] 7.1 在 `.env.example` 补充：`XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY` / `XIAOYU_DAILY_REPORT_STORAGE_ADAPTER` / `XIAOYU_DAILY_REPORT_FIXTURE_ROOT`（覆盖默认）/ `XIAOYU_AI_PROVIDER` 已有但注明日报也消费
- [x] 7.2 在 `.gitignore` 中确保 `.data/daily-report/runtime/` 被忽略而 `.data/daily-report/fixtures/` 被入库
- [x] 7.3 在 `services/worker/daily_report/README.md` 写明命令、模板、fixture 的使用方式

## 8. 测试

- [x] 8.1 `apps/web/tests/daily-report-candidate-pool.test.js`：fixture 读取、字段约束、缺日期错误
- [x] 8.2 `apps/web/tests/daily-report-service.test.js`：任务创建唯一约束、选择原子替换、状态机迁移、起草成功 / 失败、编辑写入新版本、导出成功 / 校验失败
- [x] 8.3 `apps/web/tests/daily-report-route.test.js`：4 条 API 路由的契约（含错误码）
- [x] 8.4 `apps/web/tests/daily-report-regression.test.js`：从创建到导出的完整闭环（使用 stub provider）
- [x] 8.5 `services/worker/tests/test_daily_report_drafting.py`：prompt 拼装、JSON schema 校验、stub provider 行为
- [x] 8.6 `services/worker/tests/test_daily_report_exporting.py`：DOCX 渲染、XLSX 追加、命名 / 期号 / 一页内三类校验失败路径
- [x] 8.7 串行执行 `npm test` / `pytest`，确保不与翻译工作流测试共用 `.data` 目录（daily-report 测试使用 memory repository + 临时 artifact 目录）

## 9. 收尾

- [x] 9.1 在仓库根 `README.md` 增补"日报工作台启动方式"（依赖 fixture、需要 `XIAOYU_AI_PROVIDER=stub` 即可演示）
- [x] 9.2 跑 `npx openspec validate build-international-daily-report-runtime --strict`，确保提案通过 OpenSpec 校验
- [x] 9.3 在 PR / commit 信息中链回本 change，归档时 `npx openspec archive build-international-daily-report-runtime`（由用户操作）
