## Why

`大翻译数据处理` 已经证明产品闭环可用，但当前任务运行时仍依赖 `.data` 目录下的 JSON 文件、本地文件路径和进程内调度边界。继续在这套临时运行时上叠加新工作流，会让后续日报、导出和异步处理能力都建立在脆弱基础之上。

现在最值得做的是先把这条已经被验证的工作流升级到正式任务态：让任务、尝试、上传和产物元数据从本地文件状态迁入可持续演进的应用数据层，同时把文件存取和后续队列化改造的边界抽清楚。

## What Changes

- 将 `大翻译数据处理` 的任务、attempt、upload、artifact 元数据从本地 JSON 持久化迁移到 `PostgreSQL + Prisma`。
- 为翻译工作流引入清晰的 runtime repository / storage seam，让 API 与前端继续沿用现有任务契约，但底层不再直接依赖 `.data/tasks/*.json`。
- 保持现有上传、启动、轮询、失败诊断、重试、下载等产品交互不变，重点替换运行时承载方式而不是重写业务规则。
- 让任务运行状态在应用重启后仍可恢复查询，并为后续 worker 队列化和对象存储迁移保留稳定接口。
- 延续当前本地文件产物交付方式，但把上传与产物访问包装到可替换的 storage adapter 中，为后续 MinIO / S3 接入做准备。
- 保持本 change 聚焦 `大翻译数据处理` 的 runtime productionization；不新增日报能力，不改写摘要/分类业务规则，也不在本次内完成 Celery / Redis / MinIO 的全量接入。

## Capabilities

### New Capabilities
- `translation-task-runtime`: 约束大翻译工作流的正式任务运行时，包括数据库持久化、存储适配边界、尝试记录与可恢复查询行为。

### Modified Capabilities
- `workflow-run`: 将任务生命周期从“本地会话态可见”提升为“数据库持久化并可在进程重启后恢复查询”的正式运行态。
- `artifact-management`: 将大翻译结果产物从本地临时文件关联升级为通过稳定 artifact 元数据与存储适配层进行检索和下载。
- `runtime-configuration`: 扩展本地运行时配置契约，使翻译任务运行时所需的数据库与存储相关配置在仓库级别统一声明和加载。

## Impact

- 影响 `apps/web/lib/translation-processing/` 下的 task store、service、files、config 等运行时实现。
- 影响 `apps/web/app/api/translation-processing/tasks/**` 的任务读写方式，但应保持现有 HTTP 契约基本稳定。
- 影响 `apps/web/prisma/schema.prisma` 及其对应的 Prisma client / migration 使用方式。
- 影响 `.env.example` 与本地运行时配置加载逻辑。
- 影响上传与产物文件的访问边界，为后续对象存储迁移和异步队列化铺路。
