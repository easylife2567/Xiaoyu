## 1. Spec and configuration plumbing

- [x] 1.1 Add batch execution runtime variables to the shared AI configuration contract and repository env template.
- [x] 1.2 Extend translation-processing contracts and log formatting for batch-level execution events.

## 2. Shared AI batch processing

- [x] 2.1 Add a batch summarization entry point to the shared AI layer with normalized JSON parsing and trace metadata.
- [x] 2.2 Add unit tests covering valid batch responses and malformed batch responses.

## 3. Worker-side batch orchestration

- [x] 3.1 Refactor the translation worker to group rows into batches and execute those batches concurrently.
- [x] 3.2 Add downgrade handling so failed batches fall back to finer-grained row execution when enabled.
- [x] 3.3 Emit batch-level runtime events and preserve successful workbook write-back ordering.

## 4. Verification

- [x] 4.1 Add worker/integration tests for batch success and batch fallback behavior.
- [x] 4.2 Run targeted Python tests, `npm test`, and `npm run build`.
