# local-sync Specification

## Purpose

Synchronize completed artifacts from the cloud workspace to a configured local desktop location.

## Requirements

### Requirement: Users can configure a local sync target

The system SHALL allow users to define a local directory where completed artifacts can be synchronized.

#### Scenario: User configures local output folder

- WHEN a user selects a local sync directory
- THEN the system remembers that directory for future artifact synchronization

### Requirement: Completed artifacts can be synchronized locally

The system SHALL synchronize completed task artifacts to the user's configured local directory.

#### Scenario: Task completes successfully

- WHEN a task finishes and produces artifacts
- THEN the system makes those artifacts available for local synchronization

### Requirement: Sync state is visible and recoverable

The system SHALL show whether local sync succeeded or failed and allow retry after failure.

#### Scenario: Local sync fails

- WHEN synchronization cannot complete
- THEN the task remains archived in the cloud and the user can retry local sync
