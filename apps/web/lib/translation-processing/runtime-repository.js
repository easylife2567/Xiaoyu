import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ATTEMPT_STATUS, TASK_STATUS, createEmptyProcessingSummary } from '../../../../packages/contracts/translation-processing.js'
import { getPrismaClient } from '../prisma.js'
import { TASK_ROOT, resolveTranslationRuntimeRepositoryMode } from './config.js'

function createEvent(type, detail = {}) {
  return {
    type,
    createdAt: new Date().toISOString(),
    detail,
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function sortByCreatedAt(items) {
  return [...items].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
}

function normalizeTask(task) {
  return {
    ...task,
    summary: task.summary ?? createEmptyProcessingSummary(),
    failure: task.failure ?? null,
    events: task.events ?? [],
    uploads: sortByCreatedAt(task.uploads ?? []),
    attempts: sortByCreatedAt(task.attempts ?? []).map((attempt) => ({
      ...attempt,
      summary: attempt.summary ?? null,
      failure: attempt.failure ?? null,
      aiCalls: attempt.aiCalls ?? [],
      events: attempt.events ?? [],
    })),
    artifacts: [...(task.artifacts ?? [])].sort((left, right) => left.version - right.version),
  }
}

async function ensureTaskRoot() {
  await mkdir(TASK_ROOT, { recursive: true })
}

function taskPath(taskId) {
  return path.join(TASK_ROOT, `${taskId}.json`)
}

class FileRuntimeRepository {
  async createTask({ fileName, sourceObjectKey, sizeBytes, validation }) {
    await ensureTaskRoot()
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
      events: [
        createEvent('task_created', { fileName }),
        createEvent('validation_passed', { sourceRows: validation.sourceRows }),
      ],
    }

    await this.#writeTask(task)
    return normalizeTask(task)
  }

  async readTask(taskId) {
    await ensureTaskRoot()
    const raw = await readFile(taskPath(taskId), 'utf8')
    return normalizeTask(JSON.parse(raw))
  }

  async createAttempt(taskId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
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
          aiCalls: [],
          events: [createEvent('attempt_queued')],
        },
      ],
    }))
  }

  async appendArtifact(taskId, artifact) {
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      artifacts: [...task.artifacts, artifact],
    }))
  }

  async markAttemptProcessing(taskId, attemptId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: TASK_STATUS.PROCESSING,
      attempts: task.attempts.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: ATTEMPT_STATUS.PROCESSING,
              startedAt: now,
              events: [...attempt.events, createEvent('attempt_started')],
            }
          : attempt,
      ),
    }))
  }

  async markAttemptCompleted(taskId, attemptId, summary, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: TASK_STATUS.COMPLETED,
      summary,
      failure: null,
      attempts: task.attempts.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: ATTEMPT_STATUS.COMPLETED,
              finishedAt: now,
              summary,
              failure: null,
              aiCalls,
              events: [...attempt.events, ...events, createEvent('attempt_completed')],
            }
          : attempt,
      ),
    }))
  }

  async markAttemptFailed(taskId, attemptId, failure, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: TASK_STATUS.FAILED,
      failure,
      attempts: task.attempts.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: ATTEMPT_STATUS.FAILED,
              finishedAt: now,
              failure,
              aiCalls,
              events: [...attempt.events, ...events, createEvent('attempt_failed', { category: failure.category })],
            }
          : attempt,
      ),
    }))
  }

  async reset() {
    await ensureTaskRoot()
    await rm(TASK_ROOT, { recursive: true, force: true })
    await ensureTaskRoot()
  }

  async deleteTask(taskId) {
    await rm(taskPath(taskId), { force: true })
  }

  async #writeTask(task) {
    await ensureTaskRoot()
    const nextTask = { ...task, updatedAt: new Date().toISOString() }
    const targetPath = taskPath(task.id)
    const tempPath = `${targetPath}.${randomUUID()}.tmp`
    await writeFile(tempPath, JSON.stringify(nextTask, null, 2))
    await rename(tempPath, targetPath)
    return normalizeTask(nextTask)
  }

  async #mutateTask(taskId, updater) {
    const current = await this.readTask(taskId)
    const next = updater(current)
    return this.#writeTask(next)
  }
}

class MemoryRuntimeRepository {
  #tasks = new Map()

  async createTask({ fileName, sourceObjectKey, sizeBytes, validation }) {
    const now = new Date().toISOString()
    const task = normalizeTask({
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
      events: [
        createEvent('task_created', { fileName }),
        createEvent('validation_passed', { sourceRows: validation.sourceRows }),
      ],
    })

    this.#tasks.set(task.id, clone(task))
    return clone(task)
  }

  async readTask(taskId) {
    const task = this.#tasks.get(taskId)
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }
    return clone(task)
  }

  async createAttempt(taskId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
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
          aiCalls: [],
          events: [createEvent('attempt_queued')],
        },
      ],
    }))
  }

  async appendArtifact(taskId, artifact) {
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      artifacts: [...task.artifacts, artifact],
    }))
  }

  async markAttemptProcessing(taskId, attemptId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: TASK_STATUS.PROCESSING,
      attempts: task.attempts.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: ATTEMPT_STATUS.PROCESSING,
              startedAt: now,
              events: [...attempt.events, createEvent('attempt_started')],
            }
          : attempt,
      ),
    }))
  }

  async markAttemptCompleted(taskId, attemptId, summary, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: TASK_STATUS.COMPLETED,
      summary,
      failure: null,
      attempts: task.attempts.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: ATTEMPT_STATUS.COMPLETED,
              finishedAt: now,
              summary,
              failure: null,
              aiCalls,
              events: [...attempt.events, ...events, createEvent('attempt_completed')],
            }
          : attempt,
      ),
    }))
  }

  async markAttemptFailed(taskId, attemptId, failure, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: TASK_STATUS.FAILED,
      failure,
      attempts: task.attempts.map((attempt) =>
        attempt.id === attemptId
          ? {
              ...attempt,
              status: ATTEMPT_STATUS.FAILED,
              finishedAt: now,
              failure,
              aiCalls,
              events: [...attempt.events, ...events, createEvent('attempt_failed', { category: failure.category })],
            }
          : attempt,
      ),
    }))
  }

  async reset() {
    this.#tasks.clear()
  }

  async deleteTask(taskId) {
    this.#tasks.delete(taskId)
  }

  async #mutateTask(taskId, updater) {
    const task = await this.readTask(taskId)
    const nextTask = normalizeTask({
      ...updater(task),
      updatedAt: new Date().toISOString(),
    })
    this.#tasks.set(taskId, clone(nextTask))
    return clone(nextTask)
  }
}

function toJsonValue(value) {
  return value === undefined ? null : value
}

function mapPrismaTask(record) {
  return normalizeTask({
    id: record.id,
    workflowSlug: record.workflowSlug,
    status: record.status,
    sourceFileName: record.sourceFileName,
    sourceObjectKey: record.sourceObjectKey,
    validation: record.validation,
    summary: record.summary,
    failure: record.failure,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    events: record.events ?? [],
    uploads: record.uploads.map((upload) => ({
      id: upload.id,
      fileName: upload.fileName,
      objectKey: upload.objectKey,
      sizeBytes: upload.sizeBytes,
      createdAt: upload.createdAt.toISOString(),
    })),
    attempts: record.attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      createdAt: attempt.createdAt.toISOString(),
      startedAt: attempt.startedAt?.toISOString() ?? null,
      finishedAt: attempt.finishedAt?.toISOString() ?? null,
      summary: attempt.summary,
      failure: attempt.failure,
      aiCalls: attempt.aiCalls ?? [],
      events: attempt.events ?? [],
    })),
    artifacts: record.artifacts.map((artifact) => ({
      id: artifact.id,
      attemptId: artifact.attemptId,
      fileName: artifact.fileName,
      objectKey: artifact.objectKey,
      version: artifact.version,
      sizeBytes: artifact.sizeBytes,
      createdAt: artifact.createdAt.toISOString(),
    })),
  })
}

async function readPrismaTask(taskId) {
  const prisma = await getPrismaClient()
  const task = await prisma.translationTask.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      uploads: true,
      attempts: true,
      artifacts: true,
    },
  })

  return mapPrismaTask(task)
}

class PrismaRuntimeRepository {
  async createTask({ fileName, sourceObjectKey, sizeBytes, validation }) {
    const prisma = await getPrismaClient()
    const now = new Date()
    const task = await prisma.translationTask.create({
      data: {
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
        events: [
          createEvent('task_created', { fileName }),
          createEvent('validation_passed', { sourceRows: validation.sourceRows }),
        ],
        uploads: {
          create: {
            id: randomUUID(),
            fileName,
            objectKey: sourceObjectKey,
            sizeBytes,
            createdAt: now,
          },
        },
      },
      include: {
        uploads: true,
        attempts: true,
        artifacts: true,
      },
    })

    return mapPrismaTask(task)
  }

  async readTask(taskId) {
    return readPrismaTask(taskId)
  }

  async createAttempt(taskId) {
    const prisma = await getPrismaClient()
    const task = await this.readTask(taskId)
    const now = new Date()
    await prisma.$transaction([
      prisma.translationTask.update({
        where: { id: taskId },
        data: {
          status: TASK_STATUS.QUEUED,
          failure: null,
          updatedAt: now,
        },
      }),
      prisma.translationTaskAttempt.create({
        data: {
          id: randomUUID(),
          taskId,
          status: ATTEMPT_STATUS.QUEUED,
          createdAt: now,
          startedAt: null,
          finishedAt: null,
          summary: null,
          failure: null,
          aiCalls: [],
          events: [createEvent('attempt_queued')],
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async appendArtifact(taskId, artifact) {
    const prisma = await getPrismaClient()
    await prisma.translationArtifact.create({
      data: {
        id: artifact.id,
        taskId,
        attemptId: artifact.attemptId,
        fileName: artifact.fileName,
        objectKey: artifact.objectKey,
        version: artifact.version,
        sizeBytes: artifact.sizeBytes,
        createdAt: artifact.createdAt ? new Date(artifact.createdAt) : new Date(),
      },
    })
    return this.readTask(taskId)
  }

  async markAttemptProcessing(taskId, attemptId) {
    const prisma = await getPrismaClient()
    const task = await this.readTask(taskId)
    const attempt = task.attempts.find((item) => item.id === attemptId)
    if (!attempt) {
      throw new Error(`Attempt not found: ${attemptId}`)
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.translationTask.update({
        where: { id: taskId },
        data: {
          status: TASK_STATUS.PROCESSING,
          updatedAt: now,
        },
      }),
      prisma.translationTaskAttempt.update({
        where: { id: attemptId },
        data: {
          status: ATTEMPT_STATUS.PROCESSING,
          startedAt: now,
          events: [...(attempt.events ?? []), createEvent('attempt_started')],
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async markAttemptCompleted(taskId, attemptId, summary, aiCalls = [], events = []) {
    const prisma = await getPrismaClient()
    const task = await this.readTask(taskId)
    const attempt = task.attempts.find((item) => item.id === attemptId)
    if (!attempt) {
      throw new Error(`Attempt not found: ${attemptId}`)
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.translationTask.update({
        where: { id: taskId },
        data: {
          status: TASK_STATUS.COMPLETED,
          summary: toJsonValue(summary),
          failure: null,
          updatedAt: now,
        },
      }),
      prisma.translationTaskAttempt.update({
        where: { id: attemptId },
        data: {
          status: ATTEMPT_STATUS.COMPLETED,
          finishedAt: now,
          summary: toJsonValue(summary),
          failure: null,
          aiCalls,
          events: [...(attempt.events ?? []), ...events, createEvent('attempt_completed')],
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async markAttemptFailed(taskId, attemptId, failure, aiCalls = [], events = []) {
    const prisma = await getPrismaClient()
    const task = await this.readTask(taskId)
    const attempt = task.attempts.find((item) => item.id === attemptId)
    if (!attempt) {
      throw new Error(`Attempt not found: ${attemptId}`)
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.translationTask.update({
        where: { id: taskId },
        data: {
          status: TASK_STATUS.FAILED,
          failure,
          updatedAt: now,
        },
      }),
      prisma.translationTaskAttempt.update({
        where: { id: attemptId },
        data: {
          status: ATTEMPT_STATUS.FAILED,
          finishedAt: now,
          failure,
          aiCalls,
          events: [...(attempt.events ?? []), ...events, createEvent('attempt_failed', { category: failure.category })],
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async reset() {
    const prisma = await getPrismaClient()
    await prisma.translationArtifact.deleteMany()
    await prisma.translationUpload.deleteMany()
    await prisma.translationTaskAttempt.deleteMany()
    await prisma.translationTask.deleteMany()
  }

  async deleteTask(taskId) {
    const prisma = await getPrismaClient()
    // 按依赖顺序删除 child 行,避免外键约束(schema 未声明 onDelete: Cascade)
    await prisma.translationArtifact.deleteMany({ where: { taskId } })
    await prisma.translationUpload.deleteMany({ where: { taskId } })
    await prisma.translationTaskAttempt.deleteMany({ where: { taskId } })
    await prisma.translationTask.deleteMany({ where: { id: taskId } })
  }
}

let cachedRepository = null
let cachedRepositoryKey = null

function resolveRepositoryMode() {
  return resolveTranslationRuntimeRepositoryMode()
}

export function getTranslationRuntimeRepository() {
  const mode = resolveRepositoryMode()
  if (cachedRepository && cachedRepositoryKey === mode) {
    return cachedRepository
  }

  if (mode === 'memory') {
    cachedRepository = new MemoryRuntimeRepository()
  } else if (mode === 'file') {
    cachedRepository = new FileRuntimeRepository()
  } else if (mode === 'prisma') {
    cachedRepository = new PrismaRuntimeRepository()
  } else {
    throw new Error(`不支持的翻译任务 runtime repository: ${mode}`)
  }

  cachedRepositoryKey = mode
  return cachedRepository
}

export async function resetTranslationRuntimeRepositoryForTests() {
  const repository = getTranslationRuntimeRepository()
  if (typeof repository.reset === 'function') {
    await repository.reset()
  }
  cachedRepository = null
  cachedRepositoryKey = null
}
