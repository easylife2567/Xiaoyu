## MODIFIED Requirements

### Requirement: Selected stories can be converted into report drafts

The system SHALL generate draft report content from user-selected candidate stories. Drafting follows the workbench-specific writing rules and is triggered as an asynchronous process once the required number of candidates have been selected. When drafting completes, a new DraftVersion record is created with `source=ai_generated` and the full set of sections is available for review and editing.

#### Scenario: User selects the required stories
- **WHEN** the user selects the required number of candidate stories and triggers drafting
- **THEN** the system SHALL enqueue an async draft attempt and transition the task to `drafting_in_progress`

#### Scenario: Drafting is complete
- **WHEN** the draft attempt completes
- **THEN** the system SHALL make the full DraftVersion available, with each section accessible for individual editing

### Requirement: Drafting follows workbench-specific writing rules

The system SHALL generate content according to the writing rules configured for the active report workbench. For the 国际日报 workbench, the system SHALL generate six numbered Chinese sections in concise digest style, using source naming conventions consistent with the established 国际日报 format, in a single AI invocation.

#### Scenario: Draft for 国际日报
- **WHEN** the system drafts the 国际日报
- **THEN** the draft SHALL consist of exactly six numbered Chinese sections, each carrying a headline and digest body, with source attribution consistent with the 国际日报 format

### Requirement: Users can lightly edit each drafted item

The system SHALL allow users to make light edits to each drafted report item. Edits are persisted as a new DraftVersion record with `source=user_edited`, preserving the original AI-generated version for comparison. Only the latest DraftVersion is used as the source for export.

#### Scenario: User edits one section and saves
- **WHEN** a user edits the text of one section and saves
- **THEN** the system SHALL create a new DraftVersion with `source=user_edited`, an incremented version number, the updated section text, and the remaining sections unchanged

#### Scenario: User views the saved draft after editing
- **WHEN** a user returns to the workbench after a previous editing session
- **THEN** the system SHALL load the latest DraftVersion for editing, reflecting all prior edits

### Requirement: Editing supports workflow-relevant actions

The system SHALL support the following editing actions on drafted report sections: rewriting one section in-place, reordering sections before export, and discarding edits to return to the latest AI-generated version.

#### Scenario: User reorders sections before export
- **WHEN** a user changes the order of two sections before exporting
- **THEN** the system SHALL persist the new order in a new DraftVersion record with `source=user_edited`

#### Scenario: User wants a shorter item
- **WHEN** a user requests a concise rewrite of one drafted item
- **THEN** the system SHALL generate a shorter alternative for that item

## ADDED Requirements

### Requirement: Drafting is an asynchronous attempt with a status lifecycle

The system SHALL treat each draft generation or regeneration as a task attempt with discrete states (`queued`, `processing`, `completed`, `failed`), so the workbench can provide progress feedback during the AI call.

#### Scenario: User triggers a regeneration
- **WHEN** the user re-generates the draft after an initial AI draft exists
- **THEN** the system SHALL create a new attempt, transition the task to `drafting_in_progress`, and once completed record the result as a new DraftVersion

### Requirement: Drafting supports on-demand section regeneration

The system SHALL support regenerating a single section without re-drafting the entire report, provided the runtime AI provider supports single-section drafting.

#### Scenario: User regenerates one section
- **WHEN** a user requests a rewrite of one section only
- **THEN** the system SHALL generate an alternative for that section, then create a new DraftVersion with `source=user_edited` containing the new section text alongside the unchanged remaining sections (Note: this is a future-pattern requirement; the current implementation inherits it from the spec but MAY stub it as a full-draft regeneration initially.)

### Requirement: Drafting preserves source visibility during editing

The system SHALL allow users to view the supporting source information underlying each drafted section while editing, by making the candidate snapshot (source name, URL, publication time) associated with that section available in the editing UI.

#### Scenario: User inspects a generated paragraph
- **WHEN** a user inspects the source information for one section while editing
- **THEN** the system SHALL display the candidate snapshot referenced by the associated DailyReportSelection for that section