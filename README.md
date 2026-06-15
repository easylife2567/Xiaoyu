# 小舆

舆情研究工作台。包含 Next.js 产品层、Python worker、共享契约与本地基础设施定义。

## 仓库结构

```
小舆/
├── apps/web/                          Next.js 产品应用
├── services/worker/                   Python worker（大翻译数据处理 + 国际日报）
│   ├── shared/                          OpenAI 兼容 AI 调用层
│   ├── translation_processing/          大翻译数据处理 worker
│   └── daily_report/                    国际日报 worker（起草 + 导出）
├── packages/contracts/                跨运行时枚举与默认结构
├── openspec/                          长期 specs 与变更提案
└── .data/daily-report/fixtures/       日报候选池 seed fixture（入仓）
```

## 工作台

### 大翻译数据处理 (`/workbenches/translation-processing`)

- 上传 Excel → 校验 → 启动 → 实时进度 → 下载结果
- 已沉淀完整的 task / attempt / artifact 运行时（Prisma + storage adapter）

### 国际日报 (`/workbenches/international-daily-report`)

- 从仓库 seed fixture 拉取当日候选池（10 条）→ 选 6 条 → 一次性整篇 AI 起草 → 段落级编辑 → DOCX + 资源池 XLSX 导出
- AI 通道复用 `services/worker/shared/ai.py`，三种 provider：`openai` / `stub` / `fail`
- **演示无需真实模型**：设置 `XIAOYU_AI_PROVIDER=stub` 即可全流程跑通

#### 候选池 fixture 滚动 / 兜底

每天首条 fixture 由人工写入 `.data/daily-report/fixtures/<workflow>/<YYYY-MM-DD>.json`。临时演示场景下:

```bash
# 以最近一份 fixture 为模板平移生成今日 fixture(只改日期 / ID,不调 AI)
npm run roll-fixture -- --workflow international-daily-report

# 指定目标日期 / 强制覆盖
npm run roll-fixture -- --workflow international-daily-report --date 2026-06-15 --force
```

若今日 fixture 缺失且未运行脚本,服务端会自动回退到 7 天内最近一份并在响应里标 `staleSourceDate`,前端候选池区显示黄色提示条。该兜底行为可关:

```env
XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK=disabled  # 关闭兜底,缺失时直接报错
XIAOYU_DAILY_REPORT_FIXTURE_STALE_WINDOW_DAYS=7      # 回退窗口天数,0 等同关闭
```

## 本地启动

```bash
# 1) 安装依赖
npm install

# 2) 准备 .env.local（参考 .env.example）
cp .env.example .env.local
# 至少把 DATABASE_URL 与 XIAOYU_AI_* 填好

# 3) 推送 schema 到 PostgreSQL
cd apps/web && npx prisma generate && npx prisma db push

# 4) 启动开发服务
cd apps/web && npm run dev

# 5) 跑测试
cd /Users/easylife/Project/小舆 && npm test
```

> 国际日报演示路径：`XIAOYU_AI_PROVIDER=stub npm run dev` → 访问 `/workbenches/international-daily-report` → 点击 "开始今日日报"。stub provider 会用固定假数据生成草稿，无需真实模型 API key。

## OpenSpec

所有产品 / 工程契约由 [openspec/specs/](openspec/specs/) 沉淀，新功能通过 [openspec/changes/](openspec/changes/) 提案先行：

```bash
npx openspec list                  # 查看活跃变更
npx openspec show <change-name>    # 查看变更
npx openspec validate <change-name> --strict
npx openspec archive <change-name> # 完成后归档
```
