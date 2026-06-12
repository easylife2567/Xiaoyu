## MODIFIED Requirements

### Requirement: Users can retry after recoverable failures
The system SHALL allow recoverable workflow failures to be retried first by the system within bounded limits and then by the user if automatic recovery still fails.

#### Scenario: User fixes the issue or retries generation
- WHEN a failed task is retried
- THEN the system SHALL process the task again without requiring full recreation

#### Scenario: AI generation fails transiently
- WHEN 大翻译数据处理 fails because the AI layer returns a recoverable error
- THEN the system SHALL first execute the configured automatic retry policy and SHALL still allow the user to retry using the existing uploaded workbook if automatic recovery is exhausted
