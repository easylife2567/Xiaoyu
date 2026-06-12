# Follow-up Change Candidate

## Suggested change name

`productionize-translation-processing-runtime`

## Why next

`build-large-translation-processing-flow` 已经证明了大翻译业务闭环可以跑通，但当前仍依赖本地文件持久化、进程内调度和本地 worker seam。下一步应把这条已经成立的业务链路迁移到项目既定的正式运行时，避免后续更多工作流建立在临时基础设施之上。

## Expected scope

- 将任务、尝试、上传和产物记录迁移到 PostgreSQL + Prisma。
- 将进程内调度替换为 Redis-backed Celery worker。
- 将上传文件与结果产物迁移到 MinIO / S3-compatible object storage。
- 增加基础 infra 配置、环境变量契约和本地开发启动方式。
- 保持现有工作台和大翻译业务行为不变，只替换运行时承载方式。

## Explicitly not in scope

- 不新增日报能力。
- 不重做大翻译业务规则。
- 不建设通用工作流编辑器。
