## Why

随着 `大翻译数据处理` 接入真实 AI provider，项目已经开始出现跨运行时配置：Web 负责启动流程，Python worker 负责真正调用模型。如果继续依赖零散 shell export 或把配置分散在各子应用下，后续接入日报引擎、对象存储和生产运行时时，环境变量会很快变成隐性负担。

现在需要先建立一套仓库级、可复用、对密钥友好的运行时配置约定，让阿里云百炼等 provider 可以被清晰接入，也让 Web 与 worker 共享同一份环境来源。

## What Changes

- 建立仓库根目录级的本地运行时配置约定，使用根目录 `.env.local` 存放真实私密值，并提供可提交的 `.env.example` 作为模板。
- 显式让 Web 入口从仓库根加载环境变量，使 Next.js 与由其拉起的 Python worker 共享同一份配置。
- 将 AI provider 凭据变量从供应商命名收敛为更中性的 `XIAOYU_AI_API_KEY`，同时保留对旧 `OPENAI_API_KEY` 的兼容读取，避免一次性破坏现有运行方式。
- 在配置示例中加入阿里云百炼的 OpenAI-compatible 接入参数，降低切换到中国大模型的心智成本。
- 更新密钥忽略规则和本地运行说明，明确哪些文件可提交、哪些文件只能留在本地。

## Capabilities

### New Capabilities
- `runtime-configuration`: 定义跨运行时共享的环境配置、密钥存放和本地模板约定。

### Modified Capabilities
- None.

## Impact

- 影响仓库根配置文件、`.gitignore`、Web 启动配置和共享 AI provider 读取逻辑。
- 需要新增仓库级配置模板与运行说明。
- 对现有调用保持兼容，但会把推荐配置方式迁移到根目录 `.env.local` 与 `XIAOYU_AI_API_KEY`。
