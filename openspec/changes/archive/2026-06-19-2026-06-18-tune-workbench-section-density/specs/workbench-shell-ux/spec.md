## ADDED Requirements

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
