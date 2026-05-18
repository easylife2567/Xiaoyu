## 1. Product shell and navigation

- [x] 1.1 Build the application home page with three v1 workbench entries visible on the first screen.
- [x] 1.2 Add routing into dedicated workbench pages for 大翻译数据处理、国际日报、国际热点日报二处。
- [x] 1.3 Define shared visual primitives for workbench title, subtitle, explanatory copy, status presentation, and empty states.

## 2. File-processing workbench shell

- [x] 2.1 Build the 大翻译数据处理 workbench shell with a single clear Excel upload entry.
- [x] 2.2 Add file-processing layout regions for input recognition, task status, and result delivery.
- [x] 2.3 Ensure the file-processing shell does not expose low-level configuration such as sheet names, column mappings, or model settings.

## 3. Daily-report workbench shell

- [x] 3.1 Build reusable daily-report shell regions for candidate pool, selected-story basket, draft area, and export area.
- [x] 3.2 Apply the daily-report shell to 国际日报 and 国际热点日报二处 with distinct titles and descriptive copy.
- [x] 3.3 Ensure report workbenches do not present manual topic-file upload as their primary v1 interaction.

## 4. Task-state behavior

- [x] 4.1 Add visible placeholder states for not started, waiting for future data, in progress, completed, and failed where relevant to each shell type.
- [x] 4.2 Add task-start affordances only where they match the current shell model and clearly label unimplemented downstream capabilities as forthcoming.

## 5. Verification

- [x] 5.1 Verify that a first-time user can identify the correct workbench from the home page within the intended first-screen experience.
- [x] 5.2 Verify that 大翻译数据处理 reads as a file-processing flow while the two report workbenches read as candidate-selection flows.
- [x] 5.3 Verify that no hidden implementation settings or obsolete manual-topic-file assumptions leak into the v1 UI.
