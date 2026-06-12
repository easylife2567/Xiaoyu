export const TRANSLATION_WORKFLOW_SLUG = 'translation-processing'

export const TASK_STATUS = Object.freeze({
  READY: 'ready',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
})

export const ATTEMPT_STATUS = Object.freeze({
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
})

export const VALIDATION_CODE = Object.freeze({
  MISSING_FILE: 'missing_file',
  INVALID_FILE_TYPE: 'invalid_file_type',
  INVALID_WORKBOOK_STRUCTURE: 'invalid_workbook_structure',
  INVALID_WORKBOOK_CONTENT: 'invalid_workbook_content',
  OUTPUT_VALIDATION_FAILED: 'output_validation_failed',
  AI_PROVIDER_UNAVAILABLE: 'ai_provider_unavailable',
})

export const TASK_EVENT_TYPE = Object.freeze({
  TASK_CREATED: 'task_created',
  VALIDATION_PASSED: 'validation_passed',
  ATTEMPT_QUEUED: 'attempt_queued',
  ATTEMPT_STARTED: 'attempt_started',
  SHEET_STARTED: 'sheet_started',
  SENSITIVE_CONTENT_DOWNGRADED: 'sensitive_content_downgraded',
  AI_BATCH_STARTED: 'ai_batch_started',
  AI_BATCH_SUCCEEDED: 'ai_batch_succeeded',
  AI_BATCH_FAILED: 'ai_batch_failed',
  AI_BATCH_FALLBACK_STARTED: 'ai_batch_fallback_started',
  AI_BATCH_FALLBACK_COMPLETED: 'ai_batch_fallback_completed',
  AI_CALL_RETRY_SCHEDULED: 'ai_call_retry_scheduled',
  AI_CALL_SUCCEEDED: 'ai_call_succeeded',
  AI_CALL_FAILED: 'ai_call_failed',
  ATTEMPT_COMPLETED: 'attempt_completed',
  ATTEMPT_FAILED: 'attempt_failed',
})

export const AI_FAILURE_CATEGORY = Object.freeze({
  CONFIGURATION_ERROR: 'configuration_error',
  RATE_LIMITED: 'rate_limited',
  TIMEOUT: 'timeout',
  PROVIDER_ERROR: 'provider_error',
  INVALID_RESPONSE: 'invalid_response',
})

export function createEmptyProcessingSummary() {
  return {
    processedRows: 0,
    generatedSummaries: 0,
    classifiedRows: 0,
    issueCount: 0,
    issues: [],
  }
}
