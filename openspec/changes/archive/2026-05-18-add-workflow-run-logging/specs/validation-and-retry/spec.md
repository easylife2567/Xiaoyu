## MODIFIED Requirements

### Requirement: Validation failures are explainable
The system SHALL show which validation or execution failure occurred and why.

#### Scenario: A PDF exceeds the allowed page count
- WHEN validation detects the report is too long
- THEN the system identifies the failing validation to the user

#### Scenario: Large translation workbook is invalid
- WHEN input or output validation fails for 大翻译数据处理
- THEN the system SHALL identify the failing workbook rule in human-readable language

#### Scenario: AI execution fails during processing
- WHEN AI-assisted execution fails during a workflow run
- THEN the system SHALL expose a specific failure category that helps determine whether retry is appropriate
