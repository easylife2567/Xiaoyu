import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import {
  getCandidatePool,
  resetCandidatePoolProviderCacheForTests,
  resolveTodayIssueDate,
} from '../lib/daily-report/candidate-pool/index.js'

let tempRoot

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'xiaoyu-daily-pool-'))
  process.env.XIAOYU_DAILY_REPORT_FIXTURE_ROOT = tempRoot
})

after(async () => {
  await rm(tempRoot, { recursive: true, force: true })
  delete process.env.XIAOYU_DAILY_REPORT_FIXTURE_ROOT
})

beforeEach(() => {
  resetCandidatePoolProviderCacheForTests()
})

async function writeFixture(workflowSlug, issueDate, payload) {
  const dir = path.join(tempRoot, workflowSlug)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, `${issueDate}.json`), JSON.stringify(payload))
}

function buildCandidate(index) {
  return {
    id: `cand-${index}`,
    sourceType: 'fixture',
    title: `候选 ${index}`,
    sourceName: `源 ${index}`,
    sourceUrl: `https://example.com/${index}`,
    publishedAt: '2026-06-12T00:00:00.000Z',
    summary: `摘要 ${index}`,
    retrievalMetadata: { language: 'en', confidence: 0.9 },
  }
}

test('返回 fixture 中的候选池', async () => {
  const today = resolveTodayIssueDate()
  await writeFixture('international-daily-report', today, {
    workflowSlug: 'international-daily-report',
    issueDate: today,
    sourceType: 'fixture',
    candidates: [buildCandidate(1), buildCandidate(2)],
  })

  const pool = await getCandidatePool({ workflowSlug: 'international-daily-report', issueDate: today })

  assert.equal(pool.workflowSlug, 'international-daily-report')
  assert.equal(pool.issueDate, today)
  assert.equal(pool.sourceType, 'fixture')
  assert.equal(pool.candidates.length, 2)
  assert.equal(pool.candidates[0].sourceType, 'fixture')
})

test('非今天的 issueDate 被拒绝', async () => {
  await assert.rejects(
    () => getCandidatePool({ workflowSlug: 'international-daily-report', issueDate: '2099-01-01' }),
    (err) => err.code === 'unsupported_issue_date',
  )
})

test('fixture 缺失时返回 candidate_pool_fixture_missing', async () => {
  const today = resolveTodayIssueDate()
  await assert.rejects(
    () => getCandidatePool({ workflowSlug: 'no-such-workflow', issueDate: today }),
    (err) => err.code === 'candidate_pool_fixture_missing',
  )
})

test('候选缺少 sourceType=fixture 时报错', async () => {
  const today = resolveTodayIssueDate()
  await writeFixture('international-daily-report', today, {
    workflowSlug: 'international-daily-report',
    issueDate: today,
    sourceType: 'fixture',
    candidates: [{ ...buildCandidate(1), sourceType: 'live' }],
  })

  await assert.rejects(
    () => getCandidatePool({ workflowSlug: 'international-daily-report', issueDate: today }),
    (err) => err.code === 'candidate_pool_invalid',
  )
})

test('fixture workflowSlug 与请求不一致时报错', async () => {
  const today = resolveTodayIssueDate()
  await writeFixture('international-daily-report', today, {
    workflowSlug: 'other-workflow',
    issueDate: today,
    sourceType: 'fixture',
    candidates: [buildCandidate(1)],
  })

  await assert.rejects(
    () => getCandidatePool({ workflowSlug: 'international-daily-report', issueDate: today }),
    (err) => err.code === 'candidate_pool_invalid',
  )
})
