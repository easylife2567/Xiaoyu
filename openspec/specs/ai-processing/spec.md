# ai-processing Specification

## Purpose

Provide a shared, traceable layer for AI-assisted summarization, drafting, labeling, and generation.
## Requirements
### Requirement: AI work is invoked through a shared processing layer
The system SHALL route AI-assisted work through a shared processing layer rather than embedding model calls separately in each workflow.

#### Scenario: Different workflows need AI output
- WHEN multiple workflows require summaries, drafts, labels, or other AI-generated content
- THEN they use the shared AI processing layer

#### Scenario: 大翻译数据处理 needs summaries
- WHEN the large-translation workflow generates Chinese summaries
- THEN it SHALL invoke the shared AI processing layer instead of embedding workflow-specific model calls directly in the task runner

### Requirement: Workflow-specific prompts and rules are configurable
The system SHALL allow workflow templates to supply their own prompts or generation rules to the shared AI layer.

#### Scenario: Large translation summary rules are applied to a batch
- WHEN 大翻译数据处理 requests summaries for multiple rows in one call
- THEN the shared AI layer SHALL apply the workflow-specific instructions to the full batch and return aligned summaries

### Requirement: AI processing is traceable
The system SHALL retain enough request, response, timing, and diagnostic context to audit AI-assisted task execution.

#### Scenario: A batch summary call is generated
- WHEN the shared AI layer completes a batch provider call
- THEN the trace SHALL retain batch size, row-range context, provider outcome, and timing information without storing secrets

### Requirement: AI failures are surfaced
The system SHALL surface AI processing failures to the workflow run instead of silently discarding them.

#### Scenario: Model invocation fails
- WHEN AI processing times out or returns an error
- THEN the workflow run SHALL fail visibly with a retriable error

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

#### Scenario: Provider returns a valid batch response
- WHEN the provider returns summaries for a batch
- THEN the shared AI layer SHALL normalize the response into one non-empty summary per input item

#### Scenario: Provider returns malformed batch content
- WHEN the provider response cannot be mapped back to the full batch
- THEN the shared AI layer SHALL surface an explainable failure instead of silently accepting partial output

### Requirement: Production AI calls remain traceable and recoverable
The system SHALL preserve enough metadata about production AI calls to associate generated outputs and failures with the originating workflow execution.

#### Scenario: A production summary is generated
- **WHEN** the shared AI layer completes a provider call for a row summary
- **THEN** the system SHALL retain the association between the task run, the originating row, the provider context, and the generated result

#### Scenario: A production provider fails transiently
- **WHEN** the configured provider times out or returns a recoverable upstream failure
- **THEN** the shared AI layer SHALL surface a retriable workflow failure that can follow the existing retry path

