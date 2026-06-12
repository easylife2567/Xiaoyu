# runtime-configuration Specification

## Purpose
TBD - created by archiving change standardize-runtime-env-config. Update Purpose after archive.
## Requirements
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
The system SHALL make the same local runtime configuration available across the web application, Prisma-backed translation runtime, and worker processes that it launches.

#### Scenario: Developers tune batch execution locally
- **WHEN** developers configure batch size, concurrency, or fallback behavior
- **THEN** the web runtime and launched worker SHALL read the same repository-level batch execution variables

#### Scenario: Developers configure the translation task database runtime
- **WHEN** developers provide the database connection settings required by the persisted translation runtime
- **THEN** the web application and runtime repositories SHALL load those settings from the same repository-level configuration contract

#### Scenario: Developers configure the active translation storage adapter
- **WHEN** developers provide storage-related runtime settings for upload and artifact access
- **THEN** the web runtime and launched worker SHALL read those settings from the same repository-level configuration contract

### Requirement: AI provider credentials use a project-scoped configuration contract
The system SHALL support a project-scoped AI credential variable while preserving backward compatibility with the previous provider-specific variable during migration.

#### Scenario: New AI credential variable is configured
- **WHEN** `XIAOYU_AI_API_KEY` is present
- **THEN** the AI layer SHALL use it as the preferred credential source

#### Scenario: Only the legacy credential variable is configured
- **WHEN** `XIAOYU_AI_API_KEY` is absent and the legacy variable is present
- **THEN** the AI layer SHALL continue to operate using the legacy variable

