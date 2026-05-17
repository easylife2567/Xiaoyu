# system-architecture Specification

## Purpose

Define the foundational system architecture for 小舆 so the product can support web interaction, desktop-assisted file workflows, background processing, and document-heavy automation without forcing all responsibilities into one runtime.

## Requirements

### Requirement: The system uses a split architecture suited to its workload

The system SHALL use a split architecture in which the web application layer handles product interaction and orchestration while background document-processing work is delegated to specialized worker services.

#### Scenario: A user performs an interactive workflow

- WHEN a user navigates workbenches, uploads inputs, reviews candidates, or downloads results
- THEN the web application layer SHALL serve those interactive product experiences

#### Scenario: A workflow requires heavy document or file processing

- WHEN a task requires Excel, DOCX, PDF, image, or long-running transformation work
- THEN the system SHALL delegate that work to background worker services rather than blocking the web request path

### Requirement: The web product layer is implemented with Next.js

The system SHALL use Next.js as the primary web product layer for user-facing pages, shared UI, and application-facing HTTP endpoints.

#### Scenario: Users access the web application

- WHEN a user opens 小舆 in the browser
- THEN the primary product experience SHALL be served by the Next.js application

#### Scenario: The product needs web-facing endpoints

- WHEN the application requires request handlers for product workflows
- THEN those endpoints SHALL be exposed through the web application layer rather than duplicating frontend-facing APIs elsewhere by default

### Requirement: The application data layer uses PostgreSQL with Prisma

The system SHALL use PostgreSQL as the primary relational database and Prisma as the database access and migration layer for the TypeScript application.

#### Scenario: The application stores structured workflow state

- WHEN the system persists templates, tasks, candidate stories, drafts, artifacts, or sync metadata
- THEN it SHALL store that structured data in PostgreSQL

#### Scenario: The web application reads or writes relational data

- WHEN the Next.js application needs database access
- THEN it SHALL use Prisma as the primary ORM and migration interface

### Requirement: Long-running work is executed asynchronously through Redis-backed Celery workers

The system SHALL use Redis-backed Celery workers for long-running and scheduled processing tasks.

#### Scenario: A user starts a heavy workflow

- WHEN a workflow requires non-trivial processing time
- THEN the application SHALL enqueue the task for asynchronous execution rather than holding a synchronous request open until completion

#### Scenario: The system prepares daily news pools

- WHEN scheduled daily candidate generation is required
- THEN the system SHALL execute that periodic work through the Celery scheduling and worker layer

### Requirement: Document-heavy processing is implemented in Python services

The system SHALL use Python services for document-heavy and file-transformation workflows.

#### Scenario: A workflow processes Excel, DOCX, or PDF files

- WHEN a task requires workbook parsing, document rendering, encryption, or export verification
- THEN the task SHALL be executed by Python-based processing services suited to those libraries and workflows

#### Scenario: The system expands to additional file-processing workbenches

- WHEN new document-heavy workflows are added
- THEN they SHOULD reuse the Python processing layer rather than embedding document logic inside the web application runtime

### Requirement: Binary files are stored in S3-compatible object storage

The system SHALL store uploaded files and generated artifacts in S3-compatible object storage.

#### Scenario: The system stores uploaded inputs

- WHEN users upload source files for a workflow
- THEN the binaries SHALL be persisted in object storage and referenced from application records

#### Scenario: The system stores generated outputs

- WHEN workflows produce DOCX, PDF, XLSX, image, or other artifact files
- THEN those binaries SHALL be stored in object storage and linked to their corresponding tasks

### Requirement: Local development uses MinIO as the object-storage implementation

The system SHALL use MinIO in local development environments to emulate the S3-compatible object-storage contract used in production.

#### Scenario: Developers run the system locally

- WHEN a local development environment requires object storage
- THEN MinIO SHALL provide the S3-compatible implementation without changing the application's storage contract

### Requirement: The desktop client is deferred until the web product stabilizes

The system SHALL defer desktop-client implementation until the web product flow is stable enough to wrap, and SHALL adopt Tauri as the desktop companion path once the web product flow is stable.

#### Scenario: The web product is still evolving rapidly

- WHEN the workbench flows and artifact model are still being established
- THEN the system SHALL prioritize the web implementation before building a desktop shell

#### Scenario: The web experience becomes stable

- WHEN the web workflows are mature enough to reuse across platforms
- THEN the system SHALL introduce a Tauri desktop companion that reuses the web frontend and adds local file integration

### Requirement: The repository uses a monorepo structure organized by runtime responsibility

The system SHALL use a monorepo structure that separates the web application, Python services, shared packages, and infrastructure configuration by runtime responsibility.

#### Scenario: Developers navigate the repository

- WHEN developers inspect the project structure
- THEN they SHALL find distinct top-level areas for the web app, Python services, shared packages, and infrastructure definitions

#### Scenario: A new runtime-specific component is added

- WHEN a feature belongs primarily to the web layer or the Python worker layer
- THEN it SHALL be placed in the corresponding runtime-specific area rather than mixed into an unrelated app

### Requirement: The web application lives under apps/web

The system SHALL place the Next.js product application under `apps/web`.

#### Scenario: Developers work on the product UI

- WHEN developers add or modify user-facing routes, pages, or workbench UI
- THEN that code SHALL live under `apps/web`

### Requirement: Python runtime services live under services

The system SHALL place Python runtime services under `services`, with separate service roots for API-facing Python code and background worker code where separation is needed.

#### Scenario: Developers add document-processing logic

- WHEN developers add reusable Python processing code for Excel, DOCX, PDF, or images
- THEN that code SHALL live under `services` rather than inside the web application tree

#### Scenario: Developers add background jobs

- WHEN developers implement Celery tasks or periodic jobs
- THEN those tasks SHALL live in the Python service area responsible for worker execution

### Requirement: Shared cross-runtime contracts are centralized

The system SHALL centralize shared contracts and schemas that must remain consistent across runtimes.

#### Scenario: The web app and Python services share a workflow contract

- WHEN both runtimes depend on the same task payload, status enum, or artifact metadata shape
- THEN the contract SHALL be defined in a shared location rather than duplicated independently

### Requirement: Infrastructure configuration is versioned in the repository

The system SHALL keep local-development and deployment-supporting infrastructure configuration under a dedicated repository area.

#### Scenario: Developers start local dependencies

- WHEN developers need PostgreSQL, Redis, and MinIO locally
- THEN the required infrastructure definitions SHALL be versioned with the repository

### Requirement: Domain-first organization is preferred inside each runtime

The system SHALL organize application code by product domain or capability within each runtime rather than by generic technical layer alone.

#### Scenario: Developers add daily-report functionality

- WHEN developers implement daily-report behavior in the web or Python runtime
- THEN the code SHALL be grouped around the daily-report capability rather than scattered only into generic folders such as controllers, services, and utils
