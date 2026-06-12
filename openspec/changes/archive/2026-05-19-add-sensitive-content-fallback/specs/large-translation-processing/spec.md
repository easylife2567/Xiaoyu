## MODIFIED Requirements

### Requirement: The workflow generates concise Chinese summaries
The system SHALL generate one-sentence Chinese summaries for each valid source row, including via safe fallback when normal AI generation is not appropriate.

#### Scenario: A source row matches a sensitive-content rule
- WHEN the workflow identifies a valid source row as sensitive
- THEN it SHALL write a predefined neutral fallback summary instead of failing the whole task

### Requirement: Results are written back to the configured workbook fields
The system SHALL write generated summaries and classifications back into the target workbook fields defined by the workflow template.

#### Scenario: Sensitive rows are present in the workbook
- WHEN the workflow completes with sensitive rows downgraded
- THEN the output workbook SHALL still be generated with fallback summaries written into the configured summary field
