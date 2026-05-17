# workflow-template Specification

## Purpose

Define reusable workflow packages that capture stable task behavior for repeated use.

## Requirements

### Requirement: Templates define reusable task packages

The system SHALL support workflow templates that package stable task behavior into reusable configurations.

#### Scenario: Template defines the full task contract

- WHEN a workflow template is created
- THEN it defines required inputs, processing behavior, prompts or rules, outputs, and validations

### Requirement: Templates can be copied without changing the source template

The system SHALL allow users to create a new template from an existing template while preserving the original template unchanged.

#### Scenario: User copies a template for slight variation

- WHEN a user copies a workflow template and edits the copy
- THEN the original template remains unchanged

### Requirement: Templates are versioned

The system SHALL preserve template versions so historical tasks remain reproducible.

#### Scenario: A template changes after a task is run

- WHEN a task is created from template version A and the template later changes to version B
- THEN the task remains associated with version A
