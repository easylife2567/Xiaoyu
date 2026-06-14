import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  DAILY_REPORT_ATTEMPT_STATUS,
  DAILY_REPORT_TASK_STATUS,
  createEmptyDailyReportSummary,
} from '../../../../packages/contracts/daily-report.js'
import { getPrismaClient } from '../prisma.js'
import { TASK_ROOT, resolveDailyReportRuntimeRepositoryMode } from './config.js'

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
  return [...items].sort(
    (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  )
}

function normalizeTask(task) {
  return {
    id: task.id,
    workflowSlug: task.workflowSlug,
    issueDate: task.issueDate,
    issueNumber: task.issueNumber,
    status: task.status,
    summary: task.summary ?? createEmptyDailyReportSummary(),
    failure: task.failure ?? null,
    events: task.events ?? [],
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    selections: sortByCreatedAt(task.selections ?? []),
    draftVersions: [...(task.draftVersions ?? [])].sort(
      (left, right) => left.version - right.version,
    ),
    attempts: sortByCreatedAt(task.attempts ?? []).map((a) => ({
      id: a.id,
      taskId: a.taskId,
      kind: a.kind,
      status: a.status,
      startedAt: a.startedAt ?? null,
      finishedAt: a.finishedAt ?? null,
      summary: a.summary ?? null,
      failure: a.failure ?? null,
      aiCalls: a.aiCalls ?? [],
      events: a.events ?? [],
      createdAt: a.createdAt,
    })),
    artifacts: [...(task.artifacts ?? [])].sort(
      (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    ),
  }
}

async function ensureTaskRoot() {
  await mkdir(TASK_ROOT, { recursive: true })
}

function taskPath(taskId) {
  return path.join(TASK_ROOT, `${taskId}.json`)
}

function toIsoString(value) {
  return typeof value === 'string' ? value : value?.toISOString?.() ?? null
}

// ── MemoryRuntimeRepository (primarily for tests) ──────────────────────────

class MemoryRuntimeRepository {
  #tasks = new Map()

  async createTask({ workflowSlug, issueDate, issueNumber }) {
    const now = new Date().toISOString()
    const task = normalizeTask({
      id: randomUUID(),
      workflowSlug,
      issueDate,
      issueNumber,
      status: DAILY_REPORT_TASK_STATUS.DRAFTING_PENDING,
      summary: createEmptyDailyReportSummary(),
      failure: null,
      createdAt: now,
      updatedAt: now,
      events: [createEvent('task_created', { workflowSlug, issueDate, issueNumber })],
      selections: [],
      draftVersions: [],
      attempts: [],
      artifacts: [],
    })
    this.#tasks.set(task.id, clone(task))
    return clone(task)
  }

  async readTask(taskId) {
    const task = this.#tasks.get(taskId)
    if (!task) {
      const error = new Error(`Task not found: ${taskId}`)
      error.code = 'task_not_found'
      throw error
    }
    return clone(task)
  }

  async deleteTask(taskId) {
    this.#tasks.delete(taskId)
  }

  async findExistingTask({ workflowSlug, issueDate }) {
    for (const task of this.#tasks.values()) {
      if (task.workflowSlug === workflowSlug && task.issueDate === issueDate) {
        return clone(task)
      }
    }
    return null
  }

  async submitSelections(taskId, selections) {
    if (!Array.isArray(selections) || selections.length < 1) {
      const error = new Error('selection 列表不能为空。')
      error.code = 'invalid_selections'
      throw error
    }

    return this.#mutateTask(taskId, (task) => {
      const now = new Date().toISOString()
      return {
        ...task,
        selections: selections.map((s, index) => ({
          id: s.id ?? randomUUID(),
          taskId,
          position: s.position ?? index + 1,
          candidateId: s.candidateId,
          candidateSnapshot: s.candidateSnapshot ?? {},
          createdAt: now,
        })),
        events: [...task.events, createEvent('selections_submitted', { count: selections.length })],
      }
    })
  }

  async createDraftAttempt(taskId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.DRAFTING_IN_PROGRESS,
      failure: null,
      events: [...task.events, createEvent('draft_queued')],
      attempts: [
        ...task.attempts,
        {
          id: randomUUID(),
          taskId,
          kind: 'draft',
          status: DAILY_REPORT_ATTEMPT_STATUS.QUEUED,
          createdAt: now,
          startedAt: null,
          finishedAt: null,
          summary: null,
          failure: null,
          aiCalls: [],
          events: [createEvent('draft_queued')],
        },
      ],
    }))
  }

  async markAttemptProcessing(taskId, attemptId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      attempts: task.attempts.map((a) =>
        a.id === attemptId
          ? { ...a, status: DAILY_REPORT_ATTEMPT_STATUS.PROCESSING, startedAt: now, events: [...a.events, createEvent('attempt_started')] }
          : a,
      ),
    }))
  }

  async appendDraftVersion(taskId, { attemptId, version, source, sections }) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.DRAFTING_READY_FOR_REVIEW,
      summary: { ...task.summary, draftGenerated: true, sectionCount: sections.length },
      events: [...task.events, createEvent('draft_completed', { version, sectionCount: sections.length })],
      draftVersions: [
        ...task.draftVersions,
        {
          id: randomUUID(),
          taskId,
          attemptId,
          version,
          source,
          sections,
          createdAt: now,
        },
      ],
    }))
  }

  async saveSectionEdit(taskId, { sections }) {
    const task = await this.readTask(taskId)
    const latestVersion = task.draftVersions.at(-1)
    const nextVersion = (latestVersion?.version ?? 0) + 1
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (t) => ({
      ...t,
      events: [...t.events, createEvent('draft_edited', { version: nextVersion })],
      draftVersions: [
        ...t.draftVersions,
        {
          id: randomUUID(),
          taskId,
          attemptId: latestVersion?.attemptId ?? null,
          version: nextVersion,
          source: 'user_edited',
          sections,
          createdAt: now,
        },
      ],
    }))
  }

  async createExportAttempt(taskId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.EXPORTING_IN_PROGRESS,
      events: [...task.events, createEvent('export_queued')],
      attempts: [
        ...task.attempts,
        {
          id: randomUUID(),
          taskId,
          kind: 'export',
          status: DAILY_REPORT_ATTEMPT_STATUS.QUEUED,
          createdAt: now,
          startedAt: null,
          finishedAt: null,
          summary: null,
          failure: null,
          aiCalls: [],
          events: [createEvent('export_queued')],
        },
      ],
    }))
  }

  async appendArtifact(taskId, artifact) {
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.COMPLETED,
      summary: { ...task.summary, exportCompleted: true },
      artifacts: [...task.artifacts, artifact],
      events: [...task.events, createEvent('artifact_created', { kind: artifact.kind })],
    }))
  }

  async markAttemptCompleted(taskId, attemptId, summary, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      attempts: task.attempts.map((a) =>
        a.id === attemptId
          ? {
              ...a,
              status: DAILY_REPORT_ATTEMPT_STATUS.COMPLETED,
              finishedAt: now,
              summary,
              failure: null,
              aiCalls,
              events: [...a.events, ...events, createEvent('attempt_completed')],
            }
          : a,
      ),
    }))
  }

  async markAttemptFailed(taskId, attemptId, failure, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.FAILED,
      failure,
      events: [...task.events, createEvent('attempt_failed', { category: failure?.category })],
      attempts: task.attempts.map((a) =>
        a.id === attemptId
          ? {
              ...a,
              status: DAILY_REPORT_ATTEMPT_STATUS.FAILED,
              finishedAt: now,
              failure,
              aiCalls,
              events: [...a.events, ...events, createEvent('attempt_failed', { category: failure?.category })],
            }
          : a,
      ),
    }))
  }

  async reset() {
    this.#tasks.clear()
  }

  async #mutateTask(taskId, updater) {
    const task = await this.readTask(taskId)
    const next = normalizeTask({
      ...updater(task),
      updatedAt: new Date().toISOString(),
    })
    this.#tasks.set(taskId, clone(next))
    return clone(next)
  }
}

// ── FileRuntimeRepository (for local dev without PostgreSQL) ───────────────

class FileRuntimeRepository {
  async createTask({ workflowSlug, issueDate, issueNumber }) {
    await ensureTaskRoot()
    const now = new Date().toISOString()
    const task = normalizeTask({
      id: randomUUID(),
      workflowSlug,
      issueDate,
      issueNumber,
      status: DAILY_REPORT_TASK_STATUS.DRAFTING_PENDING,
      summary: createEmptyDailyReportSummary(),
      failure: null,
      createdAt: now,
      updatedAt: now,
      events: [createEvent('task_created', { workflowSlug, issueDate, issueNumber })],
      selections: [],
      draftVersions: [],
      attempts: [],
      artifacts: [],
    })
    await this.#writeTask(task)
    return clone(task)
  }

  async readTask(taskId) {
    await ensureTaskRoot()
    const raw = await readFile(taskPath(taskId), 'utf8')
    return normalizeTask(JSON.parse(raw))
  }

  async deleteTask(taskId) {
    await rm(taskPath(taskId), { force: true })
  }

  async findExistingTask({ workflowSlug, issueDate }) {
    await ensureTaskRoot()
    const { readdir } = await import('node:fs/promises')
    let files
    try {
      files = await readdir(TASK_ROOT)
    } catch {
      return null
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const content = JSON.parse(await readFile(path.join(TASK_ROOT, file), 'utf8'))
      if (content.workflowSlug === workflowSlug && content.issueDate === issueDate) {
        return normalizeTask(content)
      }
    }
    return null
  }

  async submitSelections(taskId, selections) {
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      selections: selections.map((s, index) => ({
        id: s.id ?? randomUUID(),
        taskId,
        position: s.position ?? index + 1,
        candidateId: s.candidateId,
        candidateSnapshot: s.candidateSnapshot ?? {},
        createdAt: new Date().toISOString(),
      })),
    }))
  }

  async createDraftAttempt(taskId) {
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.DRAFTING_IN_PROGRESS,
      failures: null,
      attempts: [
        ...task.attempts,
        {
          id: randomUUID(),
          taskId,
          kind: 'draft',
          status: DAILY_REPORT_ATTEMPT_STATUS.QUEUED,
          createdAt: new Date().toISOString(),
          startedAt: null,
          finishedAt: null,
          summary: null,
          failure: null,
          aiCalls: [],
          events: [createEvent('draft_queued')],
        },
      ],
    }))
  }

  async markAttemptProcessing(taskId, attemptId) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      attempts: task.attempts.map((a) =>
        a.id === attemptId ? { ...a, status: DAILY_REPORT_ATTEMPT_STATUS.PROCESSING, startedAt: now } : a,
      ),
    }))
  }

  async appendDraftVersion(taskId, { attemptId, version, source, sections }) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.DRAFTING_READY_FOR_REVIEW,
      summary: { ...task.summary, draftGenerated: true, sectionCount: sections.length },
      draftVersions: [
        ...task.draftVersions,
        { id: randomUUID(), taskId, attemptId, version, source, sections, createdAt: now },
      ],
    }))
  }

  async saveSectionEdit(taskId, { sections }) {
    const task = await this.readTask(taskId)
    const latestVersion = task.draftVersions.at(-1)
    const nextVersion = (latestVersion?.version ?? 0) + 1
    return this.#mutateTask(taskId, (t) => ({
      ...t,
      draftVersions: [
        ...t.draftVersions,
        {
          id: randomUUID(),
          taskId,
          attemptId: latestVersion?.attemptId ?? null,
          version: nextVersion,
          source: 'user_edited',
          sections,
          createdAt: new Date().toISOString(),
        },
      ],
    }))
  }

  async createExportAttempt(taskId) {
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.EXPORTING_IN_PROGRESS,
      attempts: [
        ...task.attempts,
        {
          id: randomUUID(),
          taskId,
          kind: 'export',
          status: DAILY_REPORT_ATTEMPT_STATUS.QUEUED,
          createdAt: new Date().toISOString(),
          startedAt: null,
          finishedAt: null,
          summary: null,
          failure: null,
          aiCalls: [],
          events: [createEvent('export_queued')],
        },
      ],
    }))
  }

  async appendArtifact(taskId, artifact) {
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.COMPLETED,
      summary: { ...task.summary, exportCompleted: true },
      artifacts: [...task.artifacts, artifact],
    }))
  }

  async markAttemptCompleted(taskId, attemptId, summary, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      attempts: task.attempts.map((a) =>
        a.id === attemptId
          ? { ...a, status: DAILY_REPORT_ATTEMPT_STATUS.COMPLETED, finishedAt: now, summary, failure: null, aiCalls, events: [...a.events, ...events] }
          : a,
      ),
    }))
  }

  async markAttemptFailed(taskId, attemptId, failure, aiCalls = [], events = []) {
    const now = new Date().toISOString()
    return this.#mutateTask(taskId, (task) => ({
      ...task,
      status: DAILY_REPORT_TASK_STATUS.FAILED,
      failure,
      attempts: task.attempts.map((a) =>
        a.id === attemptId
          ? { ...a, status: DAILY_REPORT_ATTEMPT_STATUS.FAILED, finishedAt: now, failure, aiCalls, events: [...a.events, ...events] }
          : a,
      ),
    }))
  }

  async reset() {
    await ensureTaskRoot()
    await rm(TASK_ROOT, { recursive: true, force: true })
    await ensureTaskRoot()
  }

  async #writeTask(task) {
    await ensureTaskRoot()
    const next = { ...task, updatedAt: new Date().toISOString() }
    const target = taskPath(task.id)
    const temp = `${target}.${randomUUID()}.tmp`
    await writeFile(temp, JSON.stringify(next, null, 2))
    await rename(temp, target)
    return normalizeTask(next)
  }

  async #mutateTask(taskId, updater) {
    const current = await this.readTask(taskId)
    const next = updater(current)
    return this.#writeTask(next)
  }
}

// ── PrismaRuntimeRepository ────────────────────────────────────────────────

function toJsonValue(value) {
  return value === undefined ? null : value
}

async function readPrismaTask(taskId) {
  const prisma = await getPrismaClient()
  const task = await prisma.dailyReportTask.findUniqueOrThrow({
    where: { id: taskId },
    include: {
      selections: true,
      draftVersions: true,
      attempts: true,
      artifacts: true,
    },
  })
  return mapPrismaTask(task)
}

function mapPrismaTask(task) {
  return normalizeTask({
    id: task.id,
    workflowSlug: task.workflowSlug,
    issueDate: task.issueDate,
    issueNumber: task.issueNumber,
    status: task.status,
    summary: task.summary,
    failure: task.failure,
    events: task.events ?? [],
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    selections: task.selections.map((s) => ({
      id: s.id,
      taskId: s.taskId,
      position: s.position,
      candidateId: s.candidateId,
      candidateSnapshot: s.candidateSnapshot,
      createdAt: s.createdAt.toISOString(),
    })),
    draftVersions: task.draftVersions.map((d) => ({
      id: d.id,
      taskId: d.taskId,
      attemptId: d.attemptId,
      version: d.version,
      source: d.source,
      sections: d.sections,
      createdAt: d.createdAt.toISOString(),
    })),
    attempts: task.attempts.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      kind: a.kind,
      status: a.status,
      startedAt: a.startedAt?.toISOString() ?? null,
      finishedAt: a.finishedAt?.toISOString() ?? null,
      summary: a.summary,
      failure: a.failure,
      aiCalls: a.aiCalls ?? [],
      events: a.events ?? [],
      createdAt: a.createdAt.toISOString(),
    })),
    artifacts: task.artifacts.map((a) => ({
      id: a.id,
      taskId: a.taskId,
      draftVersionId: a.draftVersionId,
      attemptId: a.attemptId,
      kind: a.kind,
      fileName: a.fileName,
      objectKey: a.objectKey,
      sizeBytes: a.sizeBytes,
      validationReport: a.validationReport,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}

class PrismaRuntimeRepository {
  async createTask({ workflowSlug, issueDate, issueNumber }) {
    const prisma = await getPrismaClient()
    const now = new Date()
    const task = await prisma.dailyReportTask.create({
      data: {
        id: randomUUID(),
        workflowSlug,
        issueDate: new Date(issueDate),
        issueNumber,
        status: DAILY_REPORT_TASK_STATUS.DRAFTING_PENDING,
        summary: createEmptyDailyReportSummary(),
        failure: null,
        createdAt: now,
        updatedAt: now,
        events: [createEvent('task_created', { workflowSlug, issueDate, issueNumber })],
      },
      include: {
        selections: true,
        draftVersions: true,
        attempts: true,
        artifacts: true,
      },
    })
    return mapPrismaTask(task)
  }

  async readTask(taskId) {
    return readPrismaTask(taskId)
  }

  async deleteTask(taskId) {
    const prisma = await getPrismaClient()
    await prisma.dailyReportTask.delete({ where: { id: taskId } })
  }

  async findExistingTask({ workflowSlug, issueDate }) {
    const prisma = await getPrismaClient()
    const task = await prisma.dailyReportTask.findFirst({
      where: {
        workflowSlug,
        issueDate: new Date(issueDate),
        status: { not: DAILY_REPORT_TASK_STATUS.FAILED },
      },
      include: {
        selections: true,
        draftVersions: true,
        attempts: true,
        artifacts: true,
      },
    })
    return task ? mapPrismaTask(task) : null
  }

  async submitSelections(taskId, selections) {
    if (!Array.isArray(selections) || selections.length < 1) {
      const error = new Error('selection 列表不能为空。')
      error.code = 'invalid_selections'
      throw error
    }

    const prisma = await getPrismaClient()
    const now = new Date()
    await prisma.$transaction([
      prisma.dailyReportSelection.deleteMany({ where: { taskId } }),
      ...selections.map((s, index) =>
        prisma.dailyReportSelection.create({
          data: {
            id: s.id ?? randomUUID(),
            taskId,
            position: s.position ?? index + 1,
            candidateId: s.candidateId,
            candidateSnapshot: s.candidateSnapshot ?? {},
            createdAt: now,
          },
        }),
      ),
    ])
    return this.readTask(taskId)
  }

  async createDraftAttempt(taskId) {
    const prisma = await getPrismaClient()
    const task = await this.readTask(taskId)
    const now = new Date()
    await prisma.$transaction([
      prisma.dailyReportTask.update({
        where: { id: taskId },
        data: { status: DAILY_REPORT_TASK_STATUS.DRAFTING_IN_PROGRESS, failure: null, updatedAt: now },
      }),
      prisma.dailyReportTaskAttempt.create({
        data: {
          id: randomUUID(),
          taskId,
          kind: 'draft',
          status: DAILY_REPORT_ATTEMPT_STATUS.QUEUED,
          createdAt: now,
          startedAt: null,
          finishedAt: null,
          summary: null,
          failure: null,
          aiCalls: [],
          events: [createEvent('draft_queued')],
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async markAttemptProcessing(taskId, attemptId) {
    const prisma = await getPrismaClient()
    const now = new Date()
    await prisma.dailyReportTaskAttempt.update({
      where: { id: attemptId },
      data: { status: DAILY_REPORT_ATTEMPT_STATUS.PROCESSING, startedAt: now },
    })
    return this.readTask(taskId)
  }

  async appendDraftVersion(taskId, { attemptId, version, source, sections }) {
    const prisma = await getPrismaClient()
    const now = new Date()
    await prisma.$transaction([
      prisma.dailyReportTask.update({
        where: { id: taskId },
        data: {
          status: DAILY_REPORT_TASK_STATUS.DRAFTING_READY_FOR_REVIEW,
          summary: { draftGenerated: true, exportCompleted: false, sectionCount: sections.length, selectionCount: 0 },
          updatedAt: now,
        },
      }),
      prisma.dailyReportDraftVersion.create({
        data: {
          id: randomUUID(),
          taskId,
          attemptId,
          version,
          source,
          sections,
          createdAt: now,
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async saveSectionEdit(taskId, { sections }) {
    const task = await this.readTask(taskId)
    const latestVersion = task.draftVersions.at(-1)
    const nextVersion = (latestVersion?.version ?? 0) + 1
    const prisma = await getPrismaClient()
    const now = new Date()
    await prisma.dailyReportDraftVersion.create({
      data: {
        id: randomUUID(),
        taskId,
        attemptId: latestVersion?.attemptId ?? null,
        version: nextVersion,
        source: 'user_edited',
        sections,
        createdAt: now,
      },
    })
    return this.readTask(taskId)
  }

  async createExportAttempt(taskId) {
    const prisma = await getPrismaClient()
    const now = new Date()
    await prisma.$transaction([
      prisma.dailyReportTask.update({
        where: { id: taskId },
        data: { status: DAILY_REPORT_TASK_STATUS.EXPORTING_IN_PROGRESS, updatedAt: now },
      }),
      prisma.dailyReportTaskAttempt.create({
        data: {
          id: randomUUID(),
          taskId,
          kind: 'export',
          status: DAILY_REPORT_ATTEMPT_STATUS.QUEUED,
          createdAt: now,
          startedAt: null,
          finishedAt: null,
          summary: null,
          failure: null,
          aiCalls: [],
          events: [createEvent('export_queued')],
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async appendArtifact(taskId, artifact) {
    const prisma = await getPrismaClient()
    const now = new Date()
    await prisma.$transaction([
      prisma.dailyReportTask.update({
        where: { id: taskId },
        data: { status: DAILY_REPORT_TASK_STATUS.COMPLETED, summary: { draftGenerated: true, exportCompleted: true, sectionCount: 0, selectionCount: 0 }, updatedAt: now },
      }),
      prisma.dailyReportArtifact.create({
        data: {
          id: artifact.id ?? randomUUID(),
          taskId,
          draftVersionId: artifact.draftVersionId,
          attemptId: artifact.attemptId,
          kind: artifact.kind,
          fileName: artifact.fileName,
          objectKey: artifact.objectKey,
          sizeBytes: artifact.sizeBytes,
          validationReport: artifact.validationReport ?? { passed: true, checks: [] },
          createdAt: now,
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async markAttemptCompleted(taskId, attemptId, summary, aiCalls = [], events = []) {
    const prisma = await getPrismaClient()
    const now = new Date()
    await prisma.dailyReportTaskAttempt.update({
      where: { id: attemptId },
      data: {
        status: DAILY_REPORT_ATTEMPT_STATUS.COMPLETED,
        finishedAt: now,
        summary: toJsonValue(summary),
        failure: null,
        aiCalls,
        events: [...events, createEvent('attempt_completed')],
      },
    })
    return this.readTask(taskId)
  }

  async markAttemptFailed(taskId, attemptId, failure, aiCalls = [], events = []) {
    const prisma = await getPrismaClient()
    const task = await this.readTask(taskId)
    const attempt = task.attempts.find((a) => a.id === attemptId)
    const now = new Date()
    await prisma.$transaction([
      prisma.dailyReportTask.update({
        where: { id: taskId },
        data: { status: DAILY_REPORT_TASK_STATUS.FAILED, failure, updatedAt: now },
      }),
      prisma.dailyReportTaskAttempt.update({
        where: { id: attemptId },
        data: {
          status: DAILY_REPORT_ATTEMPT_STATUS.FAILED,
          finishedAt: now,
          failure,
          aiCalls: aiCalls ?? [],
          events: [...(attempt?.events ?? []), ...events, createEvent('attempt_failed')],
        },
      }),
    ])
    return this.readTask(taskId)
  }

  async reset() {
    const prisma = await getPrismaClient()
    await prisma.dailyReportArtifact.deleteMany()
    await prisma.dailyReportDraftVersion.deleteMany()
    await prisma.dailyReportSelection.deleteMany()
    await prisma.dailyReportTaskAttempt.deleteMany()
    await prisma.dailyReportTask.deleteMany()
  }
}

// ── Repository selector ────────────────────────────────────────────────────

let cachedRepository = null
let cachedRepositoryKey = null

function resolveRepositoryMode() {
  return resolveDailyReportRuntimeRepositoryMode()
}

export function getDailyReportRuntimeRepository() {
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
    throw new Error(`不支持的日报任务 runtime repository: ${mode}`)
  }

  cachedRepositoryKey = mode
  return cachedRepository
}

export async function resetDailyReportRuntimeRepositoryForTests() {
  const repo = getDailyReportRuntimeRepository()
  if (typeof repo.reset === 'function') {
    await repo.reset()
  }
  cachedRepository = null
  cachedRepositoryKey = null
}