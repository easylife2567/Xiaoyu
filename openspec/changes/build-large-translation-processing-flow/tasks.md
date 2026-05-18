## 1. Task and storage foundations

- [x] 1.1 Define the durable local task, task-attempt, upload, and artifact records needed for 大翻译数据处理.
- [x] 1.2 Add shared contracts for task status, validation errors, processing summaries, and downloadable artifacts.
- [x] 1.3 Scaffold the backend/worker modules required to run asynchronous translation-processing tasks behind replaceable runtime seams.

## 2. File ingestion and task APIs

- [x] 2.1 Implement upload handling for the single Excel workbook required by 大翻译数据处理.
- [x] 2.2 Implement workbook validation for file type, required structure, and human-readable rejection messages.
- [x] 2.3 Implement task creation, task detail, task start, and task retry endpoints for the translation-processing workflow.
- [x] 2.4 Persist original uploads and expose task-ready state after successful validation.

## 3. Large translation processing pipeline

- [x] 3.1 Implement workbook audit/parsing that locates the configured source and output fields while preserving unrelated workbook content.
- [x] 3.2 Implement shared-AI-layer invocation for concise Chinese one-sentence summary generation.
- [x] 3.3 Implement deterministic classification priority rules and taxonomy fallback behavior for supported rows.
- [x] 3.4 Implement workbook write-back, row-level issue reporting, and output validation before success.
- [x] 3.5 Archive the processed workbook as a downloadable artifact and preserve versions across retries.

## 4. Workbench integration

- [x] 4.1 Replace the placeholder upload area with a real upload flow and validated-file feedback in the 大翻译数据处理 workbench.
- [x] 4.2 Connect the workbench to real task states, processing summaries, failure reasons, and retry actions.
- [x] 4.3 Surface the completed workbook in the result-delivery region with a download action.

## 5. Verification

- [x] 5.1 Add automated tests for file validation, task lifecycle, AI-failure handling, classification rules, output validation, and artifact versioning.
- [x] 5.2 Add end-to-end coverage for the happy path from workbook upload through result download.
- [x] 5.3 Verify that the implemented flow stays within scope: 大翻译数据处理 only, no日报能力、本地同步、通用模板编辑或低层参数暴露.
