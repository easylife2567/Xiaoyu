import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { setTimeout as wait } from 'node:timers/promises'
import {
  ARTIFACT_ROOT,
  RUNTIME_ROOT,
} from '../lib/daily-report/config.js'
import {
  createDailyReportTask,
  getDailyReportTask,
  saveSectionEdit,
  startDraftAttempt,
  startExportAttempt,
  submitSelections,
} from '../lib/daily-report/service.js'
import { resetDailyReportRuntimeRepositoryForTests } from '../lib/daily-report/runtime-repository.js'
import { resetCandidatePoolProviderCacheForTests, resolveTodayIssueDate } from '../lib/daily-report/candidate-pool/index.js'
import { resetDailyReportStorageAdapterForTests } from '../lib/daily-report/storage-adapter.js'

const WORKFLOW_SLUG = 'international-daily-report'

before(() => {
  process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY = 'memory'
  process.env.XIAOYU_DAILY_REPORT_STORAGE_ADAPTER = 'local'
  process.env.XIAOYU_AI_PROVIDER = 'stub'
})

after(async () => {
  await rm(RUNTIME_ROOT, { recursive: true, force: true })
  delete process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY
  delete process.env.XIAOYU_DAILY_REPORT_STORAGE_ADAPTER
  delete process.env.XIAOYU_AI_PROVIDER
})

beforeEach(async () => {
  await resetDailyReportRuntimeRepositoryForTests()
  resetCandidatePoolProviderCacheForTests()
  resetDailyReportStorageAdapterForTests()
  await rm(ARTIFACT_ROOT, { recursive: true, force: true })
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
      publishedAt: '2026-06-11T00:00:00.000Z',
      summary: `摘要 ${i + 1}`,
    },
  }))
}

async function waitForStatus(taskId, targetStatuses, { timeout = 30000, interval = 200 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const task = await getDailyReportTask(taskId)
    if (targetStatuses.includes(task.status)) {
      return task
    }
    await wait(interval)
  }
  throw new Error(`Task did not reach status ${targetStatuses.join('/')} in ${timeout}ms`)
}

test('完整闭环：创建任务 → 选择 → 起草 → 编辑 → 导出 → 下载', async () => {
  // Stage 1: create task
  const today = resolveTodayIssueDate()
  const issueNumberStr = today.replace(/-/g, '')  // YYYYMMDD
  const issueNumberAsDay = Number(today.slice(-2))  // Use DD as issue number for predictable name
  const task = await createDailyReportTask({ workflowSlug: WORKFLOW_SLUG, issueDate: today, issueNumber: issueNumberAsDay })
  assert.equal(task.status, 'drafting_pending')

  // Stage 2: submit selections
  await submitSelections(task.id, buildSelections(6))

  // Stage 3: trigger draft (queueMicrotask runs in same tick)
  await startDraftAttempt(task.id)
  const drafted = await waitForStatus(task.id, ['drafting_ready_for_review', 'failed'], { timeout: 20000 })
  assert.equal(drafted.status, 'drafting_ready_for_review', `draft failed: ${JSON.stringify(drafted.failure)}`)
  assert.equal(drafted.draftVersions.length, 1)
  assert.equal(drafted.draftVersions[0].sections.length, 6)
  assert.equal(drafted.draftVersions[0].source, 'ai_generated')

  // Stage 4: edit one section
  const latestDraft = drafted.draftVersions.at(-1)
  const editedSections = latestDraft.sections.map((s) =>
    s.index === 1 ? { ...s, body: '已编辑：第一段。' } : s,
  )
  const editedTask = await saveSectionEdit(task.id, { sections: editedSections })
  assert.equal(editedTask.draftVersions.length, 2)
  assert.equal(editedTask.draftVersions[1].source, 'user_edited')
  assert.equal(editedTask.draftVersions[1].sections[0].body, '已编辑：第一段。')

  // Stage 5: export — note 'DD' as issueNumber will make name be 国际日报-YYYYMMDD-{padded DD}.docx
  // The naming check enforces \d{3}, so issue numbers like 12 → 012 should pass.
  await startExportAttempt(task.id)
  const exported = await waitForStatus(task.id, ['completed', 'failed'], { timeout: 30000 })
  assert.equal(exported.status, 'completed', `export failed: ${JSON.stringify(exported.failure)}`)
  assert.equal(exported.artifacts.length, 2)

  const docxArtifact = exported.artifacts.find((a) => a.kind === 'docx_report')
  const xlsxArtifact = exported.artifacts.find((a) => a.kind === 'resource_pool_xlsx')
  assert.ok(docxArtifact)
  assert.ok(xlsxArtifact)
  assert.match(docxArtifact.fileName, /^国际日报-\d{8}-\d{3}\.docx$/)
  assert.match(xlsxArtifact.fileName, /^resource-pool-\d{8}\.xlsx$/)
  assert.equal(docxArtifact.validationReport.passed, true)
})
