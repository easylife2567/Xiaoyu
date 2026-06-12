# workflow-run-logging Specification

## Purpose
TBD - created by archiving change add-workflow-run-logging. Update Purpose after archive.
## Requirements
### Requirement: Workflow runs retain structured execution logs
The system SHALL retain structured execution events for workflow tasks and attempts so that key runtime behavior can be reviewed after completion or failure.

#### Scenario: A translation batch starts and completes
- WHEN 大翻译数据处理 runs AI work in batches
- THEN the task log SHALL retain batch-level execution events with the affected row range

### Requirement: AI calls retain diagnostic metadata
The system SHALL retain diagnostic metadata for AI calls without storing secrets.

#### Scenario: An AI call completes
- **WHEN** an AI provider call succeeds or fails
- **THEN** the system SHALL retain its start time, end time, duration, provider, model, originating row context, outcome, and available provider identifiers

#### Scenario: Sensitive values are present during execution
- **WHEN** the system records AI diagnostic metadata
- **THEN** it SHALL NOT store API keys or other secret credential values in the execution log

### Requirement: Logged failures distinguish actionable categories
The system SHALL classify logged failures into actionable categories that can guide recovery behavior.

#### Scenario: A batch is downgraded after failure
- WHEN a batch-level AI attempt fails and the workflow falls back to finer-grained execution
- THEN the execution log SHALL record that downgrade action before subsequent recovery work proceeds

### Requirement: Users can inspect recent task runtime history
The system SHALL provide a workbench-level way for users to inspect the recent runtime history of a task.

#### Scenario: A task fails in the workbench
- **WHEN** a user reviews a failed task
- **THEN** the workbench SHALL provide access to the recent execution history needed to understand where the run stopped

#### Scenario: A user reviews a completed task with downgraded rows
- **WHEN** the task completed using sensitive-content fallback for some rows
- **THEN** the workbench SHALL expose enough runtime history for the user to identify which rows were downgraded and why

