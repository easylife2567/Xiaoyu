## MODIFIED Requirements

### Requirement: AI calls retain diagnostic metadata
The system SHALL retain diagnostic metadata for AI calls without storing secrets.

#### Scenario: An AI call completes
- **WHEN** an AI provider call succeeds or fails
- **THEN** the system SHALL retain its start time, end time, duration, provider, model, originating row context, outcome, and available provider identifiers

#### Scenario: Sensitive values are present during execution
- **WHEN** the system records AI diagnostic metadata
- **THEN** it SHALL NOT store API keys or other secret credential values in the execution log

#### Scenario: An AI call is retried automatically
- **WHEN** the system performs an automatic retry for an AI call
- **THEN** the execution log SHALL retain the retry attempt index, retry budget, and retry delay information
