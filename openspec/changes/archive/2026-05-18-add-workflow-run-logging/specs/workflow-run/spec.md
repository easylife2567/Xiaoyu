## MODIFIED Requirements

### Requirement: Task runs retain operational context
The system SHALL retain inputs, execution attempts, structured runtime events, failure details, and outputs for each task run.

#### Scenario: User reviews a completed task
- WHEN a user opens a completed 大翻译数据处理 task
- THEN the system SHALL show the input workbook, run status, processing summary, and produced artifact

#### Scenario: User reviews a failed task
- WHEN a user opens a failed workflow task
- THEN the system SHALL retain enough structured runtime context to show where the run stopped and what category of failure occurred
