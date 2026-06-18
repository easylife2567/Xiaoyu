# news-candidate-pool Specification

## Purpose

Prepare daily pools of recent, source-grounded, deduplicated news candidates for report workbenches.
## Requirements
### Requirement: The system generates daily candidate pools in advance

The system SHALL generate candidate news pools on a scheduled daily basis before users begin report production.

#### Scenario: Daily preparation window occurs

- WHEN the scheduled daily collection time arrives
- THEN the system collects, cleans, and prepares candidate pools for configured report workbenches

### Requirement: Candidate pools are grounded in real sources

The system SHALL build candidate pools from externally retrievable source records rather than model-only invention.

#### Scenario: A candidate enters the pool

- WHEN a news candidate is added to the pool
- THEN it retains source name, source URL, publication time, and retrieval metadata

### Requirement: Candidate pools contain recent news

The system SHALL prefer current news according to each workflow's configured time window.

#### Scenario: Old content is encountered during collection

- WHEN a retrieved article falls outside the configured recency window
- THEN it is not treated as a current candidate unless explicitly allowed by that workflow

### Requirement: Candidate pools reduce duplication

The system SHALL deduplicate and cluster substantially similar stories so users choose among events rather than repeated copies.

#### Scenario: Multiple sources report the same event

- WHEN several retrieved articles describe the same event
- THEN the system groups them into one candidate story with linked supporting sources

### Requirement: Candidate pools remain open for human choice

The system SHALL present a pool of candidate stories for users to select freely rather than preselecting the final report items.

#### Scenario: User opens a daily report workbench

- WHEN a prepared pool exists for that day
- THEN the user can browse and choose from multiple candidate stories

### Requirement: Candidate pools may be sourced from in-repository seed fixtures during development

The system SHALL allow a candidate pool for a given workflow and issueDate to be sourced from an in-repository seed fixture, on the condition that each fixture-sourced candidate carries source name, source URL, publication time, retrieval metadata, AND an explicit `sourceType` field marking it as `fixture`.

#### Scenario: Workbench reads today's candidate pool from a fixture
- **WHEN** the daily-report workbench requests today's candidate pool for 国际日报
- **THEN** the system SHALL serve candidates from the configured fixture provider, with `sourceType=fixture` set on each candidate, while preserving source name, URL, publication time, and retrieval metadata

#### Scenario: Operator audits the origin of report material
- **WHEN** an operator inspects which candidates fed a given report
- **THEN** the system SHALL surface the `sourceType` so fixture-sourced candidates are clearly distinguishable from production-collected candidates

### Requirement: Candidate pool access goes through a provider interface

The system SHALL expose candidate pool reads through a provider interface, so the seed-fixture provider can be replaced with a scheduled-collection provider in the future without changing the daily-report workbench, drafting, or export code.

#### Scenario: A new pool source is introduced
- **WHEN** a real collection pipeline becomes available for a workflow
- **THEN** the system SHALL be able to swap in a new candidate pool provider implementation without modifying the drafting or export call sites

### Requirement: Candidate pool reads carry an explicit issueDate parameter

The system SHALL accept `issueDate` as an explicit parameter on every candidate pool read and on every daily-report task creation, even when only one issueDate is currently supported, so future support for backfilling additional dates is a provider-side relaxation rather than an API-shape change.

#### Scenario: Today's pool is requested
- **WHEN** the workbench requests the candidate pool for today's issueDate
- **THEN** the system SHALL serve that day's pool through the provider

#### Scenario: A non-today issueDate is requested in the current runtime
- **WHEN** the workbench or API caller requests a candidate pool for any issueDate other than today
- **THEN** the system SHALL reject the request with a structured `unsupported_issue_date` error, without changing the API shape

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

