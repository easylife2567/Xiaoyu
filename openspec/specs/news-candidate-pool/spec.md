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
