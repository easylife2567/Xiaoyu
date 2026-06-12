import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { TASK_STATUS, VALIDATION_CODE } from '../../../../packages/contracts/translation-processing.js'
import {
  appendArtifact,
  createAttempt,
  createTask,
  markAttemptCompleted,
  markAttemptFailed,
  markAttemptProcessing,
  readTaskProgress,
  readTask,
} from './store.js'
import {
  getFileSize,
  persistUpload,
  readArtifactBytes,
  reserveArtifactPath,
  resolveUploadPath,
} from './files.js'
import { runWorker } from './python-worker.js'

function assertSupportedFileName(fileName) {
  const extension = path.extname(fileName).toLowerCase()
  if (!['.xlsx', '.xlsm'].includes(extension)) {
    const error = new Error('仅支持 .xlsx 或 .xlsm Excel 工作簿。')
    error.code = VALIDATION_CODE.INVALID_FILE_TYPE
    throw error
  }
}

export async function createTranslationTask({ fileName, buffer }) {
  assertSupportedFileName(fileName)
  const upload = await persistUpload({ fileName, buffer })
  const validation = await runWorker('validate', ['--input', upload.absolutePath])

  if (!validation.ok) {
    const error = new Error(validation.message)
    error.code = validation.code
    throw error
  }

  return createTask({
    fileName,
    sourceObjectKey: upload.objectKey,
    sizeBytes: buffer.byteLength,
    validation,
  })
}

export async function getTranslationTask(taskId) {
  const task = await readTask(taskId)
  const latestAttempt = task.attempts.at(-1)
  const progress = latestAttempt ? await readTaskProgress(taskId, latestAttempt.id) : null
  return progress ? { ...task, progress } : task
}

export function describeTaskReadiness(task) {
  return task.status === TASK_STATUS.READY ? '文件已就绪，可以开始处理。' : null
}

async function processAttempt(taskId, attemptId) {
  const task = await readTask(taskId)
  await markAttemptProcessing(taskId, attemptId)
  const version = task.artifacts.length + 1
  const artifact = await reserveArtifactPath({ taskId, version })
  const result = await runWorker('process', [
    '--input',
    await resolveUploadPath(task.sourceObjectKey),
    '--output',
    artifact.absolutePath,
    '--task-id',
    taskId,
    '--attempt-id',
    attemptId,
  ])

  if (!result.ok) {
    await markAttemptFailed(taskId, attemptId, {
      code: result.code,
      message: result.message,
      category: result.failureCategory ?? 'provider_error',
      retriable: Boolean(result.retriable),
      issues: result.issues ?? [],
    }, result.aiCalls ?? [], result.events ?? [])
    return
  }

  await appendArtifact(taskId, {
    id: randomUUID(),
    attemptId,
    fileName: artifact.fileName,
    objectKey: artifact.objectKey,
    version,
    sizeBytes: await getFileSize(artifact.absolutePath),
    createdAt: new Date().toISOString(),
  })
  await markAttemptCompleted(taskId, attemptId, result.summary, result.aiCalls ?? [], result.events ?? [])
}

function queueAttempt(taskId, attemptId) {
  if (process.env.XIAOYU_TRANSLATION_DISABLE_BACKGROUND_QUEUE === '1') {
    return
  }

  queueMicrotask(() => {
    processAttempt(taskId, attemptId).catch(async (error) => {
      await markAttemptFailed(taskId, attemptId, {
        code: 'unexpected_worker_failure',
        message: error instanceof Error ? error.message : '处理失败。',
        category: 'provider_error',
        retriable: true,
        issues: [],
      }, [], [])
    })
  })
}

export async function startTranslationTask(taskId) {
  const task = await readTask(taskId)
  if (task.status !== TASK_STATUS.READY) {
    throw new Error('当前任务不可启动。')
  }
  const nextTask = await createAttempt(taskId)
  const attempt = nextTask.attempts.at(-1)
  queueAttempt(taskId, attempt.id)
  return nextTask
}

export async function retryTranslationTask(taskId) {
  const task = await readTask(taskId)
  if (task.status !== TASK_STATUS.FAILED && task.status !== TASK_STATUS.COMPLETED) {
    throw new Error('当前任务不可重试。')
  }
  const nextTask = await createAttempt(taskId)
  const attempt = nextTask.attempts.at(-1)
  queueAttempt(taskId, attempt.id)
  return nextTask
}

export async function readLatestArtifact(taskId) {
  const task = await readTask(taskId)
  const artifact = task.artifacts.at(-1)
  if (!artifact) {
    return null
  }

  return {
    artifact,
    bytes: await readArtifactBytes(artifact.objectKey),
  }
}
