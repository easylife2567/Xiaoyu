## 1. Logging contract and tests

- [x] 1.1 Add failing tests for task runtime events, AI diagnostic fields, and actionable failure categories.
- [x] 1.2 Define shared contracts for task events and AI call diagnostics without persisting secrets.

## 2. Worker and persistence instrumentation

- [x] 2.1 Record ordered task and attempt lifecycle events during 大翻译数据处理 execution.
- [x] 2.2 Extend AI provider traces with timestamps, duration, HTTP/provider diagnostics, request IDs, and specific failure categories.
- [x] 2.3 Persist structured events and diagnostics on the task attempt so failed runs remain inspectable after completion.

## 3. Workbench visibility

- [x] 3.1 Add a lightweight runtime-log section to the 大翻译工作台 showing recent execution history and the stopping point.
- [x] 3.2 Present user-facing failure summaries that distinguish timeout, rate limit, configuration, and provider errors.

## 4. Verification

- [x] 4.1 Add regression coverage for the recent real-world failed task shape.
- [x] 4.2 Run focused tests and the project build to verify the logging path.
