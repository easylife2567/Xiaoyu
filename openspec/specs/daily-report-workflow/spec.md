# daily-report-workflow Specification

## Purpose

Provide a shared workflow model for report workbenches that turn daily news candidates into finished reports.

## Requirements

### Requirement: Daily report workflows use a shared production model

The system SHALL support daily report workflows through a shared production model covering candidate discovery, selection, drafting, editing, and export.

#### Scenario: Different report types use the same flow

- WHEN the system runs multiple daily report workflows
- THEN each workflow can use the shared sequence of candidate pool, selection, drafting, editing, and export

### Requirement: Daily report workflows are configured rather than hard-coded

The system SHALL allow different daily report workbenches to vary by search strategy, candidate pool rules, drafting rules, and export rules through configuration.

#### Scenario: Two report workbenches target different topics

- WHEN two report workbenches use different configurations
- THEN they share the same workflow model while producing different candidate pools and outputs

### Requirement: Users select report topics from a prepared pool

The system SHALL allow users to choose report topics from a pre-generated candidate pool rather than requiring them to upload a manually prepared topic file.

#### Scenario: User starts a daily report task

- WHEN a user enters a daily report workbench for the current day
- THEN the user can choose from that day's prepared candidate pool

### Requirement: Candidate selection precedes drafting

The system SHALL draft report content only after the user selects the required number of candidate stories.

#### Scenario: User has not selected enough stories

- WHEN the user has selected fewer than the required number of stories
- THEN the system does not proceed to final drafting
