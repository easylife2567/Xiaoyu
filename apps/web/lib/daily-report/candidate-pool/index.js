import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { resolveFixtureRoot } from '../config.js'

const ISSUE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function todayInLocalTimeZone() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

function assertCandidateShape(candidate, indexLabel) {
  const requiredFields = ['id', 'sourceType', 'title', 'sourceName', 'sourceUrl', 'publishedAt', 'summary']
  for (const field of requiredFields) {
    if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') {
      const error = new Error(`候选 ${indexLabel} 缺少必填字段 ${field}。`)
      error.code = 'candidate_pool_invalid'
      throw error
    }
  }

  if (candidate.sourceType !== 'fixture') {
    const error = new Error(`候选 ${indexLabel} 的 sourceType 必须为 fixture，实际为 ${candidate.sourceType}。`)
    error.code = 'candidate_pool_invalid'
    throw error
  }
}

function createFixtureCandidatePoolProvider({ workflowSlug, fixtureRoot }) {
  return {
    async getCandidatePool({ issueDate }) {
      assertIsToday(issueDate)
      const fixturePath = path.join(fixtureRoot, workflowSlug, `${issueDate}.json`)
      let raw
      try {
        raw = await readFile(fixturePath, 'utf8')
      } catch (cause) {
        if (cause?.code === 'ENOENT') {
          const error = new Error(`候选池 fixture 缺失：${fixturePath}`)
          error.code = 'candidate_pool_fixture_missing'
          throw error
        }
        throw cause
      }

      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch (cause) {
        const error = new Error(`候选池 fixture 不是合法 JSON：${fixturePath}`)
        error.code = 'candidate_pool_invalid'
        throw error
      }

      if (parsed.workflowSlug !== workflowSlug || parsed.issueDate !== issueDate) {
        const error = new Error(
          `候选池 fixture 字段不匹配：期望 workflowSlug=${workflowSlug} issueDate=${issueDate}，` +
            `实际 workflowSlug=${parsed.workflowSlug} issueDate=${parsed.issueDate}。`,
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

      return {
        workflowSlug,
        issueDate,
        sourceType: 'fixture',
        generatedAt: parsed.generatedAt ?? null,
        candidates: parsed.candidates,
      }
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