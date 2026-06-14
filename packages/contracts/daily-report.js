export const DAILY_REPORT_TASK_STATUS = Object.freeze({
  DRAFTING_PENDING: 'drafting_pending',
  DRAFTING_IN_PROGRESS: 'drafting_in_progress',
  DRAFTING_READY_FOR_REVIEW: 'drafting_ready_for_review',
  EXPORTING_IN_PROGRESS: 'exporting_in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
})

export const DAILY_REPORT_ATTEMPT_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
})

export const DRAFT_VERSION_SOURCE = Object.freeze({
  AI_GENERATED: 'ai_generated',
  USER_EDITED: 'user_edited',
})

export const ARTIFACT_KIND = Object.freeze({
  DOCX_REPORT: 'docx_report',
  RESOURCE_POOL_XLSX: 'resource_pool_xlsx',
})

export const EXPORT_VALIDATION_CODE = Object.freeze({
  OK: 'ok',
  NAMING_RULE_VIOLATED: 'naming_rule_violated',
  ISSUE_NUMBER_MISMATCH: 'issue_number_mismatch',
  ONE_PAGE_EXCEEDED: 'one_page_exceeded',
  WORKER_FAILURE: 'worker_failure',
})

export const DAILY_REPORT_EVENT_TYPE = Object.freeze({
  TASK_CREATED: 'task_created',
  TASK_DUPLICATE_REJECTED: 'task_duplicate_rejected',
  SELECTIONS_SUBMITTED: 'selections_submitted',
  DRAFT_QUEUED: 'draft_queued',
  DRAFT_STARTED: 'draft_started',
  DRAFT_COMPLETED: 'draft_completed',
  DRAFT_FAILED: 'draft_failed',
  DRAFT_EDITED: 'draft_edited',
  EXPORT_QUEUED: 'export_queued',
  EXPORT_STARTED: 'export_started',
  EXPORT_COMPLETED: 'export_completed',
  EXPORT_FAILED: 'export_failed',
  EXPORT_VALIDATION_FAILED: 'export_validation_failed',
  ARTIFACT_CREATED: 'artifact_created',
})

export const DAILY_REPORT_FAILURE_CATEGORY = Object.freeze({
  CANDIDATE_POOL_MISSING: 'candidate_pool_missing',
  UNSUPPORTED_ISSUE_DATE: 'unsupported_issue_date',
  WORKER_FAILURE: 'worker_failure',
  AI_FAILURE: 'ai_failure',
  VALIDATION_FAILURE: 'validation_failure',
})

export function createEmptyDailyReportSummary() {
  return {
    draftGenerated: false,
    exportCompleted: false,
    sectionCount: 0,
    selectionCount: 0,
  }
}

export function createEmptyValidationReport() {
  return {
    passed: false,
    checks: [],
  }
}