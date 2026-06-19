import { TASK_STATUS } from '../../../../packages/contracts/translation-processing.js'
import { readTaskProgress, removeTaskProgress, resetProgressStoreForTests, writeTaskProgress } from './progress-store.js'
import { getTranslationRuntimeRepository, resetTranslationRuntimeRepositoryForTests } from './runtime-repository.js'

function runtimeRepository() {
  return getTranslationRuntimeRepository()
}

export async function createTask(input) {
  return runtimeRepository().createTask(input)
}

export async function readTask(taskId) {
  return runtimeRepository().readTask(taskId)
}

export async function createAttempt(taskId) {
  return runtimeRepository().createAttempt(taskId)
}

export async function appendArtifact(taskId, artifact) {
  return runtimeRepository().appendArtifact(taskId, artifact)
}

export async function markAttemptProcessing(taskId, attemptId) {
  const nextTask = await runtimeRepository().markAttemptProcessing(taskId, attemptId)
  const now = new Date().toISOString()
  await writeTaskProgress(taskId, attemptId, {
    taskId,
    attemptId,
    status: TASK_STATUS.PROCESSING,
    totalRows: nextTask.validation?.sourceRows ?? 0,
    completedRows: 0,
    totalBatches: 0,
    completedBatches: 0,
    activeBatches: [],
    currentSheet: null,
    currentActivity: '任务已启动，等待 worker 返回实时进度…',
    events: [],
    updatedAt: now,
  })
  return nextTask
}

export async function markAttemptCompleted(taskId, attemptId, summary, aiCalls = [], events = []) {
  const nextTask = await runtimeRepository().markAttemptCompleted(taskId, attemptId, summary, aiCalls, events)
  await removeTaskProgress(taskId, attemptId)
  return nextTask
}

export async function markAttemptFailed(taskId, attemptId, failure, aiCalls = [], events = []) {
  const nextTask = await runtimeRepository().markAttemptFailed(taskId, attemptId, failure, aiCalls, events)
  await removeTaskProgress(taskId, attemptId)
  return nextTask
}

export async function deleteTask(taskId) {
  await runtimeRepository().deleteTask(taskId)
}

export { readTaskProgress, removeTaskProgress, writeTaskProgress }

export async function resetTaskStoreForTests() {
  await resetTranslationRuntimeRepositoryForTests()
  await resetProgressStoreForTests()
}
