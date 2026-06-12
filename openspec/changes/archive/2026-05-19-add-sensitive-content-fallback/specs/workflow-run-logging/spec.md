## MODIFIED Requirements

### Requirement: Workflow runs retain structured execution logs
The system SHALL retain structured execution events for workflow tasks and attempts so that key runtime behavior can be reviewed after completion or failure.

#### Scenario: A row is routed to sensitive fallback
- WHEN 大翻译数据处理 detects a sensitive row and applies fallback handling
- THEN the task log SHALL record the row scope, the downgrade action, and that human review is required

### Requirement: Users can inspect recent task runtime history
The system SHALL provide a workbench-level way for users to inspect the recent runtime history of a task.

#### Scenario: A user reviews a completed task with downgraded rows
- WHEN the task completed using sensitive-content fallback for some rows
- THEN the workbench SHALL expose enough runtime history for the user to identify which rows were downgraded and why
