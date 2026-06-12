## ADDED Requirements

### Requirement: AI processing can use a configured production provider
The system SHALL allow the shared AI processing layer to connect to a configured production provider using server-side configuration without exposing credentials to workflow code or client code.

#### Scenario: Large translation requests a real summary
- **WHEN** 大翻译数据处理 invokes AI generation with a valid provider configuration
- **THEN** the shared AI layer SHALL call the configured provider and return the generated Chinese summary to the workflow

#### Scenario: Credentials are missing
- **WHEN** a workflow requests AI generation but the required provider credentials are not configured
- **THEN** the shared AI layer SHALL fail visibly with a configuration error and SHALL NOT expose secret values

### Requirement: AI outputs are normalized before workflow acceptance
The system SHALL validate and normalize provider outputs before returning them to workflow logic.

#### Scenario: Provider returns a usable summary
- **WHEN** the provider returns a non-empty summary response
- **THEN** the shared AI layer SHALL extract and normalize the summary before the workflow writes it into the workbook

#### Scenario: Provider returns unusable content
- **WHEN** the provider response is empty, malformed, or cannot yield a valid summary
- **THEN** the shared AI layer SHALL surface an explainable processing failure instead of silently accepting invalid output

### Requirement: Production AI calls remain traceable and recoverable
The system SHALL preserve enough metadata about production AI calls to associate generated outputs and failures with the originating workflow execution.

#### Scenario: A production summary is generated
- **WHEN** the shared AI layer completes a provider call for a row summary
- **THEN** the system SHALL retain the association between the task run, the originating row, the provider context, and the generated result

#### Scenario: A production provider fails transiently
- **WHEN** the configured provider times out or returns a recoverable upstream failure
- **THEN** the shared AI layer SHALL surface a retriable workflow failure that can follow the existing retry path
