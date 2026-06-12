## MODIFIED Requirements

### Requirement: Users can retry after recoverable failures
The system SHALL allow users to rerun tasks after recoverable failures.

#### Scenario: A batch fails during AI execution
- WHEN 大翻译数据处理 encounters a recoverable batch-level AI failure
- THEN the workflow SHALL first try the configured downgrade path for that batch before requiring a full task retry
