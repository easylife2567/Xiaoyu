## ADDED Requirements

### Requirement: Sensitive translation rows can bypass normal AI generation
The system SHALL identify high-risk content locally and bypass the normal AI summarization path for those rows.

#### Scenario: A row matches a sensitive-content rule
- WHEN a translation row matches a configured sensitive-content pattern
- THEN the workflow SHALL avoid sending that row through the normal AI summary path

### Requirement: Sensitive rows receive a safe fallback summary
The system SHALL write a neutral fallback summary for sensitive rows so the workbook remains deliverable.

#### Scenario: A sensitive row is processed
- WHEN the workflow identifies a row as sensitive
- THEN it SHALL write a predefined neutral summary instead of leaving the result blank

### Requirement: Sensitive rows are marked for human review
The system SHALL surface that sensitive fallback rows require human review.

#### Scenario: A row is downgraded due to sensitivity
- WHEN the workflow applies a sensitive-content fallback
- THEN the system SHALL retain an explainable marker that the row requires human review
