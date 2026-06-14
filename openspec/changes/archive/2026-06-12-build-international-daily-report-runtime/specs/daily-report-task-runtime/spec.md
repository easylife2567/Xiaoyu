## ADDED Requirements

### Requirement: The runtime stores daily-report tasks through a formal persistence layer

The system SHALL persist daily-report tasks, selections, draft versions, and artifacts through a database-backed runtime repository that survives application restarts.

#### Scenario: Task is created for today's 国际日报
- **WHEN** a user opens the 国际日报 workbench and creates a task for a given issueDate
- **THEN** the system SHALL create a DailyReportTask record with status `drafting_pending`, bound to that issueDate and issueNumber

#### Scenario: Task survives a process restart
- **WHEN** the application process restarts between drafting and export
- **THEN** the workbench SHALL recover and display the latest task state from the database upon reopening

### Requirement: Each task is uniquely scoped to a workflow and issue date

The system SHALL enforce that no two non-failed DailyReportTask records share the same `(workflowSlug, issueDate)` pair, so a given workbench has at most one in-progress or completed task per day.

#### Scenario: User tries to create a duplicate task
- **WHEN** the user attempts to create a 国际日报 task for an issueDate that already has a non-failed task
- **THEN** the system SHALL refuse the new task and surface the existing task instead

### Requirement: Task creation accepts an explicit issueDate parameter

The system SHALL accept an explicit `issueDate` on task creation and enforce that only `issueDate = today` is valid in the current runtime, while keeping the API shape open for future backfill support.

#### Scenario: User creates a task for today
- **WHEN** the user creates a 国际日报 task with issueDate = today
- **THEN** the system SHALL create the task and associate it with that issueDate

#### Scenario: User attempts to create a task for a non-today date
- **WHEN** the user creates a task with any issueDate other than today
- **THEN** the system SHALL reject the task with `unsupported_issue_date` without persisting any record

### Requirement: The task lifecycle exposes drafting, editing, exporting, and failure states

The system SHALL expose a DailyReportTask status field whose values cover at least: `drafting_pending`, `drafting_in_progress`, `drafting_ready_for_review`, `exporting_in_progress`, `completed`, and `failed`, so the workbench can render a single coherent status per task.

#### Scenario: Task moves from drafting to ready-for-review
- **WHEN** a draft attempt completes successfully
- **THEN** the task status SHALL transition to `drafting_ready_for_review`

#### Scenario: Task moves to completed after export
- **WHEN** an export attempt completes successfully and all validations pass
- **THEN** the task status SHALL transition to `completed`

#### Scenario: Draft or export attempt fails
- **WHEN** any attempt fails for a recoverable or unrecoverable reason
- **THEN** the task status SHALL transition to `failed` with a structured failure payload retained on the task

### Requirement: The runtime retains candidate selections as independent records

The system SHALL store each user-selected candidate as a DailyReportSelection row, capturing both the candidate metadata snapshot and the selection position.

#### Scenario: User selects six candidates
- **WHEN** the user finalizes six candidates for the report
- **THEN** the system SHALL persist each selection with its position (1..6), a frozen snapshot of the candidate payload, and the task reference

#### Scenario: User replaces a selection before drafting starts
- **WHEN** the user removes one candidate and adds another before triggering drafting
- **THEN** the system SHALL replace the selection set atomically, preserving position ordering

### Requirement: Draft versions are stored with source provenance

The system SHALL store each generated or edited draft as a DailyReportDraftVersion record, distinguishing AI-generated and user-edited versions by an explicit `source` field, and SHALL never mutate an existing version in place.

#### Scenario: AI generates the first draft
- **WHEN** the AI draft attempt completes
- **THEN** the system SHALL create a DraftVersion with `source=ai_generated`, `version=1`, and all sections

#### Scenario: User edits a section and saves
- **WHEN** the user saves a section edit
- **THEN** the system SHALL create a new DraftVersion with `source=user_edited`, an incremented `version`, and the updated sections

### Requirement: Artifacts are linked to the exact draft version used during export

The system SHALL record the `draftVersionId` and `kind` on each DailyReportArtifact so any exported artifact can be traced back to the specific draft version and product (DOCX report / resource-pool XLSX / future kinds) that produced it.

#### Scenario: DOCX export succeeds
- **WHEN** a DOCX report artifact is produced
- **THEN** the artifact record SHALL reference the `draftVersionId` that was current at export time and have `kind=docx_report`

#### Scenario: Resource-pool XLSX is updated as part of the same export
- **WHEN** the resource-pool XLSX artifact is produced
- **THEN** the artifact record SHALL reference the same `draftVersionId` and have `kind=resource_pool_xlsx`

### Requirement: Source files and produced artifacts are accessed through a storage adapter

The system SHALL access candidate-pool fixtures, exported artifacts, and any binary inputs/outputs through a storage adapter interface, defaulting to a local-filesystem implementation, so future MinIO/S3 migration is a single adapter swap.

#### Scenario: A workflow reads candidate-pool fixture content
- **WHEN** the runtime needs to read the candidate pool fixture for a given workflow and issueDate
- **THEN** it SHALL read through the storage adapter rather than touching the filesystem directly

#### Scenario: A workflow writes a produced artifact
- **WHEN** the runtime writes a DOCX or XLSX artifact
- **THEN** it SHALL persist through the storage adapter and store only the resulting object key on the artifact record
