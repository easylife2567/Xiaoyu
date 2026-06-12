## Context

`大翻译数据处理` 已经有一条本地可运行的端到端链路：前端可以上传文件，后端可以创建任务，worker 可以读取 Excel、做规则分类并写回结果。当前唯一仍然是“假动作”的关键环节，是 `services/worker/shared/ai.py` 中的共享 AI seam：它只支持 `stub` / `fail` 两种测试模式，对真实 provider 仍直接报错。

这次 change 要补上的不是新的业务流程，而是一个足够稳、足够小的真实 AI 接入层。它需要满足三件事：第一，密钥和模型配置不能进入代码；第二，工作流不应知道具体 provider 细节；第三，上游异常必须能被解释、记录并回到现有重试路径。

## Goals / Non-Goals

**Goals:**
- 让 `大翻译数据处理` 可以通过共享 AI 层调用一个真实 provider 生成中文一句话摘要。
- 用环境变量定义 provider 配置契约，使本地和未来部署环境都能安全注入凭据。
- 在 worker 侧完成最小必要的请求封装、响应提取、输出规范化和错误归类。
- 保持任务与 AI 结果之间的可追溯关系，并让 transient failure 继续沿用现有重试语义。
- 为后续多工作流复用同一 AI 层保留清晰边界，而不是把模型调用重新散落回各个 workflow。

**Non-Goals:**
- 不在本 change 中建设 provider 管理后台、模型切换 UI 或提示词编辑器。
- 不扩展到日报类工作流，也不改动它们的候选池或成稿逻辑。
- 不在本 change 中把本地运行时升级为 Prisma / Celery / S3 正式生产架构。
- 不提前建设复杂的多 provider 路由、A/B 模型实验、成本看板或完整 observability 平台。

## Decisions

### 1. 先落一个 OpenAI-compatible adapter，而不是一开始就做多供应商抽象层

共享 AI 层继续暴露稳定的 workflow-facing 函数，内部新增一个由配置驱动的 provider adapter。第一版只实现一个 OpenAI-compatible adapter，并通过 `XIAOYU_AI_PROVIDER`、`XIAOYU_AI_MODEL`、`XIAOYU_AI_BASE_URL`、`OPENAI_API_KEY` 等环境变量注入配置。

**Why:** 当前真正要解决的问题是“让业务链路开始产出真实结果”，不是“提前支持所有供应商”。OpenAI-compatible 协议覆盖面广，足够作为第一根梁；等第二个真实 provider 出现时，再让抽象长到它自然该有的尺寸。

**Alternative considered:** 直接同时支持多个供应商。灵活，但会在还没有第二个需求之前引入过度抽象、额外测试面和配置复杂度。

### 2. 让 workflow 只关心领域结果，不直接接触 provider response

`大翻译数据处理` 仍只调用 `generate_chinese_summary(...)` 这样的领域函数。provider response 的解析、空值检查、文本清洗、长度边界和错误转换全部留在共享 AI 层完成。

**Why:** 这样可以保护 workflow 代码不被上游协议污染，后续换模型时也不需要把业务流程一并拆开重修。

**Alternative considered:** 在 worker 主流程中直接调用 SDK 并处理 response。实现看似更短，但会把 provider 耦合重新塞回业务代码。

### 3. 把“配置错误”和“调用失败”拆开表达

共享 AI 层至少区分两类失败：
1. 启动前即可判断的配置失败，例如凭据缺失、provider/model 配置不完整；
2. 运行中发生的调用失败，例如超时、网络错误、上游 5xx、不可解析响应。

前者给出明确配置提示，后者映射为可重试的任务失败。

**Why:** 这能让使用者和维护者都更快判断该“修环境”还是“稍后重试”，也避免把所有失败都糊成一个黑盒。

**Alternative considered:** 统一抛一个 RuntimeError。编码最省事，但会让用户和系统都失去最有价值的分辨率。

### 4. 先做最小可用追踪，不在本 change 中引入重型观测系统

每次 AI 调用至少保留与 task / row / generated output 的关联，并记录 provider 名称、model、调用结果、失败摘要等基础元数据。当前继续沿用现有本地任务持久化边界，不额外引入专门的 tracing backend。

**Why:** 现阶段最重要的是确保“这条摘要是从哪次处理来的”可以被还原。完整链路追踪和成本统计属于后续规模化问题，不应抢跑到这个 change。

**Alternative considered:** 现在就接入完整日志与指标系统。方向正确，但会把一条本来很清爽的 AI 接入 change 拉成基础设施项目。

### 5. 测试继续保留 stub/fail provider，真实 provider 通过契约测试隔离

`stub` 和 `fail` 模式继续存在，保证大翻译主链路在无真实凭据时仍可稳定测试。新增对真实 adapter 的单元测试、配置校验测试和 response normalization 测试；实际网络调用不进入默认测试套件。

**Why:** 这样既能保证本地测试确定性，也能避免 CI 因真实密钥、网络或调用额度而变脆。

**Alternative considered:** 所有测试都改走真实模型。更接近生产，但成本高、非确定、也不适合基础回归。

## Risks / Trade-offs

- **[第一版 adapter 只覆盖一类协议]** → 先把边界做稳；待第二类 provider 出现时，再基于真实差异扩展抽象。
- **[模型输出仍可能漂移]** → 通过固定 workflow instruction、结果清洗和有效性校验收窄波动；异常输出显式失败而非静默写回。
- **[用户把密钥错误写入仓库]** → 只接受环境变量注入，并补充本地运行说明与启动前校验。
- **[真实调用引入新的失败面]** → 保留 stub/fail 测试模式，新增 provider 错误映射，并沿用现有 retry 机制。
- **[未来生产化运行时会再次调整持久化边界]** → 当前只固化语义，不把实现绑死在本地文件存储。
