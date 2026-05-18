## MODIFIED Requirements

### Requirement: Generated artifacts are archived
The system SHALL archive all files produced by a task.

#### Scenario: A task generates multiple outputs
- WHEN a task produces DOCX, PDF, XLSX, image, or other files
- THEN all generated files SHALL be associated with that task

#### Scenario: Large translation processing succeeds
- WHEN 大翻译数据处理 completes successfully
- THEN the generated result workbook SHALL be archived as a task artifact

### Requirement: Artifacts are traceable
The system SHALL associate each artifact with its originating task, workflow template, and generation time.

#### Scenario: User inspects an artifact
- WHEN a user opens an artifact record
- THEN the system shows where it came from and when it was generated

### Requirement: Artifacts support retrieval and download
The system SHALL allow users to find and download generated artifacts.

#### Scenario: User searches by task or date
- WHEN a user searches artifacts by task, template, or date
- THEN matching artifacts SHALL be retrievable and downloadable

#### Scenario: User downloads the completed workbook
- WHEN 大翻译数据处理 completes successfully
- THEN the user SHALL be able to download the processed workbook from the workbench

### Requirement: Artifact versions are preserved
The system SHALL preserve distinct versions when a task is rerun or regenerated.

#### Scenario: User reruns a task
- WHEN a task produces a new output version
- THEN prior output versions SHALL remain available
