## Why

[stabilize-candidate-pool-fixture-supply](../archive/2026-06-17-2026-06-15-stabilize-candidate-pool-fixture-supply/proposal.md) 把"演示开天窗"的风险降到了零——今日 fixture 缺失会回退到最近一份并通过 `staleSourceDate` 提醒运维。但**全部候选池仍是 fixture 文件**,数据是手工预制的样本,与 [news-candidate-pool spec](../../specs/news-candidate-pool/spec.md) 反复强调的"`Candidate pools are grounded in real sources`"相距甚远。fixture 兜底只解决"今天能开张"的问题,不解决"今天的内容是真的"。

继续等"完美的真实采集"会让 spec 与实现长期分裂;同时,真实采集落地后,fixture 兜底依然是合规的最后一道保险——两者在 [apps/web/lib/daily-report/candidate-pool/index.js](../../../apps/web/lib/daily-report/candidate-pool/index.js) 的 provider 接口下天然共存。现在用最小代价(纯 RSS + feedparser、零密钥、Python worker 写 fixture 文件)把"真实数据"这条路打通,既兑现 spec 总体约束,又不破坏 fixture 兜底。

非目标:不接付费 API、不上爬虫、不引入调度(cron / 启动钩子)、不动 Prisma、不改 web 侧 candidate-pool 模块的对外契约,这些都留给后续 change。

## What Changes

- 新增 [services/worker/daily_report/collect.py](../../../services/worker/daily_report/) 与 `worker.py collect` 子命令:从配置的 RSS 源拉取条目、规范化、按 `(规范化 sourceUrl, title 指纹)` 去重、按 workflow 时效窗口过滤(默认 24h),写出与 fixture 同 schema 的 `<workflowSlug>/<issueDate>.json`,**`sourceType` 字段值改为 `rss`** 而非 `fixture`,以便审计中区分"手工 fixture"与"真实采集"。
- 新增 [services/worker/daily_report/sources/](../../../services/worker/daily_report/) 配置目录:每 workflow 一份 **JSON 文件**(与现有 worker stdlib-only 风格对齐,避免引入 PyYAML),声明 RSS feed 列表、时效窗口、最低候选条数;首批先配 `international-daily-report` 一组以**中文母语优先**的源(Sputnik 中文 / RFI 中文 / 纽约时报中文网 / BBC 中文 / DW 中文)+ 英语补充(BBC World / Guardian World / Al Jazeera / DW English)。9 个源已在 2026-06-18 实测全部可用,具体 URL 与实测结果在 design.md R3 列出;联合早报 RSS 已失效不接;法新社中文(AFP)无公开 RSS,留给后续以爬虫为核心的 change 处理。
- 修订 [news-candidate-pool spec](../../specs/news-candidate-pool/spec.md):新增"`Candidate pool collector pulls from configured live source feeds`"与"`Each candidate carries an explicit origin sourceType`"两条 Requirement,后者把 `sourceType` 从"必为 `fixture`"放宽为已知枚举(至少含 `fixture` / `rss`)。drafting / export 消费方对 `sourceType` 不做语义判断。
- 微调 [apps/web/lib/daily-report/candidate-pool/index.js](../../../apps/web/lib/daily-report/candidate-pool/index.js) 的 `assertCandidateShape` 校验:把 `sourceType !== 'fixture'` 的硬断言改为白名单校验(`['fixture', 'rss']`),允许采集出来的 fixture 文件被同一 provider 直接读;其余(staleSourceDate 兜底、provider 接口、API 路由、前端、Prisma)**完全不动**。
- 新增 [package.json](../../../package.json) `collect-pool` npm script(对齐 `roll-fixture` 风格):`node scripts/daily-report/collect-pool.mjs --workflow <slug>` —— 一层薄包装,把参数转给 `services/worker/daily_report/worker.py collect`,并复用现有 [apps/web/lib/daily-report/python-worker.js](../../../apps/web/lib/daily-report/python-worker.js) 的 Python 解析约定。
- 新增配置 / 文档:[.env.example](../../../.env.example) 增 `XIAOYU_DAILY_REPORT_COLLECTOR_TIMEOUT_SECONDS` 与 `XIAOYU_DAILY_REPORT_COLLECTOR_USER_AGENT`;[README.md](../../../README.md) 与 [services/worker/daily_report/README.md](../../../services/worker/daily_report/README.md) 增"候选池真实采集 (RSS)"一节。
- 测试:Python 侧用 `pytest` 覆盖 collect.py 的去重 / 时效过滤 / 单 feed 失败容忍 / 全 feed 失败 / 输出 schema;Node 侧追加一条用例覆盖"读取 sourceType=rss 的 fixture 文件"路径。

## Capabilities

### Modified Capabilities

- `news-candidate-pool`:新增"真实 RSS 采集器"行为 + `sourceType` 枚举升级。fixture 兜底语义保持不变;现有"基于真实可检索源"的总体约束首次得到实现兑现。

## Impact

- 新增 [services/worker/daily_report/collect.py](../../../services/worker/daily_report/) 与 `sources/` 配置目录(纯 worker 侧)。
- 新增 [scripts/daily-report/collect-pool.mjs](../../../scripts/daily-report/),对齐 [roll-fixture.mjs](../../../scripts/daily-report/roll-fixture.mjs) 风格。
- 微调 [apps/web/lib/daily-report/candidate-pool/index.js](../../../apps/web/lib/daily-report/candidate-pool/index.js) 一处 sourceType 白名单(provider 对外契约不变)。
- 影响 [openspec/specs/news-candidate-pool/spec.md](../../specs/news-candidate-pool/spec.md):2 条 ADDED Requirement。
- 影响 [.env.example](../../../.env.example) / [README.md](../../../README.md) / [services/worker/daily_report/README.md](../../../services/worker/daily_report/README.md)。
- 影响 [package.json](../../../package.json):新 npm script。
- 不影响 Prisma schema、API 路由、前端组件、起草 / 编辑 / 导出流程、翻译模块。
- 不引入调度,采集时机由人工或外部 cron 触发(后续 change `schedule-daily-candidate-pool-prep` 处理)。
