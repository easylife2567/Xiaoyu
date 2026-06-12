# workflow-run Specification

## Purpose

Manage the lifecycle of a workflow task from creation through execution, completion, and retry.
## Requirements
### Requirement: Users can run tasks from workflow templates
The system SHALL allow users to create and execute tasks from supported workbenches according to each workflow's operating model.

#### Scenario: User starts from the home page
- WHEN a user opens the application home page
- THEN the system SHALL present the supported v1 workbench entries on the first screen

#### Scenario: User opens a file-processing workbench
- WHEN a user selects the 大翻译数据处理 workbench
- THEN the system SHALL show a file-processing layout with input, status, and result regions

#### Scenario: User starts 大翻译数据处理
- WHEN a user has uploaded a valid workbook and starts processing
- THEN the system SHALL create and execute a task instance for that workflow

#### Scenario: User opens a daily-report workbench
- WHEN a user selects 国际日报 or 国际热点日报二处
- THEN the system SHALL show a daily-report layout with candidate-pool, selected-story, draft, and export regions

### Requirement: Tasks expose a clear lifecycle
The system SHALL expose task state in the workbench interface from upload through completion or failure, using persisted runtime state that remains queryable outside a single in-memory process lifetime.

#### Scenario: User views a workbench before real processing is connected
- WHEN a downstream capability is not yet implemented in the current product stage
- THEN the workbench SHALL show a clear empty or forthcoming state rather than pretending the task completed

#### Scenario: Uploaded task is ready
- WHEN a valid workbook has been accepted for 大翻译数据处理
- THEN the task SHALL be visible as ready to process

#### Scenario: Task progresses through execution
- WHEN the task moves through queued, processing, completed, or failed states
- THEN the workbench SHALL reflect the latest task state to the user

#### Scenario: The application process restarts during the task lifecycle
- **WHEN** a translation task already exists before a web-process restart
- **THEN** the workbench SHALL be able to recover and display the latest persisted task state after the process returns

### Requirement: Task runs retain operational context
The system SHALL retain inputs, execution attempts, structured runtime events, failure details, and outputs for each task run in durable runtime records rather than only transient local process memory.

#### Scenario: User reviews a completed task
- WHEN a user opens a completed 大翻译数据处理 task
- THEN the system SHALL show the input workbook, run status, processing summary, and produced artifact

#### Scenario: User reviews a failed task
- WHEN a user opens a failed workflow task
- THEN the system SHALL retain enough structured runtime context to show where the run stopped and what category of failure occurred

#### Scenario: The application restarts after a task finishes
- **WHEN** a translation task was previously completed or failed before the application restarts
- **THEN** the system SHALL still be able to retrieve the task attempts, failure details, and artifact associations for review

### Requirement: Failed tasks can be rerun
The system SHALL allow users to rerun failed tasks without recreating the task from scratch.

#### Scenario: Task fails during processing
- WHEN 大翻译数据处理 fails for a recoverable reason
- THEN the user SHALL be able to view the failure reason and retry the same task

