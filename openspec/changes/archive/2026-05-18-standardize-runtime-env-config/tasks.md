## 1. Configuration contract and tests

- [x] 1.1 Add failing tests for project-scoped AI key precedence, legacy-key fallback, and root env file loading.
- [x] 1.2 Define the repository-level env file contract and example template for local development.

## 2. Runtime loading implementation

- [x] 2.1 Add a root env loader for the web runtime so local configuration is read from the repository root.
- [x] 2.2 Update the shared AI layer to prefer `XIAOYU_AI_API_KEY` while retaining legacy-key compatibility.
- [x] 2.3 Update ignore rules so real local env files stay out of version control.

## 3. Documentation and verification

- [x] 3.1 Document the root env workflow and Alibaba Cloud Bailian example configuration.
- [x] 3.2 Run focused tests and the project build to verify the new configuration path.
