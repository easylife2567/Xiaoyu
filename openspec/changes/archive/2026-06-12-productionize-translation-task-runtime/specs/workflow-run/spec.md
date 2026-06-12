## MODIFIED Requirements

### Requirement: Tasks expose a clear lifecycle
The system SHALL expose task state in the workbench interface from upload through completion or failure, using persisted runtime state that remains queryable outside a single in-memory process lifetime.

#### Scenario: User views a workbench before real processing is connected
- **WHEN** a downstream capability is not yet implemented in the current product stage
- **THEN** the workbench SHALL show a clear empty or forthcoming state rather than pretending the task completed

#### Scenario: Uploaded task is ready
- **WHEN** a valid workbook has been accepted for 大翻译数据处理
- **THEN** the task SHALL be visible as ready to process

#### Scenario: Task progresses through execution
- **WHEN** the task moves through queued, processing, completed, or failed states
- **THEN** the workbench SHALL reflect the latest task state to the user

#### Scenario: The application process restarts during the task lifecycle
- **WHEN** a translation task already exists before a web-process restart
- **THEN** the workbench SHALL be able to recover and display the latest persisted task state after the process returns

### Requirement: Task runs retain operational context
The system SHALL retain inputs, execution attempts, structured runtime events, failure details, and outputs for each task run in durable runtime records rather than only transient local process memory.

#### Scenario: User reviews a completed task
- **WHEN** a user opens a completed 大翻译数据处理 task
- **THEN** the system SHALL show the input workbook, run status, processing summary, and produced artifact

#### Scenario: User reviews a failed task
- **WHEN** a user opens a failed workflow task
- **THEN** the system SHALL retain enough structured runtime context to show where the run stopped and what category of failure occurred

#### Scenario: The application restarts after a task finishes
- **WHEN** a translation task was previously completed or failed before the application restarts
- **THEN** the system SHALL still be able to retrieve the task attempts, failure details, and artifact associations for review
