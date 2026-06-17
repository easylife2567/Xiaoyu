# 小舆

**面向舆情研究、资料翻译与日报生产的 AI 工作台。**

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6.9-2d3748)](https://www.prisma.io/)
[![Python Worker](https://img.shields.io/badge/Python-worker-3776ab)](https://www.python.org/)
[![OpenSpec](https://img.shields.io/badge/OpenSpec-driven-5b5bd6)](openspec/specs/)

> 小舆把文档处理、AI 起草、候选池筛选、运行时追踪和产物导出串成可复用的工作台流程。它适合承接高频、格式化、需要人工审校的舆情研究任务：人负责判断，系统负责稳定地搬运、生成和留痕。

![小舆工作台首页](docs/images/xiaoyu-homepage.png)

---

## 为什么需要这个项目？

目前国家舆情实验室有许多重复劳动：Excel 原始材料要清洗，外文资料要翻译和归类，日报候选要筛选，最终还要导出 DOCX / XLSX 交付件。小舆解决的是这条链路里的“重复劳动”问题，让研究人员将中心放在舆情研判和分析等关键性工作上，小舆将成为一个一站式工作台，让国舆的老师和同学们在这个工作站上处理各种日常事务：

```text
原始资料 / 候选新闻 ──► [小舆工作台] ──► AI 摘要 / 起草 / 分类 ──► 人工审校 ──► DOCX / XLSX 产物
                              ▲                                      │
                              └──────── 任务状态 / 日志 / 产物记录 ◄──┘
```

- **工作台化**：不同生产任务以独立 workbench 承载，避免脚本散落。
- **AI 可替换**：通过 OpenAI 兼容接口接入真实模型，也支持 `stub` provider 本地演示。
- **文档友好**：把 Excel、DOCX 等重文档处理放到 Python worker，Web 层专注交互与编排。
- **过程可追踪**：任务、批次、运行事件、产物都沉淀在运行时模型中，便于排错和复盘。
- **规格先行**：核心能力通过 OpenSpec 管理，降低长期迭代时的契约漂移。

---

## 成品预览

### 工作台首页

进入首页后选择要处理的生产任务。当前内置大翻译数据处理、国际日报、国际热点日报二处等工作台。

![工作台首页截图](docs/images/xiaoyu-homepage.png)

### 国际日报

从候选新闻池中选择 6 条新闻，填写期号后启动日报生产；右侧同步展示已选篮子、正文草稿和导出区状态。

![国际日报截图](docs/images/xiaoyu-daily-report.png)

### 大翻译数据处理

上传 Excel 后，系统会展示上传校验、队列进入、批量处理、结果交付等步骤，并实时刷新处理进度、批次状态和运行日志。

![大翻译数据处理截图](docs/images/xiaoyu-translation-processing.png)

### 系统架构与生产流程

Next.js 负责产品交互、API 路由和任务编排；Python worker 负责 Excel、DOCX、AI 批处理等耗时任务；共享契约放在 `packages/contracts`，规格沉淀在 `openspec`。

大翻译数据处理和国际日报共享“上传/选择 → 处理/起草 → 审校 → 导出”的生产范式，但各自保留独立的状态机和产物模型。

![系统架构图](docs/images/xiaoyu-architecture.svg)

![双工作流图](docs/images/xiaoyu-workflows.svg)

---

## 已实现功能

| 模块 | 功能 | 状态 |
|------|------|------|
| **工作台外壳** | 总览页、工作台入口、流程状态展示 | 已完成 |
| **大翻译数据处理** | Excel 上传、校验、任务启动、实时进度、失败诊断、结果下载 | 已完成 |
| **大翻译运行时** | task / attempt / artifact 模型、Prisma 仓储、本地存储适配 | 已完成 |
| **国际日报** | 当日候选池加载、6 条候选选择、整篇 AI 起草、段落级编辑 | 已完成 |
| **日报导出** | DOCX 日报、资源池 XLSX 导出、任务产物记录 | 已完成 |
| **候选池 fixture** | 仓库 seed fixture、最近 7 天回退、日期滚动脚本 | 已完成 |
| **AI 通道** | OpenAI 兼容 provider、stub provider、fail provider、重试与批处理配置 | 已完成 |
| **工程规格** | OpenSpec specs、变更提案、归档记录 | 持续维护 |

---

## 典型使用场景

### 场景一：大翻译数据处理

上传原始 Excel，系统完成结构校验、批量 AI 摘要与分类、进度刷新、失败诊断和结果文件导出。

```text
Excel 上传 → 表格校验 → 启动任务 → 批量 AI 处理 → 进度追踪 → 下载结果
```

访问路径：

```text
/workbenches/translation-processing
```

### 场景二：国际日报生产

从当日候选池中选择 6 条新闻，调用 AI 一次性生成整篇日报，编辑段落后导出 DOCX 与资源池 XLSX。

```text
候选池 → 选择 6 条 → AI 起草 → 段落审校 → DOCX / XLSX 导出
```

访问路径：

```text
/workbenches/international-daily-report
```

### 场景三：无模型密钥演示

把 `XIAOYU_AI_PROVIDER` 设为 `stub`，即可用固定假数据跑通日报流程，不需要真实模型 API key。

```bash
XIAOYU_AI_PROVIDER=stub npm --workspace apps/web run dev
```

---

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- PostgreSQL 14+（大多数完整运行场景需要）
- Python 3.10+（文档 worker 使用）

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制示例配置：

```bash
cp .env.example .env.local
```

至少确认以下变量：

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/xiaoyu
XIAOYU_AI_PROVIDER=openai
XIAOYU_AI_MODEL=qwen3.6-plus
XIAOYU_AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
XIAOYU_AI_API_KEY=replace-with-your-local-secret
```

本地演示日报流程可改为：

```env
XIAOYU_AI_PROVIDER=stub
```

### 初始化数据库

```bash
cd apps/web
npx prisma generate
npx prisma db push
```

### 启动开发服务

```bash
npm --workspace apps/web run dev
```

打开：

```text
http://localhost:3000
```

### 运行测试

```bash
npm test
```

按能力运行：

```bash
npm run test:translation-processing
```

---

## 候选池 fixture

国际日报依赖每日候选池 fixture：

```text
.data/daily-report/fixtures/<workflow>/<YYYY-MM-DD>.json
```

临时演示可以把最近一份 fixture 平移成今日数据：

```bash
npm run roll-fixture -- --workflow international-daily-report
```

指定日期并覆盖：

```bash
npm run roll-fixture -- --workflow international-daily-report --date 2026-06-15 --force
```

如果今日 fixture 缺失，服务端默认回退到 7 天内最近一份，并在响应中标记 `staleSourceDate`。可通过环境变量关闭或调整窗口：

```env
XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK=disabled
XIAOYU_DAILY_REPORT_FIXTURE_STALE_WINDOW_DAYS=7
```

---

## 项目结构

```text
小舆/
├── apps/web/                         # Next.js 产品应用
│   ├── app/                          # 页面与 API route
│   ├── components/                   # 工作台 UI
│   ├── lib/                          # 工作流服务、仓储、worker 调用
│   ├── prisma/                       # Prisma schema
│   └── tests/                        # Node test runner 测试
├── services/worker/                  # Python worker
│   ├── shared/                       # OpenAI 兼容 AI 调用层
│   ├── translation_processing/       # 大翻译数据处理
│   └── daily_report/                 # 日报起草与导出
├── packages/contracts/               # 跨运行时枚举与默认结构
├── scripts/daily-report/             # 候选池滚动等脚本
├── docs/images/                      # README 配图
├── openspec/                         # 长期规格与变更提案
└── .data/daily-report/fixtures/      # 日报候选池 seed fixture
```

---

## OpenSpec 工作流

产品和工程契约沉淀在 [openspec/specs/](openspec/specs/) 中，新能力通过 [openspec/changes/](openspec/changes/) 先写提案再实现。

```bash
npx openspec list
npx openspec show <change-name>
npx openspec validate <change-name> --strict
npx openspec archive <change-name>
```

---

## 注意事项

- 不要提交 `.env.local`、真实 API key、数据库密码或模型密钥。
- `XIAOYU_AI_PROVIDER=stub` 适合演示和本地流程验证，真实生产请使用 OpenAI 兼容 provider。
- 文档处理逻辑优先放在 `services/worker`，不要把重文件转换塞进 Web request path。
- 修改共享状态、枚举或产物结构时，同步检查 `packages/contracts`、Prisma schema 和相关 OpenSpec。
- 推送前建议至少运行 `npm test`，涉及 Web 构建时运行 `npm run build`。

---

## 参考

README 组织方式参考了 [cv-cat/Spider_XHS](https://github.com/cv-cat/Spider_XHS)：第一屏定位、项目价值说明、配图预览、功能表、快速开始和项目结构。
