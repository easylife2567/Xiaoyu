import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { resetDailyReportRuntimeRepositoryForTests } from '../lib/daily-report/runtime-repository.js'
import { resetCandidatePoolProviderCacheForTests, resolveTodayIssueDate } from '../lib/daily-report/candidate-pool/index.js'
import {
  createDailyReportTask,
  getDailyReportTask,
  submitSelections,
  startDraftAttempt,
  saveSectionEdit,
  startExportAttempt,
} from '../lib/daily-report/service.js'

let tempRoot

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'xiaoyu-daily-route-'))
  process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY = 'memory'
  process.env.XIAOYU_DAILY_REPORT_STORAGE_ADAPTER = 'local'
  process.env.XIAOYU_AI_PROVIDER = 'stub'
  process.env.XIAOYU_DAILY_REPORT_FIXTURE_ROOT = tempRoot
})

after(async () => {
  await rm(tempRoot, { recursive: true, force: true })
  delete process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY
  delete process.env.XIAOYU_DAILY_REPORT_STORAGE_ADAPTER
  delete process.env.XIAOYU_AI_PROVIDER
  delete process.env.XIAOYU_DAILY_REPORT_FIXTURE_ROOT
})

beforeEach(async () => {
  await resetDailyReportRuntimeRepositoryForTests()
  resetCandidatePoolProviderCacheForTests()
})

function buildSelections(count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    candidateId: `cand-${i + 1}`,
    position: i + 1,
    candidateSnapshot: {
      id: `cand-${i + 1}`,
      title: `候选 ${i + 1}`,
      sourceName: `源 ${i + 1}`,
      sourceUrl: `https://example.com/${i + 1}`,
      publishedAt: '2026-06-12T00:00:00.000Z',
      summary: `摘要 ${i + 1}`,
    },
  }))
}

test('POST /api/daily-report/candidate-pools/[...]: 非今天返回 400', async () => {
  const { GET } = await import('../app/api/daily-report/candidate-pools/[workflowSlug]/[issueDate]/route.js')
  const req = new Request('http://localhost/api/daily-report/candidate-pools/international-daily-report/2099-01-01')
  const res = await GET(req, { params: Promise.resolve({ workflowSlug: 'international-daily-report', issueDate: '2099-01-01' }) })
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.code, 'unsupported_issue_date')
})

test('POST /api/daily-report/tasks 创建任务', async () => {
  const { POST } = await import('../app/api/daily-report/tasks/route.js')
  const today = resolveTodayIssueDate()
  const req = new Request('http://localhost/api/daily-report/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowSlug: 'international-daily-report', issueDate: today, issueNumber: 1 }),
  })
  const res = await POST(req)
  assert.equal(res.status, 201)
  const body = await res.json()
  assert.ok(body.task.id)
  assert.equal(body.task.status, 'drafting_pending')
})

test('POST /api/daily-report/tasks 重复任务返回 409', async () => {
  const { POST } = await import('../app/api/daily-report/tasks/route.js')
  const today = resolveTodayIssueDate()
  const body = JSON.stringify({ workflowSlug: 'international-daily-report', issueDate: today, issueNumber: 1 })

  await POST(new Request('http://localhost/api/daily-report/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))
  const res = await POST(new Request('http://localhost/api/daily-report/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }))

  assert.equal(res.status, 409)
})

test('DELETE /api/daily-report/tasks/[taskId] 重置任务', async () => {
  const { POST: createTask } = await import('../app/api/daily-report/tasks/route.js')
  const { DELETE: deleteTask, GET: readTask } = await import('../app/api/daily-report/tasks/[taskId]/route.js')
  const today = resolveTodayIssueDate()
  const taskRes = await createTask(new Request('http://localhost/api/daily-report/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowSlug: 'international-daily-report', issueDate: today, issueNumber: 1 }),
  }))
  const { task } = await taskRes.json()

  const deleteRes = await deleteTask(new Request('http://localhost/api/daily-report/tasks/task', { method: 'DELETE' }), {
    params: Promise.resolve({ taskId: task.id }),
  })
  assert.equal(deleteRes.status, 200)

  const readRes = await readTask(new Request('http://localhost/api/daily-report/tasks/task'), {
    params: Promise.resolve({ taskId: task.id }),
  })
  assert.equal(readRes.status, 404)
})

test('POST /api/daily-report/tasks/[taskId]/selections 提交选择', async () => {
  const { POST: createTask } = await import('../app/api/daily-report/tasks/route.js')
  const today = resolveTodayIssueDate()
  const taskRes = await createTask(new Request('http://localhost/api/daily-report/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflowSlug: 'international-daily-report', issueDate: today, issueNumber: 1 }),
  }))
  const { task } = await taskRes.json()

  const { POST: submitSelections } = await import('../app/api/daily-report/tasks/[taskId]/selections/route.js')
  const selections = buildSelections(6)
  const res = await submitSelections(
    new Request('http://localhost/api/daily-report/tasks/task/selections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selections }),
    }),
    { params: Promise.resolve({ taskId: task.id }) },
  )

  assert.equal(res.status, 200)
  const updated = await res.json()
  assert.equal(updated.task.selections.length, 6)
})
