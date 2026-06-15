## ADDED Requirements

### Requirement: Candidate pool falls back to most recent fixture when today's fixture is missing

The system SHALL fall back to the most recent fixture within a configured staleness window (default 7 days) when the requested `issueDate` fixture is absent, AND surface the actual source date through a `staleSourceDate` field on the response so callers can distinguish stale fixtures from fresh ones. Fall-back SHALL be enabled by default and SHALL be globally disable-able via configuration.

#### Scenario: Today's fixture is missing but a recent fixture exists within the window

- **WHEN** the daily-report workbench requests today's candidate pool
- **AND** today's fixture file does not exist
- **AND** at least one fixture exists within the configured staleness window (default 7 days back, inclusive)
- **THEN** the system SHALL serve the most recent fixture's candidates as today's candidate pool
- **AND** the response SHALL set `staleSourceDate` to the actual fixture's `issueDate` (YYYY-MM-DD)
- **AND** the response SHALL keep the requested `issueDate` unchanged so downstream task creation, drafting, and export still operate against today's date
- **AND** the response SHALL still set `sourceType=fixture` on each candidate

#### Scenario: Today's fixture exists

- **WHEN** the daily-report workbench requests today's candidate pool
- **AND** today's fixture file exists
- **THEN** the system SHALL serve today's fixture and SHALL NOT include `staleSourceDate` in the response

#### Scenario: No fixture exists within the staleness window

- **WHEN** the daily-report workbench requests today's candidate pool
- **AND** no fixture for today or any prior date within the staleness window can be located
- **THEN** the system SHALL reject the request with the existing `candidate_pool_fixture_missing` error, unchanged in shape

#### Scenario: Fall-back is explicitly disabled

- **WHEN** the operator sets the fall-back to disabled via configuration
- **AND** today's fixture is missing
- **THEN** the system SHALL reject the request with `candidate_pool_fixture_missing` even if older fixtures exist
- **AND** the system SHALL NOT scan prior dates

### Requirement: Stale-fixture origin is auditable to operators

The system SHALL preserve the original fixture's `issueDate` on every fall-back response so operators can reproduce which fixture fed a given report.

#### Scenario: Operator inspects a daily-report task built on a stale fixture

- **WHEN** an operator inspects the candidate pool a task was built on
- **THEN** the system SHALL surface `staleSourceDate` alongside the workflow slug and requested `issueDate`, so the original fixture file is unambiguously identifiable
