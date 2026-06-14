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
