# Repository Structure Companion Note

This note records the intended repository layout implied by the architecture spec.

```text
小舆/
├── apps/
│   └── web/                     # Next.js product application
│
├── services/
│   ├── api/                     # FastAPI endpoints for Python-side capabilities when needed
│   └── worker/                  # Celery workers, scheduled jobs, document-processing tasks
│
├── packages/
│   ├── contracts/               # Shared schemas, enums, cross-runtime payload definitions
│   └── ui/                      # Optional shared UI primitives once reuse justifies it
│
├── infra/
│   ├── docker/                  # Local service definitions, container assets
│   └── compose/                 # Local orchestration for PostgreSQL, Redis, MinIO
│
├── openspec/                   # Long-term specs and change proposals
└── docs/                       # Product and engineering documentation when needed
```

## Structural Intent

- `apps/web` owns the browser product and later provides the frontend foundation that Tauri will reuse.
- `services/worker` owns long-running jobs such as daily candidate-pool generation, spreadsheet processing, document export, and image-related tasks.
- `services/api` exists for Python-side HTTP capabilities that should not be forced through the web runtime.
- `packages/contracts` is the boundary where both TypeScript and Python must agree on workflow payloads, statuses, and shared schemas.
- `infra` makes the local stack reproducible instead of relying on developer memory.

## Domain Layout Guidance

Inside each runtime, prefer capability folders such as:

```text
workflows/
  translation-processing/
  daily-reports/
artifacts/
candidate-pools/
```

rather than only global technical buckets like `controllers/`, `services/`, and `utils/`.
