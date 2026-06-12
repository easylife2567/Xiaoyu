## MODIFIED Requirements

### Requirement: Shared runtime configuration is available across web and worker processes
The system SHALL make the same local runtime configuration available to the web application and worker processes that it launches.

#### Scenario: Developers tune batch execution locally
- WHEN developers configure batch size, concurrency, or fallback behavior
- THEN the web runtime and launched worker SHALL read the same repository-level batch execution variables
