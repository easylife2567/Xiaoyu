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
