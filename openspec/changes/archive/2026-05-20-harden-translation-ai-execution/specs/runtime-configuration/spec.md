## MODIFIED Requirements

### Requirement: AI provider credentials use a project-scoped configuration contract
The system SHALL support a project-scoped AI credential variable while preserving backward compatibility with the previous provider-specific variable during migration.

#### Scenario: New AI credential variable is configured
- **WHEN** `XIAOYU_AI_API_KEY` is present
- **THEN** the AI layer SHALL use it as the preferred credential source

#### Scenario: Only the legacy credential variable is configured
- **WHEN** `XIAOYU_AI_API_KEY` is absent and the legacy variable is present
- **THEN** the AI layer SHALL continue to operate using the legacy variable

#### Scenario: AI timeout and retry parameters are configured
- **WHEN** operators configure AI execution tuning for the local runtime
- **THEN** the system SHALL accept repository-level environment variables for timeout and bounded retry behavior
