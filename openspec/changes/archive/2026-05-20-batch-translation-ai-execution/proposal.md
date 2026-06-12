## Why

大翻译数据处理当前已经支持真实 AI 调用与行级并发，但整体执行模型仍以“单行一次调用”为主，导致大文件处理速度过慢，并且每次上游波动都会放大为长尾耗时。现在需要把执行模型升级为“批量调用 + 并发调度”，在不牺牲可追踪性与失败恢复能力的前提下明显提升吞吐。

## What Changes

- 将大翻译数据处理的摘要生成从单行调用升级为批量调用。
- 为批量执行增加可配置的批大小与并发数，并提供仓库级环境变量模板。
- 当批量调用失败或返回不可用结果时，自动降级到更细粒度的处理路径，而不是整份任务直接报废。
- 扩展运行日志与失败摘要，使用户能看见批次处理、降级处理与失败落点。

## Capabilities

### New Capabilities
- `batch-ai-execution`: 为 AI 驱动的工作流提供批量调用、并发调度与降级处理能力。

### Modified Capabilities
- `large-translation-processing`: 大翻译数据处理从逐行摘要升级为批量摘要执行。
- `ai-processing`: 共享 AI 层支持批量输入、批量输出校验与批量调用追踪。
- `validation-and-retry`: 批量失败需要可解释并可降级恢复，而不是仅支持整任务重试。
- `runtime-configuration`: 运行时配置需要新增批大小、批量并发与批量降级开关。
- `workflow-run-logging`: 运行日志需要记录批次开始、批次成功、批次失败与降级事件。

## Impact

- Affected code: `services/worker/shared/ai.py`, `services/worker/translation_processing/worker.py`, `apps/web/src/translation-processing-log.js`, tests and env docs.
- Affected runtime contract: root `.env.local` / `.env.example` gain batch-related variables.
- Affected user experience: task logs and失败说明将从行级视角扩展到批次视角。
