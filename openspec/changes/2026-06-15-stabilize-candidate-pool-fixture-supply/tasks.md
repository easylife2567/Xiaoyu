## 1. 候选池服务：兜底回退逻辑

- [x] 1.1 在 [apps/web/lib/daily-report/config.js](../../../apps/web/lib/daily-report/config.js) 暴露 `resolveDailyReportFixtureStaleFallbackEnabled()` 与 `resolveDailyReportFixtureStaleWindowDays()`，分别读 `XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK`（默认 `enabled`）与 `XIAOYU_DAILY_REPORT_FIXTURE_STALE_WINDOW_DAYS`（默认 `7`，必须 ≥1）
- [x] 1.2 在 [apps/web/lib/daily-report/candidate-pool/index.js](../../../apps/web/lib/daily-report/candidate-pool/index.js) 抽出 `loadFixtureFile(workflowSlug, issueDate)` 内部辅助函数（命中返回 parsed payload，缺失返回 null，其它解析/校验错误照旧抛 `candidate_pool_invalid`）
- [x] 1.3 在同一文件实现 `findMostRecentFixture(workflowSlug, requestedIssueDate, windowDays)`：从 requested 日期前一天倒推 `windowDays` 天，命中即返回 `{ payload, sourceDate }`，全部缺失返回 null；扫描过程中遇到 `candidate_pool_invalid` 应继续向更早日期回退（兜底语义优先）
- [x] 1.4 重写 `FixtureCandidatePoolProvider.getCandidatePool({ issueDate })`：先按原路径读 today；命中走原行为；缺失时若 fallback 关闭则维持 `candidate_pool_fixture_missing`；fallback 开启则调用 `findMostRecentFixture`，命中返回 candidates + `staleSourceDate=sourceDate`，requestedIssueDate 不变
- [~] 1.5 ~~在 packages/contracts/daily-report.js 暴露 STALE_SOURCE_DATE_FIELD 常量~~ — **跳过**:执行时只有 1 处前端消费点(workbench.jsx 读 `pool.staleSourceDate`),常量化反而增加噪音。字段名通过 spec + 测试 + 文档共同锁定。

## 2. API 契约

- [x] 2.1 [apps/web/app/api/daily-report/candidate-pools/[workflowSlug]/[issueDate]/route.js](../../../apps/web/app/api/daily-report/candidate-pools/[workflowSlug]/[issueDate]/route.js)：在响应 JSON 顶层透出 `staleSourceDate`（仅当兜底命中时）；error 响应保持 `candidate_pool_fixture_missing` 形状不变 — **无需改动**:provider 返回的对象上多了字段会随 `Response.json({ pool })` 自动透传
- [x] 2.2 在 [apps/web/lib/daily-report/service.js](../../../apps/web/lib/daily-report/service.js) 的 `getCandidatePool` 包装层透传 `staleSourceDate` — **无需改动**:service.js 当前不包装 `getCandidatePool`,API route 直接从 candidate-pool 模块取数

## 3. 工作台前端提示

- [x] 3.1 [apps/web/components/daily-report-workbench.jsx](../../../apps/web/components/daily-report-workbench.jsx) 在候选池侧栏标题下渲染 stale banner:仅在 `staleSourceDate` 存在时出现,文案"使用 X 月 X 日的候选池"+ 提示运行 roll-fixture
- [x] 3.2 [apps/web/app/globals.css](../../../apps/web/app/globals.css) 增 `.stale-pool-banner` / `__title` / `__detail` / `code` 样式(amber-50/200/800/900)
- [x] 3.3 不阻塞既有路径:选择 6 条、起草、编辑、导出按钮在兜底状态下行为完全一致(provider 已保证 issueDate=today)

## 4. dev 脚本：滚动 / 补档

- [x] 4.1 创建 [scripts/daily-report/](../../../scripts/daily-report/) 目录;在仓库根 `package.json` 加 `"roll-fixture": "node scripts/daily-report/roll-fixture.mjs"`
- [x] 4.2 实现 [scripts/daily-report/roll-fixture.mjs](../../../scripts/daily-report/roll-fixture.mjs):CLI、no_source_fixture(2)、target_already_exists(3)、--force、字段平移(id 含源日期则替换日期段、publishedAt/collectedAt 按 (target-source) 天数平移、generatedAt 固定 01:30Z)、stdout 输出 JSON 摘要
- [x] 4.3 在 [README.md](../../../README.md)(国际日报章节内)与 [services/worker/daily_report/README.md](../../../services/worker/daily_report/README.md)(末尾)各加一节"候选池 fixture 滚动 / 兜底"

## 5. 测试

- [x] 5.1 [apps/web/tests/daily-report-candidate-pool.test.js](../../../apps/web/tests/daily-report-candidate-pool.test.js) 追加 4 个用例(共 9 个全过):兜底命中、回退窗口内无 fixture、fallback 关闭、命中今日不带 staleSourceDate
- [x] 5.2 新增 [apps/web/tests/daily-report-roll-fixture.test.js](../../../apps/web/tests/daily-report-roll-fixture.test.js):正常路径、no_source_fixture(2)、target_already_exists(3)、缺 --workflow(1)、--force 覆盖,共 5 个用例,使用 `spawnSync` 调脚本
- [x] 5.3 串行 `npm test` 全绿(61/61),不引入 worker 侧用例

## 6. 配置 & 文档

- [x] 6.1 [.env.example](../../../.env.example) 增补两条 `XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK` 与 `XIAOYU_DAILY_REPORT_FIXTURE_STALE_WINDOW_DAYS`(注释保留默认值与禁用方式)
- [x] 6.2 README 在国际日报描述后追加"候选池 fixture 滚动 / 兜底"小节,含 npm script 用法 + 兜底环境变量说明
- [x] 6.3 跑 `npx openspec validate 2026-06-15-stabilize-candidate-pool-fixture-supply --strict`

## 7. 收尾

- [ ] 7.1 PR/commit 信息链回本 change
- [ ] 7.2 归档时由用户执行 `npx openspec archive 2026-06-15-stabilize-candidate-pool-fixture-supply`
