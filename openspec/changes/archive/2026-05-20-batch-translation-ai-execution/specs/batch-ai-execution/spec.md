## ADDED Requirements

### Requirement: AI workflows can submit batched summary work
The system SHALL allow an AI-driven workflow to submit multiple summary inputs in a single provider call.

#### Scenario: Translation worker groups rows into a batch
- WHEN the translation worker has multiple eligible source rows
- THEN it SHALL be able to send them to the shared AI layer as one batch request

### Requirement: Batched AI work supports configurable concurrency
The system SHALL support concurrent execution of multiple AI batches using runtime configuration.

#### Scenario: A large workbook is processed
- WHEN the workflow contains enough rows to form multiple batches
- THEN the worker SHALL execute batches up to the configured concurrency limit

### Requirement: Failed batches can downgrade to finer-grained execution
The system SHALL support an automatic fallback path when a batch fails or returns unusable output.

#### Scenario: A batch call fails
- WHEN a batch provider call fails recoverably or cannot be parsed into usable summaries
- THEN the workflow SHALL be able to retry that batch using a finer-grained execution path instead of failing the entire task immediately
