## 1. Rule detection and fallback contract

- [x] 1.1 Add a worker-side sensitive-content rule module and neutral fallback summary templates.
- [x] 1.2 Define how downgraded rows are represented in task issues, attempt logs, and diagnostics.

## 2. Worker integration

- [x] 2.1 Route sensitive rows around the normal AI path before batch or single-row generation starts.
- [x] 2.2 Write fallback summaries and preserved classifications for downgraded rows while keeping the workbook exportable.
- [x] 2.3 Ensure sensitive downgrades do not trigger retry-oriented provider failure handling.

## 3. User visibility

- [x] 3.1 Extend runtime logs and diagnostics so users can see downgraded rows and manual-review recommendations.
- [x] 3.2 Render downgrade explanations in the translation workbench result state.

## 4. Verification

- [x] 4.1 Add tests covering ordinary rows, sensitive fallback rows, and mixed workbooks.
- [x] 4.2 Run targeted tests, `npm test`, and `npm run build`.
