## MODIFIED Requirements

### Requirement: Users can run tasks from workflow templates
The system SHALL allow users to enter supported workbenches through user-facing pages that match each workflow's operating model.

#### Scenario: User starts from the home page
- WHEN a user opens the application home page
- THEN the system SHALL present the supported v1 workbench entries on the first screen

#### Scenario: User opens a file-processing workbench
- WHEN a user selects the 大翻译数据处理 workbench
- THEN the system SHALL show a file-processing layout with input, status, and result regions

#### Scenario: User opens a daily-report workbench
- WHEN a user selects 国际日报 or 国际热点日报二处
- THEN the system SHALL show a daily-report layout with candidate-pool, selected-story, draft, and export regions

### Requirement: Tasks expose a clear lifecycle
The system SHALL expose task-state regions in the workbench interface according to the current shell stage and available capabilities.

#### Scenario: User views a workbench before real processing is connected
- WHEN a downstream capability is not yet implemented in the current product stage
- THEN the workbench SHALL show a clear empty or forthcoming state rather than pretending the task completed

#### Scenario: User reviews task progress
- WHEN a workbench shell is shown before downstream execution is connected
- THEN the workbench SHALL reserve visible states for not started, waiting, in progress, completed, and failed
