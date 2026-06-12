## Why

大翻译数据处理已经能批量并发运行，但遇到中国大陆高敏舆情、涉政口号或其他限制级内容时，模型调用容易直接失败，导致整批甚至整份任务中断。现在需要把这类内容从普通 AI 流程里分流出去，让系统在敏感内容出现时仍然能够稳定交付结果，并把高风险行明确转入人工复核。

## What Changes

- 为大翻译数据处理增加本地敏感内容预判，在模型调用前识别高风险文本。
- 命中敏感规则的行不再进入普通 AI 摘要流程，而是写入中性模板摘要并标记为人工复核。
- 扩展任务结果与运行日志，让用户能看到哪些内容被降级处理、为什么被降级，以及下一步建议。
- 保持整份任务可继续执行，避免少数敏感行拖垮整个文件。

## Capabilities

### New Capabilities
- `sensitive-content-fallback`: 为高风险内容提供本地识别、模板降级和人工复核标记能力。

### Modified Capabilities
- `large-translation-processing`: 大翻译数据处理需要在敏感行上切换到降级写回而不是直接失败。
- `validation-and-retry`: 敏感内容命中后应视为可解释降级结果，而不是可重试的上游错误。
- `workflow-run-logging`: 运行日志需要记录敏感命中、模板降级和人工复核建议。

## Impact

- Affected code: `services/worker/translation_processing/worker.py`, shared classification helpers, UI failure/result display, tests.
- Affected output contract: workbook 写回会新增“模板降级”与“人工复核”语义。
- Affected user experience: 敏感内容从“任务失败”转为“任务完成但含人工复核项”。
