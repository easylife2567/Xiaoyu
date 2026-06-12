## MODIFIED Requirements

### Requirement: Foreign-language content is converted into Chinese summaries
The system SHALL understand foreign-language source content and produce Chinese one-sentence summaries, including through batch execution.

#### Scenario: Multiple source rows are processed together
- WHEN the workflow processes a batch of valid source rows
- THEN it SHALL return one Chinese summary per source row and preserve row-to-summary alignment

### Requirement: The workflow generates concise Chinese summaries
The system SHALL generate one-sentence Chinese summaries for each valid source row.

#### Scenario: A batch response contains valid summaries
- WHEN the workflow receives a valid batch summary response
- THEN it SHALL write the returned summaries back into the correct workbook rows

#### Scenario: A batch response is unusable
- WHEN the workflow cannot recover valid summaries from a batch response
- THEN it SHALL downgrade that batch to a finer-grained execution path or fail with an explainable issue
