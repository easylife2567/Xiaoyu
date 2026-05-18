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

export function createEmptyProcessingSummary() {
  return {
    processedRows: 0,
    generatedSummaries: 0,
    classifiedRows: 0,
    issueCount: 0,
    issues: [],
  }
}
