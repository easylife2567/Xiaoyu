## ADDED Requirements

### Requirement: Workflow runs retain structured execution logs
The system SHALL retain structured execution events for workflow tasks and attempts so that key runtime behavior can be reviewed after completion or failure.

#### Scenario: A task moves through its lifecycle
- **WHEN** a workflow task is created, validated, started, completed, or failed
- **THEN** the system SHALL retain ordered execution events describing those lifecycle transitions

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

#### Scenario: A provider call is rate limited
- **WHEN** the provider returns a rate-limit response
- **THEN** the execution log SHALL identify the failure as rate limited rather than as a generic provider outage

#### Scenario: A provider call times out
- **WHEN** the provider call exceeds its timeout
- **THEN** the execution log SHALL identify the failure as a timeout

### Requirement: Users can inspect recent task runtime history
The system SHALL provide a workbench-level way for users to inspect the recent runtime history of a task.

#### Scenario: A task fails in the workbench
- **WHEN** a user reviews a failed task
- **THEN** the workbench SHALL provide access to the recent execution history needed to understand where the run stopped
