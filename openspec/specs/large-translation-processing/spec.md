# large-translation-processing Specification

## Purpose

Process 大翻译数据处理 workbooks by converting source content into Chinese summaries and labels.

## Requirements

### Requirement: The workflow processes supported translation workbooks

The system SHALL process supported 大翻译数据处理 workbooks by reading source text and writing derived results back into the workbook.

#### Scenario: User uploads a supported workbook

- WHEN a user uploads a supported workbook for 大翻译数据处理
- THEN the system identifies the relevant sheet structure and prepares the workbook for processing

### Requirement: Foreign-language content is converted into Chinese summaries

The system SHALL understand foreign-language source content and produce Chinese one-sentence summaries.

#### Scenario: Source text is written in English

- WHEN the source content is foreign-language text
- THEN the generated summary is written in Chinese

### Requirement: The workflow generates concise Chinese summaries

The system SHALL generate one-sentence Chinese summaries for each valid source row.

#### Scenario: A source row contains a valid event description

- WHEN the workflow processes that row
- THEN it writes a concise Chinese summary into the configured summary field

### Requirement: Classification follows the established priority rules

The system SHALL assign labels according to the stable 大翻译数据处理 classification priority rules.

#### Scenario: A row mentions Taiwan-related issues

- WHEN a source row contains Taiwan-related content
- THEN the workflow classifies it as `台湾问题`

#### Scenario: A row mentions wage arrears

- WHEN a source row contains wage arrears or wage collection content
- THEN the workflow classifies it as `欠薪讨薪相关`

#### Scenario: No special rule applies

- WHEN no higher-priority rule applies
- THEN the workflow assigns an appropriate fallback label according to the established taxonomy

### Requirement: Results are written back to the configured workbook fields

The system SHALL write generated summaries and classifications back into the target workbook fields defined by the workflow template.

#### Scenario: Processing completes successfully

- WHEN all supported rows are processed
- THEN the output workbook contains generated summaries and classifications in the configured output columns
