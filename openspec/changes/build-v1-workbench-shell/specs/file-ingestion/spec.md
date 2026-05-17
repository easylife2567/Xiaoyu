## MODIFIED Requirements

### Requirement: Users can upload workflow inputs
The system SHALL accept user-uploaded input files for workflows whose operating model requires file ingestion.

#### Scenario: User opens the 大翻译数据处理 workbench
- WHEN a user enters the 大翻译数据处理 workbench
- THEN the system SHALL show the required Excel upload entry before processing can begin

#### Scenario: User uploads required files
- WHEN a user uploads the file required by a file-processing workflow
- THEN the system SHALL attach it to the pending task and make it available for later processing

### Requirement: File ingestion gives human-readable feedback
The system SHALL present input guidance and validation results in language understandable to non-technical users.

#### Scenario: User has not provided required input
- WHEN the required Excel input has not yet been provided
- THEN the workbench SHALL indicate what file is needed before processing can begin

#### Scenario: User opens a report workbench
- WHEN a user enters 国际日报 or 国际热点日报二处
- THEN the system SHALL not require manual topic-file upload as the primary interaction for that workbench
