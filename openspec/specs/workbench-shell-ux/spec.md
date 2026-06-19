# workbench-shell-ux Specification

## Purpose
TBD - created by archiving change 2026-06-18-fix-workbench-scroll-architecture. Update Purpose after archive.
## Requirements
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

### Requirement: Workbench section flex distribution preserves natural content density

The system SHALL distribute available vertical space among workbench sections such that **fixed-content sections** (e.g., 已选篮子 / 文件输入 / 运行设置 / 产物交付) display at their natural content height without compression, and **elastic-content sections** (e.g., 草稿 / 候选池 / 任务列表) absorb remaining space and scroll independently within their allocated slot. The system SHALL NOT compress all sections proportionally when the workbench is taller than the viewport — instead, the user SHALL see fixed sections at full natural height and scroll only within elastic sections.

#### Scenario: User views the daily-report workbench with 6 selected items

- **WHEN** the user has populated `已选篮子` to 6 items and the draft area is filled with 6 sections of long-form content
- **THEN** all 6 selected items SHALL be visible in `已选篮子` without that section requiring its own scroll
- **AND** the draft area SHALL display its first sections immediately, with subsequent sections accessible by scrolling within the draft area only
- **AND** `产物交付` SHALL remain visible at its natural height regardless of the draft length

#### Scenario: User views the translation workbench with the file-input region

- **WHEN** the user opens the translation workbench
- **THEN** the `文件输入` upload region SHALL display at its natural content height
- **AND** the `运行设置` action area SHALL display at its natural content height
- **AND** neither section SHALL be stretched to occupy the full grid track height nor compressed below its natural content height

#### Scenario: Browser viewport is unusually short (e.g., 800px tall) and total content exceeds available space

- **WHEN** the total height required by all fixed-content sections exceeds the available main-column height
- **THEN** the main column SHALL provide its own vertical scroll as a fallback
- **AND** individual fixed-content sections SHALL still preserve their natural content height when scrolled into view (no proportional compression)

#### Scenario: User scrolls within the elastic section while looking at fixed-content sections

- **WHEN** the user scrolls within `草稿` (elastic) or `任务列表` (elastic)
- **THEN** the scroll position of fixed-content sections (`已选篮子`, `产物交付`, `文件输入`, `运行设置`) SHALL NOT change
- **AND** the workbench shell navigation (topbar, sidebar, progress bar) SHALL remain visible per the existing `Workbench shell preserves persistent navigation` requirement

