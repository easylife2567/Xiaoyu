## MODIFIED Requirements

### Requirement: Reports are exported through fixed templates

The system SHALL render final report artifacts through the template configured for the active report workbench. For 国际日报, the system SHALL render the DOCX report using a fixed in-repository template (no user upload of a reference document required).

#### Scenario: User finalizes a 国际日报 report
- **WHEN** the user triggers export from the 国际日报 workbench
- **THEN** the system SHALL render the report using the bundled 国际日报 DOCX template, rather than requiring manual formatting or user-supplied template files

### Requirement: Exported artifacts follow workbench-specific output rules

The system SHALL generate the configured artifact set for each report workbench. For 国际日报, the system SHALL produce two artifacts per successful export: a DOCX report and an updated resource-pool XLSX containing the day's selected entries appended to the prior pool.

#### Scenario: 国际日报 export completes
- **WHEN** an export attempt succeeds for 国际日报
- **THEN** the system SHALL persist exactly one DOCX report artifact (kind=`docx_report`) and one resource-pool XLSX artifact (kind=`resource_pool_xlsx`), both linked to the same task and draft version

### Requirement: Export obeys required validations

The system SHALL validate exported reports against workbench-specific rules before persisting any artifact records. For 国际日报, the system SHALL enforce: (a) file naming matches the configured naming rule, (b) issueNumber is a positive integer matching the task's recorded issue number, and (c) the report body fits within a one-page constraint. Validation failure SHALL prevent artifact records from being created and SHALL mark the export attempt as `failed` with a structured validation report.

#### Scenario: Export violates the one-page constraint
- **WHEN** the rendered report exceeds the configured one-page text budget
- **THEN** the system SHALL refuse to write any artifact record and SHALL mark the export attempt as `failed` with the violating measurement attached

#### Scenario: Export violates the naming or issueNumber rule
- **WHEN** the proposed file name or issueNumber does not match the configured rule
- **THEN** the system SHALL refuse to write any artifact record and SHALL surface the violation to the workbench

### Requirement: Export hides low-level formatting work from users

The system SHALL handle layout, naming, file generation, and resource-pool XLSX append details internally, so users only see "trigger export" and "download produced artifacts" in the workbench.

#### Scenario: User exports a finished 国际日报
- **WHEN** export completes successfully
- **THEN** the user SHALL be able to download the DOCX report and updated resource-pool XLSX without performing any manual formatting or file manipulation

## ADDED Requirements

### Requirement: Export is an asynchronous attempt with structured outcomes

The system SHALL treat each export as a task attempt with discrete states (`queued`, `processing`, `completed`, `failed`), and SHALL retain a structured `validationReport` on the attempt regardless of success or failure, capturing all validation rules and their pass/fail status.

#### Scenario: A user triggers export
- **WHEN** the user triggers an export
- **THEN** the system SHALL enqueue an export attempt and transition the task to `exporting_in_progress`

#### Scenario: An export attempt completes successfully
- **WHEN** the export attempt completes and all validations pass
- **THEN** the system SHALL transition the task to `completed` and retain the validationReport with all checks marked as passed
