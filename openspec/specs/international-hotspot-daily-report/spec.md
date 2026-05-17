# international-hotspot-daily-report Specification

## Purpose

Produce the 国际热点日报二处 using the shared daily-report workflow with AI-and-city-governance collection and fixed report styling.

## Requirements

### Requirement: The international hotspot daily report uses the shared daily report workflow

The system SHALL provide an 国际热点日报二处 workbench configured on top of the shared daily report workflow.

#### Scenario: User opens the 国际热点日报二处 workbench

- WHEN the user opens the workbench for the current day
- THEN the system shows that day's prepared AI-and-city-governance candidate pool

### Requirement: The workbench surfaces AI and urban-governance candidates

The system SHALL prepare a daily candidate pool focused on AI, urban governance, transport, flooding, air quality, city operations, and related city-management topics.

#### Scenario: Daily collection runs for 国际热点日报二处

- WHEN scheduled collection executes
- THEN the resulting pool contains recent candidates relevant to the configured city-governance focus

### Requirement: Users choose the required report stories from the prepared pool

The system SHALL allow users to freely choose the configured number of report stories from the candidate pool before drafting.

#### Scenario: User prepares a new issue

- WHEN the user selects the required number of candidate stories
- THEN the system allows drafting to proceed

### Requirement: Drafts follow the established 二处 report style

The system SHALL generate report prose according to the fixed structure, density, Chinese media-name display, and tone established for the 二处 report format.

#### Scenario: Draft generation occurs

- WHEN the system drafts the report
- THEN the draft follows the configured 二处 style rules

### Requirement: The workbench supports topic-relevant imagery

The system SHALL support generation or attachment of realistic images appropriate to each selected report item.

#### Scenario: Drafting includes images

- WHEN the report is generated
- THEN each selected topic is associated with a relevant image according to the configured report format

### Requirement: Users may lightly edit text and imagery before export

The system SHALL allow users to make light text edits and replace configured images before final export.

#### Scenario: User refines a drafted report

- WHEN the user adjusts text or replaces an image
- THEN the system preserves the report structure while reflecting those updates

### Requirement: Export uses the fixed 二处 report template

The system SHALL export the report using the configured fixed 二处 template without requiring users to upload a reference sample.

#### Scenario: User finalizes the report

- WHEN export succeeds
- THEN the system produces the configured final report artifacts using the stored template
