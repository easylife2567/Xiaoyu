## MODIFIED Requirements

### Requirement: Artifacts are traceable
The system SHALL associate each artifact with its originating task, workflow template, generation time, and persisted runtime metadata needed to resolve the artifact through the active storage boundary.

#### Scenario: User inspects an artifact
- **WHEN** a user opens an artifact record
- **THEN** the system shows where it came from and when it was generated

#### Scenario: Runtime storage implementation changes
- **WHEN** the application uses a different artifact storage implementation behind the same runtime boundary
- **THEN** persisted artifact metadata SHALL remain sufficient to resolve and retrieve the artifact without changing the workbench-facing task contract

### Requirement: Artifacts support retrieval and download
The system SHALL allow users to find and download generated artifacts through persisted artifact records rather than relying on implicit local output paths.

#### Scenario: User searches by task or date
- **WHEN** a user searches artifacts by task, template, or date
- **THEN** matching artifacts SHALL be retrievable and downloadable

#### Scenario: User downloads the completed workbook
- **WHEN** 大翻译数据处理 completes successfully
- **THEN** the user SHALL be able to download the processed workbook from the workbench

#### Scenario: The application restarts before artifact download
- **WHEN** a translation artifact was generated before the application restarts
- **THEN** the workbench SHALL still be able to locate and download that artifact using its persisted artifact record
