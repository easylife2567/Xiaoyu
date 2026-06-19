## ADDED Requirements

### Requirement: Workbench shell preserves persistent navigation across all content scales

The system SHALL preserve the workbench shell's primary navigation (top brand / global controls / sidebar / utility rail) as persistently visible regardless of the content size loaded inside any workbench. The shell SHALL behave as a fixed-frame container — only the inner content regions are allowed to scroll. Users SHALL never lose access to navigation, the user identity chip, the workflow progress indicator, or the workbench switcher because of long content lists.

#### Scenario: Candidate pool grows large enough to exceed viewport height

- **WHEN** the international daily report workbench is opened with a candidate pool exceeding the viewport vertical height
- **THEN** the topbar containing the brand, global tools, and operator chip SHALL remain visible at the top of the viewport at all times
- **AND** the sidebar containing primary workbench navigation SHALL remain visible at the left of the viewport at all times
- **AND** the workflow progress indicator (`生产链路`) SHALL remain visible at the top of the workbench area at all times

#### Scenario: User scrolls within any single workbench section

- **WHEN** the user scrolls within any one workbench section (candidate pool, selected basket, draft area, delivery area)
- **THEN** scrolling SHALL be contained within that section only
- **AND** other sections, the topbar, the sidebar, and the workflow progress indicator SHALL NOT scroll

#### Scenario: Browser viewport height changes

- **WHEN** the browser window is resized vertically (e.g., from 1200px tall to 800px tall) or zoomed
- **THEN** the shell layout SHALL adapt to the new viewport height without producing a horizontal scrollbar at the document level
- **AND** the topbar height SHALL remain constant (driven by `--shell-topbar-height` CSS variable)
- **AND** all internal scroll containers SHALL recalculate their available height accordingly

### Requirement: Workbench content regions scroll within isolated containers

The system SHALL contain workbench content scrolling within isolated regions — different sections within the same workbench (e.g., candidate pool, selected basket, draft area, delivery area on the daily-report workbench; metric column and task list on the translation workbench) SHALL each scroll independently. The vertical extent of one section's content SHALL NOT cause other sections' content to scroll, nor cause the shell-level navigation to scroll.

#### Scenario: One section's content is much longer than another's

- **WHEN** one workbench section (e.g., candidate pool with 250 entries) is significantly longer than another (e.g., draft area with 6 sections)
- **THEN** each section SHALL maintain its own scroll position
- **AND** scrolling in the longer section SHALL NOT affect the shorter section's visible content
- **AND** the shorter section SHALL show all of its content within its allocated height

#### Scenario: Section header context preservation during scroll

- **WHEN** the user scrolls within a section that has a header (e.g., `候选池` or `已选篮子` containing a counter such as `已选 3/6`)
- **THEN** the section's header SHALL remain visible at the top of that section, providing the user with persistent context (counts, action buttons, filter chips) regardless of the scroll position within that section's content body
