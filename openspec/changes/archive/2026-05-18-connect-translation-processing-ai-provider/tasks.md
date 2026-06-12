## 1. Provider contract and tests

- [x] 1.1 Add failing tests for production-provider configuration, missing credentials, normalized successful responses, unusable responses, and retriable upstream failures.
- [x] 1.2 Define the worker-side environment configuration contract for provider name, model, base URL, timeout, and credentials without exposing secrets to client code.

## 2. Shared AI provider implementation

- [x] 2.1 Implement the production provider adapter inside the shared AI layer while preserving existing `stub` and `fail` test modes.
- [x] 2.2 Normalize provider responses into valid Chinese summaries and reject empty or malformed outputs with explainable errors.
- [x] 2.3 Map configuration failures and transient provider failures into explicit error types/messages that fit the existing workflow retry path.

## 3. Translation workflow integration

- [x] 3.1 Wire `大翻译数据处理` summary generation through the production adapter without moving provider-specific logic into workflow code.
- [x] 3.2 Persist or expose the minimum trace metadata needed to associate task run, source row, provider context, generated summary, and failure result.

## 4. Documentation and verification

- [x] 4.1 Document the local runtime environment variables and safe secret-handling expectations for real AI execution.
- [x] 4.2 Run the focused test suite and project build to verify the production provider path does not break the existing local vertical slice.
