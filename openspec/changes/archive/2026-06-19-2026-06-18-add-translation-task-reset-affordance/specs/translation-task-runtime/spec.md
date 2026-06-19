## ADDED Requirements

### Requirement: Translation task supports user-triggered reset

The system SHALL provide a user-triggered reset operation that removes a translation task and all its associated runtime records (attempts, artifacts) regardless of the task's current status. This guarantees that users can always unblock from a stuck or undesired task state — including states from which `retry` is not allowed (e.g., `processing` that has stalled, `ready` whose source file the user wants to replace, or any other inconsistent state). After reset, the workbench SHALL return to its initial empty state, allowing the user to create a new task with a fresh upload.

#### Scenario: Reset a task that is stuck in processing

- **WHEN** a translation task is in `processing` status (where `retry` would be rejected) and the user invokes `重置任务`
- **THEN** the system SHALL delete the task record and all its associated attempts and artifacts from persistent storage
- **AND** the workbench SHALL return to its initial empty state with no current task selected
- **AND** subsequent `GET /api/translation-processing/tasks/{taskId}` requests for that task ID SHALL return a 404 not-found response

#### Scenario: Reset is safe to invoke even when the task no longer exists

- **WHEN** the user invokes reset for a task ID that was already removed (e.g., from a stale browser tab) or never existed
- **THEN** the system SHALL respond with success (200) without raising a server error
- **AND** the operation SHALL be idempotent — calling reset again on the same task ID SHALL produce the same outcome

#### Scenario: A new task can be created after reset

- **WHEN** the user resets a task and then uploads a new workbook
- **THEN** the system SHALL create a fresh translation task with no carryover from the deleted task's attempts, artifacts, or status
- **AND** the new task SHALL be assigned a new task ID independent of the deleted one
