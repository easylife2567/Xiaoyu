import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { POST as uploadTask } from '../app/api/translation-processing/tasks/route.js'
import { GET as readTaskRoute } from '../app/api/translation-processing/tasks/[taskId]/route.js'
import { POST as startTask } from '../app/api/translation-processing/tasks/[taskId]/start/route.js'
import { GET as downloadTask } from '../app/api/translation-processing/tasks/[taskId]/download/route.js'
import { getTranslationTask } from '../lib/translation-processing/service.js'
import { resolvePythonBinary } from '../lib/translation-processing/config.js'
import { resetTaskStoreForTests } from '../lib/translation-processing/store.js'

const execFileAsync = promisify(execFile)
const pythonBin = resolvePythonBinary()
let tempDir

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'xiaoyu-route-'))
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

async function createWorkbook(filePath) {
  const code = `
from openpyxl import Workbook
wb = Workbook()
ws = wb.active
ws.title = "DFY官方"
ws.append(["序号", "平台", "发表内容", "研究内容", "分类"])
ws.append([1, "X", "The second ever robot marathon took place in Beijing", None, None])
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

test('happy path runs from upload through result download', async () => {
  process.env.XIAOYU_AI_PROVIDER = 'stub'
  const workbookPath = path.join(tempDir, 'route.xlsx')
  await createWorkbook(workbookPath)
  const formData = new FormData()
  formData.set('file', new File([await readFile(workbookPath)], 'route.xlsx'))

  const uploadResponse = await uploadTask(new Request('http://localhost/api/translation-processing/tasks', {
    method: 'POST',
    body: formData,
  }))
  assert.equal(uploadResponse.status, 201)
  const { task } = await uploadResponse.json()

  const startResponse = await startTask(new Request('http://localhost'), {
    params: Promise.resolve({ taskId: task.id }),
  })
  assert.equal(startResponse.status, 202)

  const completed = await waitForTask(task.id)
  assert.equal(completed.status, 'completed')

  const taskResponse = await readTaskRoute(new Request('http://localhost'), {
    params: Promise.resolve({ taskId: task.id }),
  })
  assert.equal(taskResponse.status, 200)
  const taskPayload = await taskResponse.json()
  assert.equal(taskPayload.diagnostics.status, 'healthy')

  const downloadResponse = await downloadTask(new Request('http://localhost'), {
    params: Promise.resolve({ taskId: task.id }),
  })
  assert.equal(downloadResponse.status, 200)
  assert.match(downloadResponse.headers.get('content-disposition'), /attachment/)
})
