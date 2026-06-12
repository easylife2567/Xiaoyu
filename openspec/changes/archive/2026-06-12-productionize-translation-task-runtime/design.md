## Context

`大翻译数据处理` 已经具备真实产品闭环，但它的运行时仍是“本地可运行切片”形态：任务状态写入 `.data/translation-processing/tasks/*.json`，上传与产物直接绑定本地目录，Node 通过本地子进程拉起 Python worker。这个实现足以验证流程，却还不是一个适合继续承载更多工作流的正式任务运行时。

项目已经具备更稳定的目标轮廓：`apps/web` 承担产品交互，`services/worker` 承担 Python 处理逻辑，`Prisma schema` 已经定义了翻译任务模型，`OpenSpec` 也明确了正式架构会朝数据库持久化、对象存储和异步 worker 演进。本次 change 的任务不是一次性完成所有生产化，而是先把最成熟的翻译任务 runtime 从 JSON 文件态升级为正式应用状态边界。

## Goals / Non-Goals

**Goals:**
- 让翻译任务、attempt、upload、artifact 元数据以 Prisma 管理的持久化记录为准，而不是本地 JSON 文件。
- 在不破坏现有前端交互和 HTTP 契约的前提下，替换任务运行时底座。
- 把上传与产物读写收敛到可替换的 storage adapter，为后续对象存储迁移预留边界。
- 保持当前 Python worker 处理链路可继续使用，并让其通过持久化任务记录与应用状态对齐。
- 让任务在应用重启后仍可查询、下载产物并查看失败上下文。

**Non-Goals:**
- 不在本次中接入 Redis / Celery，不改造成真正的队列式 worker 调度。
- 不在本次中接入 MinIO / S3，只抽象存储边界。
- 不新增日报、导出、候选池等新业务能力。
- 不重写摘要生成、分类规则或敏感内容降级逻辑。
- 不借机把整个工作流系统泛化成通用引擎。

## Decisions

### 1. 先完成“数据库持久化 + 存储适配层”，暂不把调度一起生产化

本次 change 只把任务元数据与文件访问边界正式化，继续允许 web runtime 通过现有方式触发 Python worker，而不同时引入 Celery / Redis。

**Why:** 这是最小但最值当的生产化切口。它解决了当前最脆弱的状态承载问题，又不会把数据库、队列、对象存储三种基础设施同时揉成一个高风险 change。

**Alternative considered:** 一步到位完成 Prisma + Celery + MinIO。更“完整”，但范围过大，排障维度和迁移风险都会显著上升。

### 2. 用 repository + storage adapter 替换直接文件系统读写

Node 侧的 `store.js`、`files.js` 将被拆成更明确的边界：
- runtime repository：负责 task / attempt / upload / artifact 元数据读写
- storage adapter：负责源文件与结果文件的保存、定位、读取

**Why:** 当前实现把“任务状态”“文件路径规则”“运行时目录结构”混在一起，后续无论换数据库还是换对象存储都会牵一发动全身。抽清楚边界后，业务服务仍然只处理“创建任务、启动尝试、读取最新产物”。

**Alternative considered:** 在现有 `store.js` / `files.js` 上直接拼 Prisma 查询。改动更快，但会继续放大耦合。

### 3. 保持 API 契约稳定，优先做底层替换

`/api/translation-processing/tasks` 及其子路由继续返回现有任务形状，前端轮询、诊断、日志展示逻辑尽量不需要大改。

**Why:** 当前 workbench 交互已经通过实际闭环与测试验证，最稳妥的生产化路径是“底层换掉，上层尽量不感知”。

**Alternative considered:** 同步重做 API 形状与前端状态模型。理论上更整洁，但会在 runtime 改造之外引入不必要的回归面。

### 4. 以 Prisma schema 为主线整理翻译任务数据模型

现有 `prisma/schema.prisma` 已定义 `TranslationTask`、`TranslationTaskAttempt`、`TranslationUpload`、`TranslationArtifact`。本次 change 以这些模型为主线补齐 repository 层，并根据真实运行时需要补充必要字段或 JSON 结构约束，但避免把尚未落地的泛化字段提前塞进模型。

**Why:** 这让项目从“有 schema 但没用起来”进入“正式运行时真正依赖 schema”的状态，也能避免重复造一套平行数据模型。

**Alternative considered:** 先保留 JSON 文件，再新增一套数据库镜像。过渡更平滑，但会制造双写与一致性问题。

### 5. 把当前本地文件存储保留为默认 adapter

虽然这次不接入 MinIO / S3，但 storage adapter 的默认实现仍可继续落到仓库本地 `.data/translation-processing/uploads` 与 `artifacts` 下。

**Why:** 这允许业务闭环继续工作，同时让后续对象存储迁移成为 adapter 替换，而不是全面重写服务逻辑。

**Alternative considered:** 要么完全不抽 storage seam，要么强行现在就接对象存储。前者会堵死后路，后者会让 change 过大。

## Risks / Trade-offs

- **[迁移期存在新旧数据源并存风险]** → 明确 Prisma 持久化为新 source of truth，避免长期双写；如需迁移旧 JSON，仅提供一次性开发辅助脚本。
- **[现有前端依赖的任务形状较复杂]** → 保持 service 层返回 DTO 稳定，由 repository 内部负责映射数据库记录。
- **[Python worker 仍通过本地路径运行]** → 先通过 storage adapter 提供本地可用文件引用，后续再把 worker 输入输出切到对象存储契约。
- **[Prisma 落地后本地开发依赖变重]** → 通过仓库级环境变量和明确的启动说明降低切换成本。
- **[这次未引入队列，仍有 web 触发 worker 的限制]** → 明确这只是“状态生产化”而非“调度生产化”，把下一次 change 聚焦在队列与异步执行层。

## Migration Plan

1. 以 Prisma schema 为基础，确定 translation runtime 所需的最终表结构与最小字段补充。
2. 实现 Prisma-backed repository，并在 service 层替换 JSON task store。
3. 抽出 storage adapter，先保留本地文件系统实现，替换现有直接路径访问。
4. 调整 API/service 读取路径，使任务查询、重试、下载全部依赖新的 repository + storage seam。
5. 补齐测试，验证创建任务、重试、读取产物、应用重启后恢复查询等关键场景。
6. 在本地开发环境中确认运行方式与配置契约稳定，再移除对旧 JSON task store 的默认依赖。

**Rollback strategy:** 若 Prisma runtime 集成在开发验证中出现阻塞，可暂时保留旧 store 实现作为短期回退分支，但主线 change 不保留长期双写模式。

## Open Questions

- 本次是否需要提供一次性的 JSON → 数据库迁移脚本，还是接受开发环境下重建测试数据？
- `events` / `aiCalls` 应继续以 JSON 字段持久化，还是为后续查询提前拆分子表？当前倾向于先保留 JSON，避免过度建模。
- 下载接口是否需要在本次就支持“按 artifact id 下载旧版本”，还是继续只暴露“下载最新版本”并保留底层版本元数据即可？
