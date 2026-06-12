## MODIFIED Requirements

### Requirement: AI processing is traceable
The system SHALL retain enough request, response, timing, and diagnostic context to audit AI-assisted task execution.

#### Scenario: User reviews a generated result
- WHEN a task uses AI processing
- THEN the system preserves the association between the task, its inputs, and the generated output

#### Scenario: A row summary is generated
- WHEN the workflow generates a summary for a row
- THEN the generated result SHALL remain associated with the originating task run

#### Scenario: A production AI call fails
- WHEN a production AI call fails
- THEN the system SHALL retain enough non-secret diagnostic context to distinguish common failure categories
