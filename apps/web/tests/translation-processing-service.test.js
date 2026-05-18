import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
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

const execFileAsync = promisify(execFile)
const pythonBin = resolvePythonBinary()
const workerScript = path.resolve(process.cwd(), '../../services/worker/translation_processing/worker.py')
let tempDir

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'xiaoyu-translation-'))
})

after(async () => {
  await rm(tempDir, { recursive: true, force: true })
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

async function waitForTask(taskId) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
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
  const workbookPath = path.join(tempDir, 'process.xlsx')
  await createWorkbook(workbookPath)
  const buffer = await readFile(workbookPath)
  const task = await createTranslationTask({ fileName: 'process.xlsx', buffer })

  await startTranslationTask(task.id)
  const completed = await waitForTask(task.id)
  assert.equal(completed.status, 'completed')
  assert.equal(completed.summary.processedRows, 1)
  assert.equal(completed.artifacts.length, 1)
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
  const workbookPath = path.join(tempDir, 'ai-failure.xlsx')
  await createWorkbook(workbookPath)
  const buffer = await readFile(workbookPath)
  const task = await createTranslationTask({ fileName: 'ai-failure.xlsx', buffer })

  await startTranslationTask(task.id)
  const failed = await waitForTask(task.id)
  assert.equal(failed.status, 'failed')
  assert.match(failed.failure.message, /AI 摘要生成失败/)
})
