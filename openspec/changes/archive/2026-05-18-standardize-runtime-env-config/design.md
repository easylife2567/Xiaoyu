## Context

当前项目已经同时存在 Next.js Web 层与 Python worker。虽然它们现在都能通过进程环境读取配置，但真实 AI provider 接入后，项目已经开始依赖一组跨运行时共享的敏感配置：provider、model、base URL、timeout、API key。继续依赖开发者手工 `export`，或把 `.env` 文件散落到各自子目录，会让“谁读取哪一份配置”逐渐变得含混。

这次 change 要把配置层从“能跑”整理到“以后不容易乱”：仓库根成为统一事实源，Web 进程显式从根目录加载 env，worker 继承同一份运行时环境，AI provider 凭据改用项目语义化命名，并保留对旧变量的兼容。

## Goals / Non-Goals

**Goals:**
- 为仓库建立统一的本地运行时配置入口与模板。
- 让 Web 与 Python worker 在本地开发中共享同一份根目录配置。
- 为百炼等 OpenAI-compatible provider 提供清晰的示例参数。
- 将 AI key 命名收敛到项目命名空间，同时平滑兼容旧配置。
- 明确 secret 文件的忽略规则与提交边界。

**Non-Goals:**
- 不在本 change 中建设远程 secret manager、配置后台或多环境发布系统。
- 不把所有未来基础设施变量一次性补齐。
- 不改变现有 AI provider adapter 的协议抽象，也不引入新的 provider UI。
- 不把 `.env.local` 视作生产环境的最终凭据管理方案。

## Decisions

### 1. 仓库根目录作为本地配置事实源

真实本地配置使用根目录 `.env.local`，模板使用根目录 `.env.example`。`.env.local` 被忽略，`.env.example` 可提交。

**Why:** Web 与 worker 都属于同一个产品运行时，配置如果跟着子应用分裂，后续每加一个服务都会增加认知税。

**Alternative considered:** 继续只在 `apps/web/.env.local` 存放变量。对当前单一入口最省事，但一旦 worker 需要独立运行或新增更多服务，结构会立刻显得偏心。

### 2. Web 启动时显式加载仓库根 env

新增一个根配置加载模块，在 Web 运行入口侧用 `@next/env` 读取仓库根 `.env*` 文件，再让 worker 继承 Node 进程环境。

**Why:** Next.js 默认更偏向读取自身项目根；显式加载可以把“仓库根就是配置源”变成代码约定，而不是依赖启动目录的偶然性。

**Alternative considered:** 要求所有人手动在 shell 中 `source .env.local`。这会把项目可靠性建立在记忆上，不够稳。

### 3. 新旧 AI key 变量平滑迁移

推荐新变量 `XIAOYU_AI_API_KEY`，同时在读取逻辑中兼容旧 `OPENAI_API_KEY`。

**Why:** 新变量更准确地描述“这是小舆项目自己的 AI 凭据”，不把协议层和供应商名字混在一起；兼容旧变量则避免现有环境瞬间失效。

**Alternative considered:** 直接删除 `OPENAI_API_KEY`。语义最干净，但会让刚接通的链路立刻出现不必要断裂。

### 4. `.env.example` 记录形状，不记录秘密

模板只保留变量名、示例值和必要注释；真实密钥永不进入模板、代码或提交历史。

**Why:** 这样既能让新成员一分钟内知道该填什么，也能把“可提交”和“不可提交”的边界画得很清楚。

**Alternative considered:** 只写文档，不放模板文件。信息仍然存在，但复制成本更高，也更容易遗漏。

## Risks / Trade-offs

- **[根目录加载逻辑与 Next 默认行为不一致]** → 显式封装在单一模块中，并用测试固定预期。
- **[双变量兼容期会延长迁移窗口]** → 文档明确新变量优先级，旧变量仅作兼容回退。
- **[开发者误把真实 key 写进 `.env.example`]** → 模板仅保留占位值，并把 `.env.local` / `.env.*.local` 全部加入忽略规则。
- **[未来生产环境配置方式不同]** → 本 change 只定义本地开发约定，生产环境继续由部署层注入。
