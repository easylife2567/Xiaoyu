# validation-and-retry Specification

## Purpose

Validate workflow outputs before completion and provide recoverable failure handling.

## Requirements

### Requirement: Tasks run workflow-specific validations before success

The system SHALL execute the validations required by a workflow before marking a task successful.

#### Scenario: Task output violates a workflow rule

- WHEN generated output fails a required validation
- THEN the task is not marked completed successfully

### Requirement: Validation failures are explainable

The system SHALL show which validation failed and why.

#### Scenario: A PDF exceeds the allowed page count

- WHEN validation detects the report is too long
- THEN the system identifies the failing validation to the user

### Requirement: Users can retry after recoverable failures

The system SHALL allow users to rerun tasks after recoverable failures.

#### Scenario: User fixes the issue or retries generation

- WHEN a failed task is retried
- THEN the system processes the task again without requiring full recreation
