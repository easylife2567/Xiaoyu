import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ATTEMPT_STATUS, TASK_STATUS, createEmptyProcessingSummary } from '../../../../packages/contracts/translation-processing.js'
import { ARTIFACT_ROOT, TASK_ROOT, UPLOAD_ROOT } from './config.js'

async function ensureRoots() {
  await Promise.all([TASK_ROOT, UPLOAD_ROOT, ARTIFACT_ROOT].map((root) => mkdir(root, { recursive: true })))
}

function taskPath(taskId) {
  return path.join(TASK_ROOT, `${taskId}.json`)
}

export async function createTask({ fileName, sourceObjectKey, sizeBytes, validation }) {
  await ensureRoots()
  const now = new Date().toISOString()
  const task = {
    id: randomUUID(),
    workflowSlug: 'translation-processing',
    status: TASK_STATUS.READY,
    sourceFileName: fileName,
    sourceObjectKey,
    validation,
    summary: createEmptyProcessingSummary(),
    failure: null,
    createdAt: now,
    updatedAt: now,
    uploads: [
      {
        id: randomUUID(),
        fileName,
        objectKey: sourceObjectKey,
        sizeBytes,
        createdAt: now,
      },
    ],
    attempts: [],
    artifacts: [],
  }

  await writeTask(task)
  return task
}

export async function readTask(taskId) {
  await ensureRoots()
  const raw = await readFile(taskPath(taskId), 'utf8')
  return JSON.parse(raw)
}

export async function writeTask(task) {
  await ensureRoots()
  const nextTask = { ...task, updatedAt: new Date().toISOString() }
  await writeFile(taskPath(task.id), JSON.stringify(nextTask, null, 2))
  return nextTask
}

export async function mutateTask(taskId, updater) {
  const current = await readTask(taskId)
  const next = updater(current)
  return writeTask(next)
}

export async function createAttempt(taskId) {
  const now = new Date().toISOString()
  return mutateTask(taskId, (task) => ({
    ...task,
    status: TASK_STATUS.QUEUED,
    failure: null,
    attempts: [
      ...task.attempts,
      {
        id: randomUUID(),
        status: ATTEMPT_STATUS.QUEUED,
        createdAt: now,
        startedAt: null,
        finishedAt: null,
        summary: null,
        failure: null,
      },
    ],
  }))
}

export async function appendArtifact(taskId, artifact) {
  return mutateTask(taskId, (task) => ({
    ...task,
    artifacts: [...task.artifacts, artifact],
  }))
}

export async function markAttemptProcessing(taskId, attemptId) {
  const now = new Date().toISOString()
  return mutateTask(taskId, (task) => ({
    ...task,
    status: TASK_STATUS.PROCESSING,
    attempts: task.attempts.map((attempt) =>
      attempt.id === attemptId ? { ...attempt, status: ATTEMPT_STATUS.PROCESSING, startedAt: now } : attempt,
    ),
  }))
}

export async function markAttemptCompleted(taskId, attemptId, summary) {
  const now = new Date().toISOString()
  return mutateTask(taskId, (task) => ({
    ...task,
    status: TASK_STATUS.COMPLETED,
    summary,
    failure: null,
    attempts: task.attempts.map((attempt) =>
      attempt.id === attemptId
        ? { ...attempt, status: ATTEMPT_STATUS.COMPLETED, finishedAt: now, summary, failure: null }
        : attempt,
    ),
  }))
}

export async function markAttemptFailed(taskId, attemptId, failure) {
  const now = new Date().toISOString()
  return mutateTask(taskId, (task) => ({
    ...task,
    status: TASK_STATUS.FAILED,
    failure,
    attempts: task.attempts.map((attempt) =>
      attempt.id === attemptId
        ? { ...attempt, status: ATTEMPT_STATUS.FAILED, finishedAt: now, failure }
        : attempt,
    ),
  }))
}

export async function resetTaskStoreForTests() {
  await ensureRoots()
}
