## MODIFIED Requirements

### Requirement: Workflow runs retain structured execution logs
The system SHALL retain structured execution events for workflow tasks and attempts so that key runtime behavior can be reviewed after completion or failure.

#### Scenario: A translation batch starts and completes
- WHEN 大翻译数据处理 runs AI work in batches
- THEN the task log SHALL retain batch-level execution events with the affected row range

### Requirement: Logged failures distinguish actionable categories
The system SHALL classify logged failures into actionable categories that can guide recovery behavior.

#### Scenario: A batch is downgraded after failure
- WHEN a batch-level AI attempt fails and the workflow falls back to finer-grained execution
- THEN the execution log SHALL record that downgrade action before subsequent recovery work proceeds
