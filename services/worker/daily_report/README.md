# Daily Report Worker

为 `apps/web/lib/daily-report/python-worker.js` 调度的 Python worker，提供两个子命令：

## `draft` — 一次性整篇起草

```bash
python3 worker.py draft \
  --task-id <uuid> --attempt-id <uuid> \
  --selection '{"id":"...","title":"...","sourceName":"...","sourceUrl":"...","publishedAt":"...","summary":"..."}' \
  --selection '{...}' \
  ... (×6 for 国际日报)
```

调用 `services/worker/shared/ai.py` 中的 `generate_international_daily_report_with_trace`，
强制模型返回 `{"sections": [{"index", "title", "body"}]}`，长度必须等于输入选择数。
返回 `{"ok": true, "sections": [...], "aiCalls": [...], "events": [...]}` 或失败 payload。

## `export` — 渲染 DOCX + 追加资源池 XLSX

```bash
python3 worker.py export \
  --task-id <uuid> --attempt-id <uuid> \
  --issue-date 2026-06-12 --issue-number 1 \
  --docx-object-key <taskId>/<fileName>.docx \
  --xlsx-object-key <taskId>/<fileName>.xlsx \
  --sections-json '[{"index":1,"title":"...","body":"..."}]' \
  --selection '{...}' --selection '{...}' ...
```

- DOCX 使用 `python-docx` 渲染（无需模板文件，运行时构造一个简洁的国际日报版式）
- XLSX 优先复用 `templates/resource-pool.xlsx`（如存在），否则新建表头并追加当期记录
- 输出后执行三类校验：DOCX/XLSX 命名规则、issueNumber 一致性、一页内（≤ 2000 中文字符）；
  任何一项不通过就删除已产文件，返回 `{"ok": false, "code": "export_validation_failed", "validationReport": {...}}`。

## Templates

- `templates/international-daily-report.docx`（保留位）— 后续若需切到模板渲染，把模板放在这里并改写 `exporting.py::_render_docx`
- `templates/resource-pool.xlsx`（可选）— 资源池起始 XLSX；不存在时由 worker 创建。

## AI Provider

通过环境变量切换：

- `XIAOYU_AI_PROVIDER=stub` — 本地无密钥时生成固定假数据，便于演示与测试
- `XIAOYU_AI_PROVIDER=openai` + `XIAOYU_AI_API_KEY` / `XIAOYU_AI_MODEL` / `XIAOYU_AI_BASE_URL` — 走 OpenAI 兼容真实接口
- `XIAOYU_AI_PROVIDER=fail` — 用于测试失败路径

## 候选池 fixture

候选池数据来自仓库内 `.data/daily-report/fixtures/<workflow>/<YYYY-MM-DD>.json`,worker 不直接消费 fixture——读取由 [apps/web/lib/daily-report/candidate-pool/](../../../apps/web/lib/daily-report/candidate-pool/) 完成。

补 / 滚动 fixture 用根仓库的 dev 脚本(详见 [README.md](../../../README.md#候选池-fixture-滚动--兜底)):

```bash
npm run roll-fixture -- --workflow international-daily-report
```

兜底行为(今日 fixture 缺失时回退到最近一份)由服务端配置控制,worker 不参与。

## `collect` — RSS 采集 → fixture

```bash
python3 worker.py collect \
  --workflow international-daily-report \
  [--date 2026-06-18] \
  [--force] \
  [--fixture-root /abs/path] \
  [--timeout 15]
```

或通过仓库根 npm script:

```bash
npm run collect-pool -- --workflow international-daily-report
```

读取 `services/worker/daily_report/sources/<workflowSlug>.json`(JSON,不依赖 PyYAML),逐 feed 拉取、规范化、按 `(canonicalUrl, titleFingerprint)` 去重、按 `recencyHours` 时效过滤,最后写出与 [apps/web/lib/daily-report/candidate-pool/](../../../apps/web/lib/daily-report/candidate-pool/) 兼容的 fixture 文件:**candidate `sourceType='rss'`**,文件顶层 `sourceType='collected'`,便于在 git diff 与运维审计中与手工 fixture(`'fixture'`)区分。

源配置 schema:

```json
{
  "workflowSlug": "international-daily-report",
  "recencyHours": 24,
  "minCandidates": 6,
  "feeds": [
    { "name": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml", "language": "en", "kind": "rss" }
  ]
}
```

`kind` 当前仅支持 `"rss"`(扩展点已留,后续 wire-service / 反爬严格源的爬虫接入归后续 change 处理)。

stdout 单行 JSON 摘要:

```json
{
  "ok": true,
  "workflowSlug": "international-daily-report",
  "issueDate": "2026-06-18",
  "written": "/abs/path/to/2026-06-18.json",
  "candidateCount": 256,
  "feedReports": [
    { "name": "BBC World", "url": "...", "fetched": 32, "kept": 32, "errors": null }
  ],
  "warnings": null
}
```

失败 payload(退出码 2):

```json
{ "ok": false, "code": "no_feeds_succeeded", "message": "...", "details": {...} }
```

错误码集合:`source_config_missing` / `source_config_invalid` / `target_already_exists` / `no_feeds_succeeded` / `invalid_workflow`。
