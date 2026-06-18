import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  resolveDailyReportFixtureStaleFallbackEnabled,
  resolveDailyReportFixtureStaleWindowDays,
  resolveFixtureRoot,
} from '../config.js'

const ISSUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function todayInLocalTimeZone() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseIssueDate(value) {
  if (!ISSUE_DATE_PATTERN.test(value)) return null
  const [year, month, day] = value.split('-').map((segment) => Number.parseInt(segment, 10))
  // 用 UTC 构造 Date 来做日期算术,避免本地时区夏令时跳跃造成"偏移一天"。
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) return null
  return date
}

function formatIssueDate(date) {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function subtractDays(issueDate, days) {
  const parsed = parseIssueDate(issueDate)
  if (!parsed) return null
  parsed.setUTCDate(parsed.getUTCDate() - days)
  return formatIssueDate(parsed)
}

function assertIsToday(issueDate) {
  if (!ISSUE_DATE_PATTERN.test(issueDate)) {
    const error = new Error('issueDate 必须是 YYYY-MM-DD 格式。')
    error.code = 'invalid_issue_date'
    throw error
  }

  if (issueDate !== todayInLocalTimeZone()) {
    const error = new Error(`当前运行时仅支持今天 (${todayInLocalTimeZone()}) 的日报，收到 ${issueDate}。`)
    error.code = 'unsupported_issue_date'
    throw error
  }
}

// build-candidate-pool-real-collector(2026-06-18):放宽硬编码 'fixture',
// 改为已知枚举白名单。'fixture' = 手工 seed,'rss' = collect.py 抓取。
// drafting / export 不读 sourceType,只用于 spec 审计 / 区分。
const ALLOWED_CANDIDATE_SOURCE_TYPES = new Set(['fixture', 'rss'])

function assertCandidateShape(candidate, indexLabel) {
  const requiredFields = ['id', 'sourceType', 'title', 'sourceName', 'sourceUrl', 'publishedAt', 'summary']
  for (const field of requiredFields) {
    if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') {
      const error = new Error(`候选 ${indexLabel} 缺少必填字段 ${field}。`)
      error.code = 'candidate_pool_invalid'
      throw error
    }
  }

  if (!ALLOWED_CANDIDATE_SOURCE_TYPES.has(candidate.sourceType)) {
    const error = new Error(
      `候选 ${indexLabel} 的 sourceType 必须为 ${[...ALLOWED_CANDIDATE_SOURCE_TYPES].join(' / ')} 之一,实际为 ${candidate.sourceType}。`,
    )
    error.code = 'candidate_pool_invalid'
    throw error
  }
}

// 解析并校验 fixture payload。回退场景下 payload.issueDate 可能 ≠ 请求 issueDate,
// 因此本函数只校验 workflowSlug + candidates 自身,不再断言 issueDate。
function parseFixturePayload(raw, expectedWorkflowSlug, fixturePath) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    const error = new Error(`候选池 fixture 不是合法 JSON：${fixturePath}`)
    error.code = 'candidate_pool_invalid'
    throw error
  }

  if (parsed.workflowSlug !== expectedWorkflowSlug) {
    const error = new Error(
      `候选池 fixture workflowSlug 不匹配：期望 ${expectedWorkflowSlug}，实际 ${parsed.workflowSlug}。`,
    )
    error.code = 'candidate_pool_invalid'
    throw error
  }

  if (!Array.isArray(parsed.candidates) || parsed.candidates.length === 0) {
    const error = new Error(`候选池 fixture 候选数组为空：${fixturePath}`)
    error.code = 'candidate_pool_invalid'
    throw error
  }

  parsed.candidates.forEach((candidate, index) => {
    assertCandidateShape(candidate, `#${index + 1}`)
  })

  return parsed
}

// 命中返回 parsed payload;ENOENT 返回 null;其它(JSON 错/校验失败/读权限)抛 candidate_pool_invalid。
async function loadFixtureFile(workflowSlug, issueDate, fixtureRoot) {
  const fixturePath = path.join(fixtureRoot, workflowSlug, `${issueDate}.json`)
  let raw
  try {
    raw = await readFile(fixturePath, 'utf8')
  } catch (cause) {
    if (cause?.code === 'ENOENT') return null
    const error = new Error(`候选池 fixture 读取失败：${fixturePath}`)
    error.code = 'candidate_pool_invalid'
    error.cause = cause
    throw error
  }
  return parseFixturePayload(raw, workflowSlug, fixturePath)
}

// 从 requestedDate-1 倒推 windowDays 天,命中即停。扫描中遇 candidate_pool_invalid
// 视该日期不可用并继续向更早回退(兜底优先;design.md R2 已记录这一妥协)。
async function findMostRecentFixtureWithinWindow(workflowSlug, requestedIssueDate, fixtureRoot, windowDays) {
  for (let offset = 1; offset <= windowDays; offset += 1) {
    const candidateDate = subtractDays(requestedIssueDate, offset)
    if (!candidateDate) continue
    let payload
    try {
      payload = await loadFixtureFile(workflowSlug, candidateDate, fixtureRoot)
    } catch (cause) {
      if (cause?.code === 'candidate_pool_invalid') {
        console.warn(
          `[daily-report] 跳过损坏的 fixture ${workflowSlug}/${candidateDate}.json:`,
          cause.message,
        )
        continue
      }
      throw cause
    }
    if (payload) return { payload, sourceDate: candidateDate }
  }
  return null
}

function buildMissingError(workflowSlug, issueDate, fixtureRoot) {
  const fixturePath = path.join(fixtureRoot, workflowSlug, `${issueDate}.json`)
  const error = new Error(`候选池 fixture 缺失：${fixturePath}`)
  error.code = 'candidate_pool_fixture_missing'
  return error
}

function buildResponse(payload, { workflowSlug, issueDate, staleSourceDate }) {
  const response = {
    workflowSlug,
    issueDate,
    sourceType: 'fixture',
    generatedAt: payload.generatedAt ?? null,
    candidates: payload.candidates,
  }
  if (staleSourceDate) {
    response.staleSourceDate = staleSourceDate
  }
  return response
}

function createFixtureCandidatePoolProvider({ workflowSlug, fixtureRoot }) {
  return {
    async getCandidatePool({ issueDate }) {
      assertIsToday(issueDate)

      const todayPayload = await loadFixtureFile(workflowSlug, issueDate, fixtureRoot)
      if (todayPayload) {
        return buildResponse(todayPayload, { workflowSlug, issueDate, staleSourceDate: null })
      }

      const fallbackEnabled = resolveDailyReportFixtureStaleFallbackEnabled()
      const windowDays = resolveDailyReportFixtureStaleWindowDays()
      if (!fallbackEnabled || windowDays === 0) {
        throw buildMissingError(workflowSlug, issueDate, fixtureRoot)
      }

      const recent = await findMostRecentFixtureWithinWindow(
        workflowSlug,
        issueDate,
        fixtureRoot,
        windowDays,
      )
      if (!recent) throw buildMissingError(workflowSlug, issueDate, fixtureRoot)
      return buildResponse(recent.payload, {
        workflowSlug,
        issueDate,
        staleSourceDate: recent.sourceDate,
      })
    },
  }
}

let cachedProviders = new Map()

export function getCandidatePoolProvider({ workflowSlug }) {
  const fixtureRoot = resolveFixtureRoot()
  const cacheKey = `${workflowSlug}::${fixtureRoot}`
  if (cachedProviders.has(cacheKey)) {
    return cachedProviders.get(cacheKey)
  }

  const provider = createFixtureCandidatePoolProvider({ workflowSlug, fixtureRoot })
  cachedProviders.set(cacheKey, provider)
  return provider
}

export async function getCandidatePool({ workflowSlug, issueDate }) {
  const provider = getCandidatePoolProvider({ workflowSlug })
  return provider.getCandidatePool({ issueDate })
}

export function resetCandidatePoolProviderCacheForTests() {
  cachedProviders = new Map()
}

export function resolveTodayIssueDate() {
  return todayInLocalTimeZone()
}
