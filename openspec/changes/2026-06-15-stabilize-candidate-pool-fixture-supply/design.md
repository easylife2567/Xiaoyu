## Context

[build-international-daily-report-runtime](../archive/2026-06-12-build-international-daily-report-runtime/proposal.md) 把候选池接到了 `.data/daily-report/fixtures/<workflow>/<date>.json`，并在 [news-candidate-pool spec](../../specs/news-candidate-pool/spec.md) 写明"fixture 必须带 `sourceType=fixture`、保留来源元数据"。fixture 文件命名按 `issueDate` 走，"今日"文件由人手工写入。这一点在现行 spec 里既没强制"今日必须存在"，也没规定"缺失时如何应对"——在 `assertIsToday` 通过后，缺文件会冒 `candidate_pool_fixture_missing`。

2026-06-14 演示前发现 6-13 当天 fixture 没补，工作台直接断档，是临场救火补的。这是首次暴露的问题，演示前发生一次就够说明这条路径不能继续靠人勤补。

## Goals / Non-Goals

**Goals**

- 在 spec 层引入"fixture 供给降级"约束：今日 fixture 缺失但近 N 天有 fixture 时，候选池服务必须用最近一份兜底，并把"实际来源日期"暴露给前端 / 运维。
- 在工程层提供 dev 脚本，把"以最近 fixture 为模板生成今日 fixture"的工作降到一条命令，不依赖运行时调度。
- 全部行为可以通过环境变量关掉，让真实采集 capability 落地后这层兜底可以无副作用退役。

**Non-Goals**

- 不接入真实采集（这是后续独立 capability）。
- 不引入定时调度（cron / Next.js 启动钩子 / worker 钩子）。脚本必须由人工或外部 dev 工作流触发。
- 不调用任何 AI 改写 fixture 内容——脚本只做"日期 / ID 平移"，避免引入"幻觉数据"风险或"演示当天看到的标题不一致"的尴尬。
- 不持久化 `staleSourceDate` 到 task 表——它只是一次读取的元数据。task 仍以 `issueDate` 为主键。
- 不替换现有 `assertIsToday` 对非今日的拒绝逻辑——回退仅作用于"今日 + 文件缺失"。

## Key Decisions

### Decision 1 ─ 兜底窗口默认 7 天，且默认启用

**为什么 7 天**：fixture 由人维护，节假日 / 短期休假 ≤7 天能覆盖；同时 7 天足够远超出"演示窗口"，不至于把"半个月前的旧候选池"伪装成今日数据。`window=0` 视为"关闭"，由 `XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK=disabled` 显式表达。

**为什么默认启用**：当前唯一已知路径是开发期 / 演示期，"开天窗"的代价远高于"用昨天的候选池演示"。真实采集 capability 落地时直接把 spec 中"fixture 供给降级"标为 deprecated，并把环境变量默认改 `disabled`。

### Decision 2 ─ requestedIssueDate 不变，只多透出 staleSourceDate

替代方案是把 `issueDate` 改成 fixture 实际日期。否决理由：

- task 创建链路 (`createDailyReportTask`) 与导出命名都依赖"任务 issueDate = 今日"。一旦把 issueDate 改成历史日期，唯一约束 `(workflowSlug, issueDate)` 会和未来真实补档冲突。
- 前端"今天的日报"语义被打破，需要全链路改。
- spec 层增加一个可选字段比改主键更安全。

### Decision 3 ─ 脚本而非启动钩子

用户在 AskUserQuestion 中明确选了"独立 dev 脚本"。原因：

- 启动钩子在生产环境也会触发，需要额外的 dev-only 守卫；脚本天然 dev-only。
- 演示前置流程显式 → 团队对"今天有没有跑过 roll-fixture"心里有数。
- 后续如果要变成 CI / cron 自动化，脚本可以直接被 npm scripts / GitHub Actions 调用，不会被锁死在某个运行时框架里。

### Decision 4 ─ 脚本只做平移、不调用 AI

`roll-fixture.mjs` 把 `issueDate` / `generatedAt` / `publishedAt` / `collectedAt` / `id` 按目标日期推进，其余字段（title、summary、source*）原样保留——演示当天用户看到的就是"前一天的话题，标记成今日候选"。这与"fixture 兜底"语义一致，且避免引入"AI 编造的旧新闻"。如果未来希望自动改写新闻线，那是另一个 capability 的事。

## Risks

- **R1：兜底掩盖"该补真实数据"的运维信号**。缓解：spec 强制 `staleSourceDate` 出现在响应里，前端必须显示警告条；任何对响应面向用户的渲染都不能漏过这个字段。
- **R2：fixture 校验失败时的扫描行为不直观**。设计上扫描遇到 `candidate_pool_invalid` 继续向更早回退（兜底优先），但这会让"修坏的 fixture 后悄悄被忽略"，运维不易察觉。缓解：在脚本与服务日志层 emit warning（实现时纳入 `console.warn`），并在 README 提到"修复或删除坏 fixture，否则会继续回退"。
- **R3：环境变量默认值在 prod 也是 `enabled`**。缓解：在 `.env.example` 与 README 同时标注"真实采集落地后建议设为 `disabled`"。本 change 不引入"按 NODE_ENV 自动切换"，避免暗行为。

## Migration

无数据迁移。新增的环境变量都有默认值，未设置等同启用兜底。已有的今日命中路径行为不变，只在 fixture 缺失分支多一条降级。tests 串行运行，仍走 memory repository + 临时目录，不与现有用例冲突。
