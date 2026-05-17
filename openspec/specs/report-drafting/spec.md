# report-drafting Specification

## Purpose

Convert selected stories into editable draft sections using workbench-specific writing rules.

## Requirements

### Requirement: Selected stories can be converted into report drafts

The system SHALL generate draft report content from user-selected candidate stories.

#### Scenario: User selects the required stories

- WHEN the user selects the required number of candidate stories
- THEN the system generates a draft section for each selected story

### Requirement: Drafting follows workbench-specific writing rules

The system SHALL generate content according to the writing rules configured for the active report workbench.

#### Scenario: Different workbenches use different prose styles

- WHEN two report workbenches draft from selected stories
- THEN their output follows their own configured structure, tone, and source-display conventions

### Requirement: Users can lightly edit each drafted item

The system SHALL allow users to make light edits to each drafted report item without returning to a general-purpose document editor.

#### Scenario: User wants to refine one story

- WHEN a user edits one drafted item
- THEN the user can adjust the text for that item without altering unrelated items

### Requirement: Drafting preserves source visibility

The system SHALL allow users to view the source context behind each drafted item while editing.

#### Scenario: User reviews a generated paragraph

- WHEN a user inspects a drafted item
- THEN the system makes its supporting source information available

### Requirement: Editing supports workflow-relevant actions

The system SHALL support workflow-relevant editing actions such as rewriting, shortening, expanding, reordering, or replacing media when configured.

#### Scenario: User wants a shorter item

- WHEN a user requests a concise rewrite of one drafted item
- THEN the system generates a shorter alternative for that item
