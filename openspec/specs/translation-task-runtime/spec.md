# translation-task-runtime Specification

## Purpose

Define the persisted runtime that backs `大翻译数据处理` tasks, including database-backed task and attempt records, recoverable lifecycle queries, and a replaceable storage boundary for uploaded workbooks and generated artifacts.
## Requirements
### Requirement: Translation tasks persist runtime records in the application data layer
The system SHALL persist translation task runtime records in the application data layer rather than relying on local JSON task files as the source of truth.

#### Scenario: A valid workbook creates a task
- **WHEN** a user uploads a valid workbook for `大翻译数据处理`
- **THEN** the system SHALL create a persisted translation task record with its status, validation summary, upload metadata, and workflow identifier

#### Scenario: The web process restarts after task creation
- **WHEN** the application process restarts after a translation task has already been created
- **THEN** the system SHALL still be able to query that task and return its latest persisted status

### Requirement: Translation attempts are durably versioned per task
The system SHALL persist each translation execution attempt as a durable child record of the task, preserving attempt order, outcome, diagnostics, and produced artifact linkage.

#### Scenario: A task is retried after failure
- **WHEN** a user retries a failed translation task
- **THEN** the system SHALL create a new persisted attempt for the same task instead of replacing the previous attempt record

#### Scenario: A completed task is rerun
- **WHEN** a user reruns a completed translation task according to supported workflow behavior
- **THEN** the system SHALL preserve prior attempt history and associate any new output artifact with the new attempt

### Requirement: Translation runtime file access uses a replaceable storage boundary
The system SHALL access uploaded workbooks and generated result files through a replaceable storage boundary rather than hard-coding runtime behavior directly to one local file-path scheme.

#### Scenario: The runtime needs the source workbook for processing
- **WHEN** the translation worker starts a task attempt
- **THEN** the system SHALL resolve the input workbook through the configured storage boundary and provide the worker with a usable source file reference

#### Scenario: The runtime needs to deliver the latest result workbook
- **WHEN** a user downloads the latest translation artifact
- **THEN** the system SHALL retrieve that artifact through the storage boundary using persisted artifact metadata rather than assuming a single implicit local path contract

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

