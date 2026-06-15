## Why

[build-international-daily-report-runtime](../archive/2026-06-12-build-international-daily-report-runtime/proposal.md) 把候选池接入了仓库 seed fixture（`.data/daily-report/fixtures/<workflowSlug>/<YYYY-MM-DD>.json`），但 fixture 必须**每天手工补一份**才能保住"今日候选池可读"的语义；2026-06-14 演示前 6-13 当天 fixture 缺失，工作台直接报 `candidate_pool_fixture_missing`，是临场救火补上的（见 [.data/daily-report/fixtures/international-daily-report/2026-06-13.json](../../../.data/daily-report/fixtures/international-daily-report/2026-06-13.json)）。

只要演示前一晚漏补，第二天就开天窗——这条路径在真实采集落地前还会持续暴露。在 spec 层面引入"fixture 供给可降级"的约束、在工程层面提供 dev 脚本批量补档，可以把"演示开天窗"风险降为零，且不改变"候选池基于真实可检索源"的总体约束，也不替代未来真实采集 capability。

## What Changes

- 修订 [news-candidate-pool](../../specs/news-candidate-pool/spec.md)：增加"fixture 供给降级"行为——当 `issueDate` fixture 缺失但 N 天回退窗口内存在更早的 fixture 时，候选池服务 SHALL 用最近一份 fixture 兜底，并通过 `staleSourceDate` 字段把"实际来源日期"暴露给前端与运维；fixture 完全缺失或回退窗口外时仍返回 `candidate_pool_fixture_missing`。
- 在 [apps/web/lib/daily-report/candidate-pool/](../../../apps/web/lib/daily-report/candidate-pool/) 实现兜底逻辑：fixture 命中时维持原行为；缺失时按"最近 N 天 fixture"扫描目录，N 与"回退是否启用"通过环境变量配置，默认启用、N=7。
- 候选池响应新增 `staleSourceDate?: string`（YYYY-MM-DD）。该字段仅在使用兜底 fixture 时出现；正常命中时缺省。`packages/contracts/daily-report.js` 增加对应键名常量，避免拼写漂移。
- 工作台前端识别 `staleSourceDate`：在候选池标题旁渲染"使用 X 月 X 日候选池（今日数据未到位）"提示条，颜色用警告色；不阻塞选择/起草/导出流程。
- 新增 [scripts/daily-report/roll-fixture.mjs](../../../scripts/) dev 脚本：以"最近一份 fixture"为模板生成 `<targetDate>.json`，按规则推进 `issueDate` / `generatedAt` / `candidates[].id` / `candidates[].publishedAt` / `candidates[].retrievalMetadata.collectedAt`，**不调用任何 AI**——单纯日期/ID 平移；脚本默认目标 = 今天，支持 `--date YYYY-MM-DD` 与 `--workflow <slug>` 参数；脚本在 README 与 `services/worker/daily_report/README.md` 各列一条用法。
- 新增 fixture 兜底行为的单测（`apps/web/tests/daily-report-candidate-pool.test.js` 追加用例）；新增 roll-fixture 脚本的单测（`apps/web/tests/daily-report-roll-fixture.test.js`）覆盖"无 source fixture"、"目标日期已存在"、"workflow slug 缺失"三类失败路径与正常路径。
- 不引入新的 API 路由、不改 Prisma 模型、不动 worker、不改起草/导出/编辑代码、不替代未来真实采集。**首轮不实现**自动调度（cron/启动钩子）——脚本由人工或后续 dev 工作流触发。

## Capabilities

### Modified Capabilities

- `news-candidate-pool`：新增"fixture 供给降级"行为——明确兜底窗口、`staleSourceDate` 暴露义务，以及"fixture 完全缺失/超出窗口"仍走 `candidate_pool_fixture_missing`。

## Impact

- 影响 [apps/web/lib/daily-report/candidate-pool/index.js](../../../apps/web/lib/daily-report/candidate-pool/index.js)（兜底逻辑、`staleSourceDate` 输出）。
- 影响 [apps/web/lib/daily-report/config.js](../../../apps/web/lib/daily-report/config.js)（新增 `XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK` / `XIAOYU_DAILY_REPORT_FIXTURE_STALE_WINDOW_DAYS` 解析）。
- 影响 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx)（候选池区追加 stale 提示条；不影响选择/起草/导出主线）。
- 新增 [packages/contracts/daily-report.js](../../../packages/contracts/daily-report.js)：`STALE_SOURCE_DATE_FIELD` 常量。
- 新增 [scripts/daily-report/roll-fixture.mjs](../../../scripts/)（dev 工具脚本，不作为运行时依赖）。
- 影响 [README.md](../../../README.md) 与 [services/worker/daily_report/README.md](../../../services/worker/daily_report/README.md)：补一节"fixture 滚动 / 兜底说明"。
- 影响 [.env.example](../../../.env.example)：声明新增环境变量与默认值。
- 影响 [openspec/specs/news-candidate-pool/spec.md](../../specs/news-candidate-pool/spec.md)：MODIFIED Requirement + 新 Requirement。
- 不影响起草/编辑/导出/真实采集；不影响 Prisma 模型；不影响 Python worker。
