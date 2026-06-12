## MODIFIED Requirements

### Requirement: Tasks run workflow-specific validations before success
The system SHALL execute the validations required by a workflow before marking a task successful.

#### Scenario: Task output violates a workflow rule
- WHEN generated output fails a required validation
- THEN the task SHALL not be marked completed successfully

#### Scenario: Large translation output is incomplete
- WHEN the processed workbook is missing required summaries or classifications for valid rows
- THEN the task SHALL fail validation before success is recorded

### Requirement: Validation failures are explainable
The system SHALL show which validation failed and why.

#### Scenario: A PDF exceeds the allowed page count
- WHEN validation detects the report is too long
- THEN the system identifies the failing validation to the user

#### Scenario: Large translation workbook is invalid
- WHEN input or output validation fails for 大翻译数据处理
- THEN the system SHALL identify the failing workbook rule in human-readable language

### Requirement: Users can retry after recoverable failures
The system SHALL allow users to rerun tasks after recoverable failures.

#### Scenario: User fixes the issue or retries generation
- WHEN a failed task is retried
- THEN the system SHALL process the task again without requiring full recreation

#### Scenario: AI generation fails transiently
- WHEN 大翻译数据处理 fails because the AI layer returns a recoverable error
- THEN the user SHALL be able to retry the task using the existing uploaded workbook
