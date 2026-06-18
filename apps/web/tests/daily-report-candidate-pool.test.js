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
  delete process.env.XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK
  delete process.env.XIAOYU_DAILY_REPORT_FIXTURE_STALE_WINDOW_DAYS
})

async function writeFixture(workflowSlug, issueDate, payload) {
  const dir = path.join(tempRoot, workflowSlug)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, `${issueDate}.json`), JSON.stringify(payload))
}

function shiftIssueDate(issueDate, days) {
  const [y, m, d] = issueDate.split('-').map((s) => Number.parseInt(s, 10))
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
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

test('候选 sourceType 不在白名单(fixture / rss)时报错', async () => {
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

test('候选 sourceType=rss(采集器写出)能正常返回', async () => {
  const today = resolveTodayIssueDate()
  await writeFixture('international-daily-report', today, {
    workflowSlug: 'international-daily-report',
    issueDate: today,
    sourceType: 'collected',
    candidates: [
      { ...buildCandidate(1), sourceType: 'rss' },
      { ...buildCandidate(2), sourceType: 'rss' },
    ],
  })

  const pool = await getCandidatePool({
    workflowSlug: 'international-daily-report',
    issueDate: today,
  })
  assert.equal(pool.candidates.length, 2)
  assert.equal(pool.candidates[0].sourceType, 'rss')
  assert.equal(pool.candidates[1].sourceType, 'rss')
  // staleSourceDate 仅当兜底命中时出现,正常路径不应有
  assert.equal(pool.staleSourceDate, undefined)
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

test('今日 fixture 缺失但回退窗口内有更早 fixture 时返回兜底候选池', async () => {
  const today = resolveTodayIssueDate()
  const yesterday = shiftIssueDate(today, -1)
  await writeFixture('pool-fallback-recent', yesterday, {
    workflowSlug: 'pool-fallback-recent',
    issueDate: yesterday,
    sourceType: 'fixture',
    candidates: [buildCandidate(11), buildCandidate(12)],
  })

  const pool = await getCandidatePool({ workflowSlug: 'pool-fallback-recent', issueDate: today })

  assert.equal(pool.workflowSlug, 'pool-fallback-recent')
  assert.equal(pool.issueDate, today, 'issueDate 应保持为请求的今天')
  assert.equal(pool.staleSourceDate, yesterday)
  assert.equal(pool.candidates.length, 2)
})

test('回退窗口内无 fixture 时仍报 candidate_pool_fixture_missing', async () => {
  const today = resolveTodayIssueDate()
  await assert.rejects(
    () => getCandidatePool({ workflowSlug: 'pool-fallback-empty', issueDate: today }),
    (err) => err.code === 'candidate_pool_fixture_missing',
  )
})

test('fallback 关闭时今日缺失即使有更早 fixture 也直接报错', async () => {
  const today = resolveTodayIssueDate()
  const yesterday = shiftIssueDate(today, -1)
  await writeFixture('pool-fallback-disabled', yesterday, {
    workflowSlug: 'pool-fallback-disabled',
    issueDate: yesterday,
    sourceType: 'fixture',
    candidates: [buildCandidate(21)],
  })

  process.env.XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK = 'disabled'
  resetCandidatePoolProviderCacheForTests()

  await assert.rejects(
    () => getCandidatePool({ workflowSlug: 'pool-fallback-disabled', issueDate: today }),
    (err) => err.code === 'candidate_pool_fixture_missing',
  )
})

test('今日 fixture 命中时响应不含 staleSourceDate', async () => {
  const today = resolveTodayIssueDate()
  await writeFixture('pool-fallback-fresh', today, {
    workflowSlug: 'pool-fallback-fresh',
    issueDate: today,
    sourceType: 'fixture',
    candidates: [buildCandidate(31)],
  })

  const pool = await getCandidatePool({ workflowSlug: 'pool-fallback-fresh', issueDate: today })

  assert.equal(pool.issueDate, today)
  assert.equal(Object.prototype.hasOwnProperty.call(pool, 'staleSourceDate'), false)
})
