import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import {
  createDailyReportTask,
  getDailyReportTask,
  resetDailyReportTask,
  saveSectionEdit,
  startDraftAttempt,
  startExportAttempt,
  submitSelections,
} from '../lib/daily-report/service.js'
import { resetDailyReportRuntimeRepositoryForTests } from '../lib/daily-report/runtime-repository.js'
import { resetCandidatePoolProviderCacheForTests, resolveTodayIssueDate } from '../lib/daily-report/candidate-pool/index.js'
import { DAILY_REPORT_TASK_STATUS } from '../../../packages/contracts/daily-report.js'

const WORKFLOW_SLUG = 'international-daily-report'
const ISSUE_NUMBER = 1

before(() => {
  process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY = 'memory'
  process.env.XIAOYU_DAILY_REPORT_DISABLE_BACKGROUND_QUEUE = '1'
})

after(() => {
  delete process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY
  delete process.env.XIAOYU_DAILY_REPORT_DISABLE_BACKGROUND_QUEUE
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
      title: `候选 ${i + 1}`,
      sourceName: `源 ${i + 1}`,
      sourceUrl: `https://example.com/${i + 1}`,
      publishedAt: '2026-06-12T00:00:00.000Z',
      summary: `摘要 ${i + 1}`,
    },
  }))
}

test('创建日报任务', async () => {
  const today = resolveTodayIssueDate()
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })

  assert.equal(task.workflowSlug, WORKFLOW_SLUG)
  assert.equal(task.issueDate, today)
  assert.equal(task.issueNumber, ISSUE_NUMBER)
  assert.equal(task.status, DAILY_REPORT_TASK_STATUS.DRAFTING_PENDING)
  assert.ok(task.id)
})

test('同天同工作台不可重复创建', async () => {
  const today = resolveTodayIssueDate()
  await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })

  await assert.rejects(
    () => createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER + 1 }),
    (err) => err.code === 'task_already_exists',
  )
})

test('非今天日期被拒绝', async () => {
  await assert.rejects(
    () => createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: '2099-01-01', issueNumber: 1 }),
    (err) => err.code === 'unsupported_issue_date',
  )
})

test('提交 6 条选择', async () => {
  const today = resolveTodayIssueDate()
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })
  const selections = buildSelections(6)
  const updated = await submitSelections(task.id, selections)

  assert.equal(updated.selections.length, 6)
  assert.equal(updated.selections[0].position, 1)
  assert.equal(updated.selections[5].candidateId, 'cand-6')
})

test('选择数量不对被拒绝', async () => {
  const today = resolveTodayIssueDate()
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })

  await assert.rejects(
    () => submitSelections(task.id, buildSelections(3)),
    (err) => err.code === 'invalid_selection_count',
  )
})

test('未选候选不可起草', async () => {
  const today = resolveTodayIssueDate()
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })

  await assert.rejects(
    () => startDraftAttempt(task.id),
    (err) => err.code === 'selections_not_submitted',
  )
})

test('选择替换是原子的', async () => {
  const today = resolveTodayIssueDate()
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })

  await submitSelections(task.id, buildSelections(6))
  const newSelections = buildSelections(6).map((s, i) => ({
    ...s,
    candidateId: `new-cand-${i + 1}`,
  }))

  const updated = await submitSelections(task.id, newSelections)
  assert.equal(updated.selections.length, 6)
  assert.equal(updated.selections[0].candidateId, 'new-cand-1')
  assert.ok(!updated.selections.some((s) => s.candidateId.startsWith('cand-')))
})

test('未到正确状态不可导出', async () => {
  const today = resolveTodayIssueDate()
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })

  await assert.rejects(
    () => startExportAttempt(task.id),
    (err) => err.code === 'invalid_task_state',
  )
})

test('读取不存在的任务抛错', async () => {
  await assert.rejects(
    () => getDailyReportTask('nonexistent'),
    (err) => err.code === 'task_not_found',
  )
})

test('重置任务后同日可以重新创建', async () => {
  const today = resolveTodayIssueDate()
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER })

  await resetDailyReportTask(task.id)

  await assert.rejects(
    () => getDailyReportTask(task.id),
    (err) => err.code === 'task_not_found',
  )

  const recreated = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: ISSUE_NUMBER + 1 })
  assert.ok(recreated.id)
  assert.notEqual(recreated.id, task.id)
})
