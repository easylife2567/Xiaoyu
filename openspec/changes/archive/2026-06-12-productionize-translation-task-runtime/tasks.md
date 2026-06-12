## 1. 数据模型与运行时边界

- [x] 1.1 审核并补齐 `apps/web/prisma/schema.prisma` 中翻译任务相关模型，使其能承载 task、attempt、upload、artifact 的正式运行时记录
- [x] 1.2 在 `apps/web/lib/translation-processing/` 下引入清晰的 runtime repository 接口，替换当前直接面向 JSON 文件的 task store 边界
- [x] 1.3 为上传文件与产物文件抽出 storage adapter 接口，并保留本地文件系统默认实现

## 2. 持久化运行时接入

- [x] 2.1 实现 Prisma-backed translation runtime repository，覆盖任务创建、任务查询、attempt 创建、attempt 完成/失败、artifact 追加等核心操作
- [x] 2.2 将现有 translation service 改为依赖 repository + storage adapter，而不是直接依赖 `.data/tasks/*.json` 和硬编码路径
- [x] 2.3 调整 worker 输入输出解析路径，使处理链路继续可用并通过新的存储边界获取源文件与产物

## 3. API 与工作台兼容

- [x] 3.1 更新 `app/api/translation-processing/tasks/**` 路由，使其继续返回现有任务契约，但底层读取新的持久化运行时
- [x] 3.2 确认前端工作台的轮询、失败诊断、运行日志和下载入口在新 runtime 下无需行为回退
- [x] 3.3 保证任务在应用重启后仍可查询最近状态、attempt 历史和最新 artifact 下载能力

## 4. 配置、验证与收尾

- [x] 4.1 扩展仓库级运行时配置契约，补齐数据库与存储适配相关的本地开发变量说明
- [x] 4.2 为 repository、service、API 和关键恢复场景补充或更新测试，覆盖创建任务、重试任务、读取 artifact、重启后恢复查询等路径
- [x] 4.3 移除对旧 JSON task store 的默认主路径依赖，并补充必要的迁移说明或开发期回退说明
