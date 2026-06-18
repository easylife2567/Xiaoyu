## ADDED Requirements

### Requirement: Candidate pool collector pulls from configured live source feeds

The system SHALL provide a candidate-pool collector that, for each configured workflow, pulls items from a workflow-scoped set of live source feeds (RSS for the first iteration), normalizes them into the candidate item schema, deduplicates them by canonical source URL and title fingerprint, drops items older than the workflow's recency window or items missing a publication time, and writes the resulting candidate set to the same on-disk fixture path that the candidate pool provider reads. A single feed's failure SHALL NOT abort the run, but a run in which every feed fails SHALL NOT produce an output file and SHALL surface a structured `no_feeds_succeeded` error to its caller.

#### Scenario: Collector successfully produces today's pool

- **WHEN** the operator triggers the collector for a configured workflow on today's `issueDate`
- **AND** at least one configured feed returns parseable items within the recency window
- **THEN** the system SHALL write `<workflowSlug>/<issueDate>.json` under the candidate-pool fixture root
- **AND** the file SHALL conform to the same schema the seed-fixture provider already accepts
- **AND** each emitted candidate SHALL carry `sourceType: 'rss'` plus the existing required fields (`id`, `title`, `sourceName`, `sourceUrl`, `publishedAt`, `summary`, `retrievalMetadata`)
- **AND** the workbench's next read of today's candidate pool SHALL serve the collector's output through the existing provider interface, with no change to drafting, editing, or export behavior

#### Scenario: A configured feed is unavailable during a collection run

- **WHEN** one configured feed times out, returns an HTTP error, or returns malformed content
- **AND** at least one other configured feed returns usable items
- **THEN** the system SHALL skip the failing feed, record the error in the run's structured report, and continue with the remaining feeds
- **AND** the resulting fixture file SHALL be produced as long as the merged, deduplicated, recency-filtered set is non-empty

#### Scenario: All configured feeds fail in a single run

- **WHEN** every configured feed for the workflow fails (network, parse, or HTTP errors) in a single collection run
- **THEN** the system SHALL NOT write or overwrite the target fixture file
- **AND** the system SHALL exit with a non-zero status carrying a structured `no_feeds_succeeded` error including a per-feed report
- **AND** the existing stale-fixture fall-back SHALL remain the source of today's candidate pool for downstream readers, unchanged

#### Scenario: Retrieved item has no usable publication time

- **WHEN** a retrieved item lacks a parseable publication time, or its publication time falls outside the workflow's configured recency window
- **THEN** the system SHALL exclude that item from the produced fixture

#### Scenario: Two retrieved items describe the same URL

- **WHEN** two or more retrieved items resolve to the same canonical source URL after stripping tracking parameters and normalizing host case
- **THEN** the system SHALL keep only the first occurrence in the deduplicated output

#### Scenario: Operator targets an existing fixture file without forcing overwrite

- **WHEN** the collector run targets a `<workflowSlug>/<issueDate>.json` that already exists
- **AND** the operator did not request an overwrite
- **THEN** the system SHALL exit with a non-zero status carrying a structured `target_already_exists` error and SHALL NOT modify the existing file

### Requirement: Each candidate carries an explicit origin sourceType

The system SHALL record each candidate's origin via a `sourceType` field whose value is drawn from a known enumeration including at minimum `fixture` (seed fixture) and `rss` (RSS-collected). Drafting, editing, and export consumers SHALL NOT branch on `sourceType`; they SHALL treat all valid origins identically for content shaping. Operators SHALL be able to inspect `sourceType` on each candidate to distinguish hand-prepared fixtures from live-source-collected items.

#### Scenario: Workbench reads a fixture file produced by the collector

- **WHEN** the daily-report workbench requests today's candidate pool
- **AND** the underlying fixture file was produced by the live-source collector
- **THEN** the system SHALL surface each candidate with `sourceType: 'rss'`
- **AND** the workbench, drafting, editing, and export paths SHALL behave identically to the seed-fixture path for the same shape of candidate

#### Scenario: An unknown sourceType reaches the candidate pool reader

- **WHEN** a candidate's `sourceType` is neither `fixture` nor `rss` nor any other value declared in the known enumeration
- **THEN** the system SHALL reject the read with the existing `candidate_pool_invalid` error, unchanged in shape

#### Scenario: Operator audits the origin of report material

- **WHEN** an operator inspects the candidates that fed a given daily report
- **THEN** the system SHALL surface each candidate's `sourceType`, so live-source-collected candidates are clearly distinguishable from seed-fixture ones
