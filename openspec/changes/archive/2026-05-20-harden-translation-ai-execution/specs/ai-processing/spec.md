## MODIFIED Requirements

### Requirement: AI processing can use a configured production provider
The system SHALL allow the shared AI processing layer to connect to a configured production provider using server-side configuration without exposing credentials to workflow code or client code.

#### Scenario: Large translation requests a real summary
- **WHEN** 大翻译数据处理 invokes AI generation with a valid provider configuration
- **THEN** the shared AI layer SHALL call the configured provider and return the generated Chinese summary to the workflow

#### Scenario: Credentials are missing
- **WHEN** a workflow requests AI generation but the required provider credentials are not configured
- **THEN** the shared AI layer SHALL fail visibly with a configuration error and SHALL NOT expose secret values

#### Scenario: Recoverable provider failure occurs
- **WHEN** the configured provider returns a recoverable timeout, rate-limit, or transient upstream failure
- **THEN** the shared AI layer SHALL perform a bounded automatic retry sequence before surfacing final failure to the workflow
