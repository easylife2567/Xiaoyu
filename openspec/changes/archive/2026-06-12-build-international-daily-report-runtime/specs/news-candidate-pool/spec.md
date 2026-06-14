## ADDED Requirements

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
