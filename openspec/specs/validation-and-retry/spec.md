# validation-and-retry Specification

## Purpose

Validate workflow outputs before completion and provide recoverable failure handling.
## Requirements
### Requirement: Tasks run workflow-specific validations before success
The system SHALL execute the validations required by a workflow before marking a task successful.

#### Scenario: Task output violates a workflow rule
- WHEN generated output fails a required validation
- THEN the task SHALL not be marked completed successfully

#### Scenario: Large translation output is incomplete
- WHEN the processed workbook is missing required summaries or classifications for valid rows
- THEN the task SHALL fail validation before success is recorded

### Requirement: Validation failures are explainable
The system SHALL show which validation or execution failure occurred and why.

#### Scenario: A PDF exceeds the allowed page count
- WHEN validation detects the report is too long
- THEN the system identifies the failing validation to the user

#### Scenario: Large translation workbook is invalid
- WHEN input or output validation fails for 大翻译数据处理
- THEN the system SHALL identify the failing workbook rule in human-readable language

#### Scenario: AI execution fails during processing
- WHEN AI-assisted execution fails during a workflow run
- THEN the system SHALL expose a specific failure category that helps determine whether retry is appropriate

#### Scenario: A row is downgraded for sensitivity
- WHEN 大翻译数据处理 applies a sensitive-content fallback
- THEN the system SHALL explain that the row was downgraded for manual review rather than reporting it as a transient provider failure

### Requirement: Users can retry after recoverable failures
The system SHALL allow users to rerun tasks after recoverable failures.

#### Scenario: A batch fails during AI execution
- WHEN 大翻译数据处理 encounters a recoverable batch-level AI failure
- THEN the workflow SHALL first try the configured downgrade path for that batch before requiring a full task retry

