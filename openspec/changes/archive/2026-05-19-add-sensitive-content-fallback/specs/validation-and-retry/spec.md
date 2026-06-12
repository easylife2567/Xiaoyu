## MODIFIED Requirements

### Requirement: Validation failures are explainable
The system SHALL show which validation or execution failure occurred and why.

#### Scenario: A row is downgraded for sensitivity
- WHEN 大翻译数据处理 applies a sensitive-content fallback
- THEN the system SHALL explain that the row was downgraded for manual review rather than reporting it as a transient provider failure

### Requirement: Users can retry after recoverable failures
The system SHALL allow users to rerun tasks after recoverable failures.

#### Scenario: A row was downgraded due to sensitivity
- WHEN a row was downgraded because it matched a sensitive-content rule
- THEN the system SHALL NOT treat that downgrade as a retriable upstream AI failure
