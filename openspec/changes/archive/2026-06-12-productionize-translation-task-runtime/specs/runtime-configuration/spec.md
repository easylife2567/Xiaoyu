## MODIFIED Requirements

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
