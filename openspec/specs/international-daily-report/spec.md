# international-daily-report Specification

## Purpose

Produce the 国际日报 using the shared daily-report workflow with global-news collection and fixed delivery rules.

## Requirements

### Requirement: The international daily report uses the shared daily report workflow

The system SHALL provide an 国际日报 workbench configured on top of the shared daily report workflow.

#### Scenario: User opens the 国际日报 workbench

- WHEN the user opens the workbench for the current day
- THEN the system shows that day's prepared global-news candidate pool

### Requirement: The workbench surfaces global current-affairs candidates

The system SHALL prepare a daily candidate pool focused on current global news and international public-opinion topics.

#### Scenario: Daily collection runs for 国际日报

- WHEN the scheduled collection executes
- THEN the resulting pool contains recent international news candidates suitable for user selection

### Requirement: Users choose six stories for the report

The system SHALL require the user to choose six stories before drafting the 国际日报.

#### Scenario: User selects six candidates

- WHEN six stories are selected
- THEN the system allows the user to generate the report draft

### Requirement: Drafts follow the established 国际日报 writing rules

The system SHALL generate 国际日报 prose using the established numbered structure, concise digest style, and source naming conventions.

#### Scenario: Draft generation occurs

- WHEN the system drafts the report
- THEN it produces six concise Chinese sections following the configured 国际日报 format

### Requirement: Users may lightly edit the generated body before export

The system SHALL allow light editing of the generated report body before final export.

#### Scenario: User wants to refine a paragraph

- WHEN the user edits one paragraph
- THEN the system retains the report structure while updating that paragraph

### Requirement: Export produces the required 国际日报 artifact set

The system SHALL export the configured 国际日报 deliverables, including report documents and the updated resource-pool workbook.

#### Scenario: User finalizes the report

- WHEN export succeeds
- THEN the system produces the configured DOCX, PDF, and updated resource-pool XLSX outputs

### Requirement: 国际日报 export preserves fixed delivery rules

The system SHALL preserve required delivery rules such as issue numbering, fixed naming, encryption, and one-page validation.

#### Scenario: Report export is validated

- WHEN the system exports the report
- THEN it enforces the configured issue-numbering, naming, encryption, and one-page rules before completion
