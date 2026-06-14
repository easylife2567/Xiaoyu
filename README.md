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
