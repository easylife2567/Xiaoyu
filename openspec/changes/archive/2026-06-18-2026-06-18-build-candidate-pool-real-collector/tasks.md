## 1. 配置与依赖

- [x] 1.1 在 [services/worker/requirements.txt](../../../services/worker/requirements.txt) 增加 `feedparser>=6.0`,首次集中登记现有 `python-docx` / `openpyxl` / `python-dateutil`(项目历史无 requirements.txt,顺手补)
- [x] 1.2 在 [apps/web/lib/daily-report/config.js](../../../apps/web/lib/daily-report/config.js) 暴露 `resolveCollectorTimeoutSeconds()`(默认 15)与 `resolveCollectorUserAgent()`(默认 `xiaoyu-daily-report/0.1`),读 `XIAOYU_DAILY_REPORT_COLLECTOR_TIMEOUT_SECONDS` / `XIAOYU_DAILY_REPORT_COLLECTOR_USER_AGENT`;命名风格对齐 `resolveDailyReportFixtureStaleWindowDays`
- [x] 1.3 在 [.env.example](../../../.env.example) 的 `# Daily report runtime` 块追加这两条环境变量,注释保留默认值

## 2. 源配置

- [x] 2.1 创建 [services/worker/daily_report/sources/](../../../services/worker/daily_report/sources/) 目录,新增 `international-daily-report.json`(用 JSON 不用 YAML,避免引入 PyYAML);schema:`{ workflowSlug, recencyHours, minCandidates, feeds: [{ name, url, language, kind }] }`,其中 `kind` 固定为 `"rss"`(为 R8 描述的后续 scraper 接入留扩展点)
- [x] 2.2 在该配置里写入 design.md R3 列出的源:**中文档**(Sputnik 中文 / RFI 中文 / 纽约时报中文网 / BBC 中文 / DW 中文)与**英语档**(BBC World / Guardian World / Al Jazeera English / DW English)。**联合早报已确认 RSS 失效,法新社中文(AFP)无公开 RSS 留给后续爬虫 change**,均不入清单。**实测**(2026-06-18):9/9 全部成功,Sputnik 100/RFI 30/纽时 20/BBC 中文 43/DW 中文 51/BBC World 32/Guardian 45/Al Jazeera 25/DW English 150 entries

## 3. Python collector 实现

- [x] 3.1 在 [services/worker/daily_report/](../../../services/worker/daily_report/collect.py) 新增 `collect.py`,实现 load/fetch/normalize/dedupe/filter/write 全套,所有内部辅助函数以 `_` 开头便于测试 monkeypatch
- [x] 3.2 在 [services/worker/daily_report/worker.py](../../../services/worker/daily_report/worker.py) 增加 `collect` 子 parser;失败时进程退出码 2(stdout 仍输出 JSON payload,Node 侧透传)
- [x] 3.3 stdout 输出 JSON 摘要;失败统一 `{ ok: false, code, message, details }`,code 集合 `source_config_missing` / `source_config_invalid` / `target_already_exists` / `no_feeds_succeeded` / `invalid_workflow`

## 4. Node 侧 npm script

- [x] 4.1 创建 [scripts/daily-report/collect-pool.mjs](../../../scripts/daily-report/collect-pool.mjs),薄包装层用 `child_process.spawnSync` 调 worker.py collect,stdio inherit stderr、透传 stdout
- [x] 4.2 在仓库根 [package.json](../../../package.json) 加 `"collect-pool": "node scripts/daily-report/collect-pool.mjs"`,与 `roll-fixture` 并列

## 5. web 侧最小改动

- [x] 5.1 在 [apps/web/lib/daily-report/candidate-pool/index.js](../../../apps/web/lib/daily-report/candidate-pool/index.js) 的 `assertCandidateShape` 把 `candidate.sourceType !== 'fixture'` 改为白名单 `Set(['fixture', 'rss'])`,错误文案升级显示完整白名单;不动 provider 接口、不动 `parseFixturePayload` 顶层校验

## 6. 测试

- [x] 6.1 新增 [services/worker/tests/test_daily_report_collect.py](../../../services/worker/tests/test_daily_report_collect.py)(放与既有 `test_daily_report_drafting.py` 同目录,与项目惯例一致),11 条用例:正常路径 / 单 feed 失败容忍 / 全 feed 失败 / 时效过滤 / 去重 / target_already_exists / --force 覆盖 / 配置缺失 / 非法 slug / 非法 date / kind=scraper 拒绝
- [x] 6.2 在 [apps/web/tests/daily-report-candidate-pool.test.js](../../../apps/web/tests/daily-report-candidate-pool.test.js) 把 "候选缺少 sourceType=fixture 时报错" 改为 "候选 sourceType 不在白名单(fixture / rss)时报错",并追加 "候选 sourceType=rss(采集器写出)能正常返回"
- [x] 6.3 `npm test` 全绿(62/62);Python 侧 `pytest services/worker/tests/test_daily_report_collect.py` 全绿(11/11)

## 7. 文档

- [x] 7.1 在 [README.md](../../../README.md) "候选池 fixture" 小节后追加 "候选池真实采集 (RSS)" 小节:`npm run collect-pool` 用法、与 `roll-fixture` 的职责区分、采集失败时兜底如何接管、可选环境变量
- [x] 7.2 在 [services/worker/daily_report/README.md](../../../services/worker/daily_report/README.md) 末尾追加 "## `collect` — RSS 采集 → fixture" 小节,含 CLI 参数、源配置 JSON schema、stdout 输出与失败 payload schema、错误码集合
- [x] 7.3 跑 `npx openspec validate 2026-06-18-build-candidate-pool-real-collector --strict` 通过

## 8. 收尾

- [ ] 8.1 PR 前手动跑一次 `npm run collect-pool -- --workflow international-daily-report`,把生成的 fixture 文件附在 PR 描述里(运维样本)
- [ ] 8.2 commit 信息链回本 change(标题前缀 `feat(daily-report):` / `test:` / `docs:`)
- [ ] 8.3 归档时由用户执行 `npx openspec archive 2026-06-18-build-candidate-pool-real-collector`
