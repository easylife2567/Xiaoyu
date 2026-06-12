## MODIFIED Requirements

### Requirement: Workflow-specific prompts and rules are configurable
The system SHALL allow workflow templates to supply their own prompts or generation rules to the shared AI layer.

#### Scenario: Large translation summary rules are applied to a batch
- WHEN 大翻译数据处理 requests summaries for multiple rows in one call
- THEN the shared AI layer SHALL apply the workflow-specific instructions to the full batch and return aligned summaries

### Requirement: AI processing is traceable
The system SHALL retain enough request, response, timing, and diagnostic context to audit AI-assisted task execution.

#### Scenario: A batch summary call is generated
- WHEN the shared AI layer completes a batch provider call
- THEN the trace SHALL retain batch size, row-range context, provider outcome, and timing information without storing secrets

### Requirement: AI outputs are normalized before workflow acceptance
The system SHALL validate and normalize provider outputs before returning them to workflow logic.

#### Scenario: Provider returns a valid batch response
- WHEN the provider returns summaries for a batch
- THEN the shared AI layer SHALL normalize the response into one non-empty summary per input item

#### Scenario: Provider returns malformed batch content
- WHEN the provider response cannot be mapped back to the full batch
- THEN the shared AI layer SHALL surface an explainable failure instead of silently accepting partial output
