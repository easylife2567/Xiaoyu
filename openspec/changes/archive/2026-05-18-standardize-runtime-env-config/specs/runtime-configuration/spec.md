## ADDED Requirements

### Requirement: Local runtime configuration has a single repository-level source
The system SHALL use the repository root as the local development source of truth for shared runtime configuration.

#### Scenario: Developers configure local runtime variables
- **WHEN** developers prepare local configuration for the product
- **THEN** they SHALL use a root-level local environment file rather than maintaining separate secret files per runtime by default

### Requirement: Secret-bearing local environment files are excluded from version control
The system SHALL keep real local secret files out of version control while providing a safe committed template for required variables.

#### Scenario: Developers prepare a new environment
- **WHEN** a developer needs to know which variables are required
- **THEN** the repository SHALL provide a committed example file with non-secret placeholder values

#### Scenario: Developers store real credentials locally
- **WHEN** a developer adds real secret values for local execution
- **THEN** those values SHALL live in ignored local environment files rather than committed files

### Requirement: Shared runtime configuration is available across web and worker processes
The system SHALL make the same local runtime configuration available to the web application and worker processes that it launches.

#### Scenario: Web starts a worker-backed workflow
- **WHEN** the web application launches a Python worker for a workflow
- **THEN** the worker SHALL receive the same configured AI runtime variables used by the web process

### Requirement: AI provider credentials use a project-scoped configuration contract
The system SHALL support a project-scoped AI credential variable while preserving backward compatibility with the previous provider-specific variable during migration.

#### Scenario: New AI credential variable is configured
- **WHEN** `XIAOYU_AI_API_KEY` is present
- **THEN** the AI layer SHALL use it as the preferred credential source

#### Scenario: Only the legacy credential variable is configured
- **WHEN** `XIAOYU_AI_API_KEY` is absent and the legacy variable is present
- **THEN** the AI layer SHALL continue to operate using the legacy variable
