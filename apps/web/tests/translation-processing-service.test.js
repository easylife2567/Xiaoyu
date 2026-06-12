import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { ARTIFACT_ROOT } from '../lib/translation-processing/config.js'
import { resolvePythonBinary } from '../lib/translation-processing/config.js'
import {
  createTranslationTask,
  getTranslationTask,
  retryTranslationTask,
  startTranslationTask,
} from '../lib/translation-processing/service.js'
import { removeTaskProgress, resetTaskStoreForTests, writeTaskProgress } from '../lib/translation-processing/store.js'

const execFileAsync = promisify(execFile)
const pythonBin = resolvePythonBinary()
const workerScript = path.resolve(process.cwd(), '../../services/worker/translation_processing/worker.py')
let tempDir

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'xiaoyu-translation-'))
  process.env.XIAOYU_TRANSLATION_RUNTIME_REPOSITORY = 'memory'
  process.env.XIAOYU_TRANSLATION_STORAGE_ADAPTER = 'local'
})

after(async () => {
  await rm(tempDir, { recursive: true, force: true })
  delete process.env.XIAOYU_TRANSLATION_RUNTIME_REPOSITORY
  delete process.env.XIAOYU_TRANSLATION_STORAGE_ADAPTER
})

beforeEach(async () => {
  await resetTaskStoreForTests()
})

async function createWorkbook(filePath, headers = ['序号', '平台', '发表内容', '研究内容', '分类']) {
  const code = `
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.title = "DFY官方"
ws.append(${JSON.stringify(headers)})
ws.append([1, "X", "Taiwan issue mentioned in a post", None, None])
wb.save(${JSON.stringify(filePath)})
`
  await execFileAsync(pythonBin, ['-c', code])
}

async function createMixedWorkbook(filePath) {
  const code = `
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.title = "DFY官方"
ws.append(["序号", "平台", "发表内容", "研究内容", "分类"])
ws.append([1, "X", "12月22日，上海，一名女子在地铁上高喊“打倒司法，打倒共产党”。", None, None])
ws.append([2, "X", "Taiwan issue mentioned in a post", None, None])
wb.save(${JSON.stringify(filePath)})
`
  await execFileAsync(pythonBin, ['-c', code])
}

async function waitForTask(taskId) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const task = await getTranslationTask(taskId)
    if (['completed', 'failed'].includes(task.status)) {
      return task
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error('task did not finish')
}

test('creates a ready task after a valid workbook upload', async () => {
  const workbookPath = path.join(tempDir, 'valid.xlsx')
  await createWorkbook(workbookPath)
  const buffer = await readFile(workbookPath)

  const task = await createTranslationTask({
    fileName: 'valid.xlsx',
    buffer,
  })

  assert.equal(task.status, 'ready')
  assert.equal(task.validation.ok, true)
  assert.equal(task.uploads.length, 1)
  assert.deepEqual(
    task.events.map((event) => event.type),
    ['task_created', 'validation_passed'],
  )

  const storedTask = await getTranslationTask(task.id)
  assert.equal(storedTask.id, task.id)
})

test('rejects a workbook missing required translation-processing headers', async () => {
  const workbookPath = path.join(tempDir, 'invalid.xlsx')
  await createWorkbook(workbookPath, ['序号', '平台', '发表内容'])
  const buffer = await readFile(workbookPath)

  await assert.rejects(
    () =>
      createTranslationTask({
        fileName: 'invalid.xlsx',
        buffer,
      }),
    /缺少可处理的工作表/,
  )
})

test('processes a workbook and preserves artifact versions across retries', async () => {
  process.env.XIAOYU_AI_PROVIDER = 'stub'
  process.env.XIAOYU_AI_RETRY_BASE_MS = '1'
  const workbookPath = path.join(tempDir, 'process.xlsx')
  await createWorkbook(workbookPath)
  const buffer = await readFile(workbookPath)
  const task = await createTranslationTask({ fileName: 'process.xlsx', buffer })

  await startTranslationTask(task.id)
  const completed = await waitForTask(task.id)
  assert.equal(completed.status, 'completed')
  assert.equal(completed.summary.processedRows, 1)
  assert.equal(completed.artifacts.length, 1)
  assert.equal(completed.attempts[0].aiCalls.length, 1)
  assert.equal(completed.attempts[0].aiCalls[0].sheet, 'DFY官方')
  assert.equal(completed.attempts[0].aiCalls[0].row, 2)
  assert.equal(completed.attempts[0].aiCalls[0].provider, 'stub')
  assert.equal(completed.attempts[0].aiCalls[0].status, 'succeeded')
  assert.equal(completed.attempts[0].aiCalls[0].retryCount, 0)
  assert.deepEqual(
    completed.attempts[0].events.map((event) => event.type),
    ['attempt_queued', 'attempt_started', 'sheet_started', 'ai_call_succeeded', 'attempt_completed'],
  )
  const artifactPath = path.join(ARTIFACT_ROOT, completed.artifacts[0].objectKey)
  const { stdout } = await execFileAsync(pythonBin, [
    '-c',
    `
from openpyxl import load_workbook
wb = load_workbook(${JSON.stringify(artifactPath)}, read_only=True)
ws = wb["DFY官方"]
print(ws.cell(2, 4).value)
print(ws.cell(2, 5).value)
`,
  ])
  assert.match(stdout, /内容涉及台湾议题/)
  assert.match(stdout, /台湾问题/)

  await retryTranslationTask(task.id)
  const retried = await waitForTask(task.id)
  assert.equal(retried.status, 'completed')
  assert.equal(retried.artifacts.length, 2)
  assert.deepEqual(
    retried.artifacts.map((artifact) => artifact.version),
    [1, 2],
  )
})

test('surfaces recoverable AI failures on the task', async () => {
  process.env.XIAOYU_AI_PROVIDER = 'fail'
  process.env.XIAOYU_AI_RETRY_BASE_MS = '1'
  const workbookPath = path.join(tempDir, 'ai-failure.xlsx')
  await createWorkbook(workbookPath)
  const buffer = await readFile(workbookPath)
  const task = await createTranslationTask({ fileName: 'ai-failure.xlsx', buffer })

  await startTranslationTask(task.id)
  const failed = await waitForTask(task.id)
  assert.equal(failed.status, 'failed')
  assert.match(failed.failure.message, /AI 摘要生成失败/)
  assert.deepEqual(failed.attempts[0].events.map((event) => event.type), [
    'attempt_queued',
    'attempt_started',
    'sheet_started',
    'ai_call_failed',
    'attempt_failed',
  ])
  assert.equal(failed.failure.category, 'provider_error')
})

test('merges live progress snapshots into task reads while processing', async () => {
  process.env.XIAOYU_AI_PROVIDER = 'stub'
  process.env.XIAOYU_TRANSLATION_DISABLE_BACKGROUND_QUEUE = '1'
  const workbookPath = path.join(tempDir, 'progress.xlsx')
  try {
    await createWorkbook(workbookPath)
    const buffer = await readFile(workbookPath)
    const task = await createTranslationTask({ fileName: 'progress.xlsx', buffer })
    const queued = await startTranslationTask(task.id)
    const attemptId = queued.attempts.at(-1).id

    await writeTaskProgress(task.id, attemptId, {
      taskId: task.id,
      attemptId,
      status: 'processing',
      totalRows: 12,
      completedRows: 5,
      totalBatches: 3,
      completedBatches: 1,
      currentSheet: 'DFY官方',
      currentActivity: '正在处理 DFY官方 第 22-41 行批次',
      activeBatches: [{ batchIndex: 2, startRow: 22, endRow: 41, sheet: 'DFY官方' }],
      events: [{ type: 'ai_batch_started', createdAt: new Date().toISOString(), detail: { sheet: 'DFY官方', startRow: 22, endRow: 41 } }],
      updatedAt: new Date().toISOString(),
    })

    const withProgress = await getTranslationTask(task.id)
    assert.equal(withProgress.progress.completedRows, 5)
    assert.equal(withProgress.progress.totalRows, 12)
    assert.equal(withProgress.progress.activeBatches.length, 1)

    await removeTaskProgress(task.id, attemptId)
  } finally {
    delete process.env.XIAOYU_TRANSLATION_DISABLE_BACKGROUND_QUEUE
  }
})

test('completes mixed workbooks while marking sensitive rows for review', async () => {
  process.env.XIAOYU_AI_PROVIDER = 'stub'
  process.env.XIAOYU_AI_RETRY_BASE_MS = '1'
  const workbookPath = path.join(tempDir, 'mixed-sensitive.xlsx')
  await createMixedWorkbook(workbookPath)
  const buffer = await readFile(workbookPath)
  const task = await createTranslationTask({ fileName: 'mixed-sensitive.xlsx', buffer })

  await startTranslationTask(task.id)
  const completed = await waitForTask(task.id)
  assert.equal(completed.status, 'completed')
  assert.equal(completed.summary.processedRows, 2)
  assert.equal(completed.summary.issueCount, 1)
  assert.equal(completed.summary.issues[0].code, 'sensitive_content_fallback')
  assert.deepEqual(
    completed.attempts[0].events.map((event) => event.type),
    ['attempt_queued', 'attempt_started', 'sheet_started', 'sensitive_content_downgraded', 'ai_call_succeeded', 'attempt_completed'],
  )

  const artifactPath = path.join(ARTIFACT_ROOT, completed.artifacts[0].objectKey)
  const { stdout } = await execFileAsync(pythonBin, [
    '-c',
    `
from openpyxl import load_workbook
wb = load_workbook(${JSON.stringify(artifactPath)}, read_only=True)
ws = wb["DFY官方"]
print(ws.cell(2, 4).value)
print(ws.cell(2, 5).value)
print(ws.cell(3, 4).value)
`,
  ])
  assert.match(stdout, /该条内容涉及敏感公共舆情，建议人工复核/)
  assert.match(stdout, /社会问题/)
  assert.match(stdout, /内容涉及台湾议题/)
})
