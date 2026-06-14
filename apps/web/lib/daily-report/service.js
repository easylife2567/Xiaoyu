import { randomUUID } from 'node:crypto'
import { DAILY_REPORT_TASK_STATUS } from '../../../../packages/contracts/daily-report.js'
import { getCandidatePool, resolveTodayIssueDate } from './candidate-pool/index.js'
import { getDailyReportRuntimeRepository } from './runtime-repository.js'
import { getDailyReportStorageAdapter } from './storage-adapter.js'
import { runDailyReportWorker } from './python-worker.js'

function repository() {
  return getDailyReportRuntimeRepository()
}

export async function createDailyReportTask({ workflowSlug, issueDate, issueNumber }) {
  const today = resolveTodayIssueDate()

  if (issueDate !== today) {
    const error = new Error(`当前运行时仅支持今天 (${today}) 创建日报任务。`)
    error.code = 'unsupported_issue_date'
    throw error
  }

  const existingTask = await repository().findExistingTask({ workflowSlug, issueDate })
  if (existingTask) {
    const error = new Error(
      `工作台 ${workflowSlug} 在 ${issueDate} 已有一个活跃任务 (${existingTask.id})。`,
    )
    error.code = 'task_already_exists'
    error.existingTaskId = existingTask.id
    throw error
  }

  return repository().createTask({ workflowSlug, issueDate, issueNumber })
}

export async function getDailyReportTask(taskId) {
  return repository().readTask(taskId)
}

export async function resetDailyReportTask(taskId) {
  await repository().deleteTask(taskId)
  return { ok: true }
}

export async function submitSelections(taskId, selections) {
  const task = await repository().readTask(taskId)
  if (task.status !== DAILY_REPORT_TASK_STATUS.DRAFTING_PENDING) {
    const error = new Error('当前任务状态不允许提交选择。')
    error.code = 'invalid_task_state'
    throw error
  }

  const requiredCount = inferRequiredSelectionCount(task.workflowSlug)
  if (selections.length !== requiredCount) {
    const error = new Error(`需要选择 ${requiredCount} 条候选。`)
    error.code = 'invalid_selection_count'
    throw error
  }

  return repository().submitSelections(taskId, selections)
}

function inferRequiredSelectionCount(workflowSlug) {
  // 国际日报需要 6 条；后续其他工作流可扩展
  if (workflowSlug === 'international-daily-report') {
    return 6
  }
  return 6
}

export async function startDraftAttempt(taskId) {
  const task = await repository().readTask(taskId)
  if (task.status !== DAILY_REPORT_TASK_STATUS.DRAFTING_PENDING) {
    const error = new Error('当前任务状态不允许起草。')
    error.code = 'invalid_task_state'
    throw error
  }

  if (!task.selections || task.selections.length < inferRequiredSelectionCount(task.workflowSlug)) {
    const error = new Error('需要先选择候选再起草。')
    error.code = 'selections_not_submitted'
    throw error
  }

  const updatedTask = await repository().createDraftAttempt(taskId)
  const attempt = updatedTask.attempts.at(-1)
  queueAttempt(taskId, attempt.id)
  return updatedTask
}

function queueAttempt(taskId, attemptId) {
  if (process.env.XIAOYU_DAILY_REPORT_DISABLE_BACKGROUND_QUEUE === '1') {
    return
  }
  queueMicrotask(() => {
    processDraftAttempt(taskId, attemptId).catch(async (error) => {
      await repository().markAttemptFailed(taskId, attemptId, {
        code: 'unexpected_worker_failure',
        message: error instanceof Error ? error.message : '起草失败。',
        category: 'worker_failure',
        retriable: true,
      }, [], [])
    })
  })
}

async function processDraftAttempt(taskId, attemptId) {
  const task = await repository().readTask(taskId)
  await repository().markAttemptProcessing(taskId, attemptId)

  const selections = task.selections.sort((a, b) => a.position - b.position)
  const result = await runDailyReportWorker('draft', [
    '--task-id', taskId,
    '--attempt-id', attemptId,
    ...selections.flatMap((s) => ['--selection', JSON.stringify(s.candidateSnapshot)]),
  ])

  if (!result.ok) {
    await repository().markAttemptFailed(taskId, attemptId, {
      code: result.code,
      message: result.message,
      category: result.failureCategory ?? 'ai_failure',
      retriable: Boolean(result.retriable),
    }, result.aiCalls ?? [], result.events ?? [])
    return
  }

  const latestVersion = task.draftVersions.at(-1)
  const nextVersion = (latestVersion?.version ?? 0) + 1
  await repository().appendDraftVersion(taskId, {
    attemptId,
    version: nextVersion,
    source: 'ai_generated',
    sections: result.sections,
  })
  await repository().markAttemptCompleted(taskId, attemptId, result.summary, result.aiCalls ?? [], result.events ?? [])
}

export async function saveSectionEdit(taskId, { sections }) {
  const task = await repository().readTask(taskId)
  if (task.status !== DAILY_REPORT_TASK_STATUS.DRAFTING_READY_FOR_REVIEW) {
    const error = new Error('当前任务状态不允许编辑草稿。')
    error.code = 'invalid_task_state'
    throw error
  }

  if (!Array.isArray(sections) || sections.length < 1) {
    const error = new Error('section 列表不能为空。')
    error.code = 'invalid_sections'
    throw error
  }

  return repository().saveSectionEdit(taskId, { sections })
}

export async function startExportAttempt(taskId) {
  const task = await repository().readTask(taskId)
  if (task.status !== DAILY_REPORT_TASK_STATUS.DRAFTING_READY_FOR_REVIEW) {
    const error = new Error('当前任务状态不允许导出。')
    error.code = 'invalid_task_state'
    throw error
  }

  const latestDraft = task.draftVersions.at(-1)
  if (!latestDraft) {
    const error = new Error('无可用草稿。')
    error.code = 'no_draft_available'
    throw error
  }

  const updatedTask = await repository().createExportAttempt(taskId)
  const attempt = updatedTask.attempts.at(-1)

  processExportAttempt(taskId, attempt.id, latestDraft).catch(async (error) => {
    await repository().markAttemptFailed(taskId, attempt.id, {
      code: 'unexpected_worker_failure',
      message: error instanceof Error ? error.message : '导出失败。',
      category: 'worker_failure',
      retriable: true,
    }, [], [])
  })

  return updatedTask
}

async function processExportAttempt(taskId, attemptId, draftVersion) {
  const task = await repository().readTask(taskId)
  await repository().markAttemptProcessing(taskId, attemptId)

  const storage = getDailyReportStorageAdapter()
  const { objectKey: docxObjectKey } = await storage.resolveArtifactPath({
    taskId,
    fileName: `国际日报-${task.issueDate.replace(/-/g, '')}-${String(task.issueNumber).padStart(3, '0')}.docx`,
  })
  const { objectKey: xlsxObjectKey } = await storage.resolveArtifactPath({
    taskId,
    fileName: `resource-pool-${task.issueDate.replace(/-/g, '')}.xlsx`,
  })

  const selections = task.selections.sort((a, b) => a.position - b.position)
  const result = await runDailyReportWorker('export', [
    '--task-id', taskId,
    '--attempt-id', attemptId,
    '--issue-date', task.issueDate,
    '--issue-number', String(task.issueNumber),
    '--docx-object-key', docxObjectKey,
    '--xlsx-object-key', xlsxObjectKey,
    '--sections-json', JSON.stringify(draftVersion.sections),
    ...selections.flatMap((s) => ['--selection', JSON.stringify(s.candidateSnapshot)]),
  ])

  if (!result.ok) {
    await repository().markAttemptFailed(taskId, attemptId, {
      code: result.code,
      message: result.message,
      category: result.failureCategory ?? 'validation_failure',
      retriable: Boolean(result.retriable),
      validationReport: result.validationReport ?? null,
    }, result.aiCalls ?? [], result.events ?? [])
    return
  }

  const docxArtifact = {
    id: randomUUID(),
    attemptId,
    draftVersionId: draftVersion.id,
    kind: 'docx_report',
    fileName: result.docx.fileName,
    objectKey: docxObjectKey,
    sizeBytes: result.docx.sizeBytes,
    validationReport: result.validationReport ?? { passed: true, checks: [] },
    createdAt: new Date().toISOString(),
  }

  const xlsxArtifact = {
    id: randomUUID(),
    attemptId,
    draftVersionId: draftVersion.id,
    kind: 'resource_pool_xlsx',
    fileName: result.xlsx.fileName,
    objectKey: xlsxObjectKey,
    sizeBytes: result.xlsx.sizeBytes,
    validationReport: { passed: true, checks: [] },
    createdAt: new Date().toISOString(),
  }

  await repository().appendArtifact(taskId, docxArtifact)
  await repository().appendArtifact(taskId, xlsxArtifact)
  await repository().markAttemptCompleted(taskId, attemptId, result.summary, result.aiCalls ?? [], result.events ?? [])
}

export async function readArtifactBytes(objectKey) {
  const storage = getDailyReportStorageAdapter()
  return storage.readArtifactBytes(objectKey)
}

export async function statArtifact(objectKey) {
  const storage = getDailyReportStorageAdapter()
  return storage.statArtifact(objectKey)
}