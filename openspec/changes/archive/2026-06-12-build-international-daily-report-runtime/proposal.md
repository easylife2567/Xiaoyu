## Why

`国际日报` 的产品形态已经在 [openspec/specs/](../../specs/) 中定义清楚（候选池 → 选择 → 起草 → 编辑 → 导出），但 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) 目前仍是占位骨架，后端完全没有相应的运行时实现。继续等待"候选池真实采集"这条长链路就绪后再动后端，会让起草、编辑、导出三条能力一直停留在纸面，团队也无法验证日报工作台的整体闭环是否成立。

现在最值当的切入点，是先用仓库内 seed fixture 替代真实采集，把"选择 → 一次性整篇起草 → 轻量编辑 → 模板导出"的端到端闭环跑通；候选池真实采集与后续 `国际热点日报二处` 的扩展，都可以在闭环成立后作为减法接入。

## What Changes

- 新增 `daily-report-task-runtime` capability：定义日报任务（DailyReportTask）的数据模型、生命周期与运行时边界，复用 [translation-task-runtime](../../specs/translation-task-runtime/spec.md) 的 task/attempt/artifact + repository/storage adapter 抽象模式。
- 为 `news-candidate-pool` 增加"仓库 seed fixture 作为开发期候选池来源"的 Requirement；保留 spec 中"候选池基于真实可检索源"的约束，但允许 fixture 作为开发期来源标注。
- 为 `report-drafting` 增加"一次性整篇起草"运行时行为：用户选定 6 条候选后，一次 AI 调用产出包含 6 段的整篇草稿。
- 为 `report-export` 增加首批可落地的产物与校验规则：DOCX 报告、资源池 XLSX 追加、固定命名 / 期号 / 一页内 三类导出校验。
- 把 [daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) 从占位骨架升级为可操作的工作台：拉取候选池、勾选 6 条、触发起草、轻量编辑、触发导出、下载产物。
- 复用 [services/worker/shared/ai.py](../../../services/worker/shared/ai.py) 的 OpenAI 兼容 + stub 通道；首轮不引入 PDF 渲染、不接入图片、不接入真实候选池采集、不实现期号自动累计、不实现加密。

## Capabilities

### New Capabilities

- `daily-report-task-runtime`: 日报任务的正式运行时模型——任务/选择记录/草稿版本/产物的数据契约、状态机以及 repository/storage 抽象边界。

### Modified Capabilities

- `news-candidate-pool`: 允许开发期候选池由仓库 seed fixture 提供（带明确的"来源类型 = fixture"标注），不弱化"基于真实源"的总体约束。
- `report-drafting`: 落实"一次性整篇起草"的运行时行为，包括起草触发条件、AI 调用形状、草稿版本与轻量编辑模型。
- `report-export`: 落实首批可执行的导出契约——DOCX 报告、资源池 XLSX 追加、命名 / 期号 / 一页内 三类校验失败即不交付。

## Impact

- 新增 [apps/web/lib/daily-report/](../../../apps/web/lib/) 目录承载 service / runtime-repository / storage-adapter / candidate-pool / drafting / export 等模块。
- 新增 [apps/web/app/api/daily-report/](../../../apps/web/app/api/) 路由：候选池查询、任务创建、起草、编辑、导出、下载。
- 替换 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) 为可操作组件。
- 新增 [packages/contracts/daily-report.js](../../../packages/contracts/) 表达任务/选择/草稿/产物的共享枚举与默认结构。
- 新增 [apps/web/prisma/schema.prisma](../../../apps/web/prisma/schema.prisma) 中的 `DailyReportTask / DailyReportSelection / DailyReportDraftVersion / DailyReportArtifact` 模型。
- 新增 [services/worker/daily_report/](../../../services/worker/) 目录承载起草 prompt 拼装与 DOCX/XLSX 导出脚本（复用 `services/worker/shared/ai.py`）。
- 新增 [.data/daily-report/fixtures/](../../../.data/) 候选池 seed（开发期），并在 [.gitignore](../../../.gitignore) 中明确 fixture 与运行时数据的边界。
- 影响 [.env.example](../../../.env.example)：声明日报相关运行时变量（fixture 路径、AI provider 切换、可选 worker 配置）。
- 不影响现有翻译工作流的代码与契约。
