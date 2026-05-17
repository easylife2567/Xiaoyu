# ai-processing Specification

## Purpose

Provide a shared, traceable layer for AI-assisted summarization, drafting, labeling, and generation.

## Requirements

### Requirement: AI work is invoked through a shared processing layer

The system SHALL route AI-assisted work through a shared processing layer rather than embedding model calls separately in each workflow.

#### Scenario: Different workflows need AI output

- WHEN multiple workflows require summaries, drafts, labels, or other AI-generated content
- THEN they use the shared AI processing layer

### Requirement: Workflow-specific prompts and rules are configurable

The system SHALL allow workflow templates to supply their own prompts or generation rules to the shared AI layer.

#### Scenario: Two workflows use different drafting styles

- WHEN two workflows invoke AI generation
- THEN each receives output according to its own configured instructions

### Requirement: AI processing is traceable

The system SHALL retain enough request and response context to audit AI-assisted task execution.

#### Scenario: User reviews a generated result

- WHEN a task uses AI processing
- THEN the system preserves the association between the task, its inputs, and the generated output

### Requirement: AI failures are surfaced

The system SHALL surface AI processing failures to the workflow run instead of silently discarding them.

#### Scenario: Model invocation fails

- WHEN AI processing times out or returns an error
- THEN the workflow run fails visibly with a retriable error
