## MODIFIED Requirements

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

#### Scenario: Two workflows use different drafting styles
- WHEN two workflows invoke AI generation
- THEN each receives output according to its own configured instructions

#### Scenario: Large translation summary rules are applied
- WHEN 大翻译数据处理 requests row summaries
- THEN the shared AI layer SHALL apply the workflow-specific instructions for concise Chinese one-sentence output

### Requirement: AI processing is traceable
The system SHALL retain enough request and response context to audit AI-assisted task execution.

#### Scenario: User reviews a generated result
- WHEN a task uses AI processing
- THEN the system preserves the association between the task, its inputs, and the generated output

#### Scenario: A row summary is generated
- WHEN the workflow generates a summary for a row
- THEN the generated result SHALL remain associated with the originating task run

### Requirement: AI failures are surfaced
The system SHALL surface AI processing failures to the workflow run instead of silently discarding them.

#### Scenario: Model invocation fails
- WHEN AI processing times out or returns an error
- THEN the workflow run SHALL fail visibly with a retriable error
