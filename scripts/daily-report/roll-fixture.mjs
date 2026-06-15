#!/usr/bin/env node
// Daily-report 候选池 fixture 滚动脚本
//
// 用最近一份 fixture 为模板,平移 issueDate / generatedAt / candidates[*].id /
// candidates[*].publishedAt / candidates[*].retrievalMetadata.collectedAt 到目标
// 日期。其余字段(title / sourceName / sourceUrl / summary / language / confidence)
// 原样保留。**不调用 AI**。
//
// 使用:
//   node scripts/daily-report/roll-fixture.mjs --workflow international-daily-report
//                                              [--date 2026-06-15]
//                                              [--fixture-root /abs/path]
//                                              [--force]
//
// 退出码:
//   0  成功(stdout 输出 JSON 摘要)
//   1  参数缺失/非法
//   2  no_source_fixture: 目录里没有可用模板
//   3  target_already_exists: 目标日期 fixture 已存在,且未加 --force

import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ISSUE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseArgs(argv) {
  const args = { workflow: null, date: null, fixtureRoot: null, force: false }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    switch (token) {
      case '--workflow':
        args.workflow = argv[++i]
        break
      case '--date':
        args.date = argv[++i]
        break
      case '--fixture-root':
        args.fixtureRoot = argv[++i]
        break
      case '--force':
        args.force = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
      default:
        return { error: `unknown_argument:${token}` }
    }
  }
  return args
}

function fail(code, exitCode, payload, stderrMessage) {
  if (stderrMessage) console.error(stderrMessage)
  process.stdout.write(`${JSON.stringify({ ok: false, code, ...payload })}\n`)
  process.exit(exitCode)
}

function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function repoRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  // <repo>/scripts/daily-report/roll-fixture.mjs → repo = ../..
  return path.resolve(here, '..', '..')
}

function isoDateAt(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day))
}

function parseIsoDate(value) {
  const match = ISSUE_DATE_PATTERN.exec(value)
  if (!match) return null
  return isoDateAt(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10))
}

function formatIsoDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function diffDays(targetDate, sourceDate) {
  const target = parseIsoDate(targetDate)
  const source = parseIsoDate(sourceDate)
  if (!target || !source) return 0
  return Math.round((target.getTime() - source.getTime()) / (24 * 60 * 60 * 1000))
}

function shiftIsoTimestamp(timestamp, days) {
  if (typeof timestamp !== 'string') return timestamp
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return timestamp
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

// 把 ID 中的 YYYY-MM-DD 段替换为目标日期。如果原 ID 不含日期段,改写为 <prefix>-<targetDate>-<NNN>。
function rollCandidateId(originalId, sourceDate, targetDate, indexFallback) {
  if (typeof originalId !== 'string' || !originalId) {
    return `intl-${targetDate}-${String(indexFallback + 1).padStart(3, '0')}`
  }
  if (originalId.includes(sourceDate)) {
    return originalId.split(sourceDate).join(targetDate)
  }
  // ID 不含源日期段:尝试保留末段序号,缺失则按索引补 001/002...
  const tail = /([0-9]{2,4})$/.exec(originalId)
  const seq = tail ? tail[1] : String(indexFallback + 1).padStart(3, '0')
  const prefix = originalId.replace(/[-_]?[0-9]+$/, '') || 'intl'
  return `${prefix}-${targetDate}-${seq}`
}

async function listIssueDateFixtures(workflowDir) {
  let entries = []
  try {
    entries = await readdir(workflowDir, { withFileTypes: true })
  } catch (cause) {
    if (cause?.code === 'ENOENT') return []
    throw cause
  }
  const dates = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const match = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(entry.name)
    if (match) dates.push(match[1])
  }
  return dates.sort()
}

async function pickSourceFixture(workflowDir, targetDate) {
  const dates = await listIssueDateFixtures(workflowDir)
  // 严格早于 targetDate 的 fixture,从最近往前试,parse 失败的视为不可用。
  const earlier = dates.filter((d) => d < targetDate).sort((a, b) => (a < b ? 1 : -1))
  const tried = []
  for (const date of earlier) {
    const filePath = path.join(workflowDir, `${date}.json`)
    tried.push(date)
    let raw
    try {
      raw = await readFile(filePath, 'utf8')
    } catch {
      continue
    }
    try {
      const parsed = JSON.parse(raw)
      if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
        return { date, payload: parsed }
      }
    } catch {
      continue
    }
  }
  return { tried, payload: null }
}

function rollPayload(sourcePayload, sourceDate, targetDate) {
  const days = diffDays(targetDate, sourceDate)
  const candidates = sourcePayload.candidates.map((candidate, index) => {
    const next = { ...candidate }
    next.id = rollCandidateId(candidate.id, sourceDate, targetDate, index)
    if (typeof candidate.publishedAt === 'string') {
      next.publishedAt = shiftIsoTimestamp(candidate.publishedAt, days)
    }
    if (candidate.retrievalMetadata && typeof candidate.retrievalMetadata.collectedAt === 'string') {
      next.retrievalMetadata = {
        ...candidate.retrievalMetadata,
        collectedAt: shiftIsoTimestamp(candidate.retrievalMetadata.collectedAt, days),
      }
    }
    return next
  })
  return {
    ...sourcePayload,
    issueDate: targetDate,
    generatedAt: `${targetDate}T01:30:00.000Z`,
    sourceType: sourcePayload.sourceType ?? 'fixture',
    candidates,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    process.stdout.write(
      'roll-fixture --workflow <slug> [--date YYYY-MM-DD] [--fixture-root <abs>] [--force]\n',
    )
    return
  }
  if (args.error) {
    fail('invalid_argument', 1, { argument: args.error }, `参数解析失败: ${args.error}`)
    return
  }
  if (!args.workflow) {
    fail('missing_workflow', 1, {}, '必须通过 --workflow <slug> 指定 workflow。')
    return
  }
  const targetDate = args.date ?? todayLocal()
  if (!ISSUE_DATE_PATTERN.test(targetDate)) {
    fail('invalid_date', 1, { date: targetDate }, `--date 必须是 YYYY-MM-DD 格式,收到 ${targetDate}。`)
    return
  }
  const fixtureRoot = args.fixtureRoot
    ? path.resolve(args.fixtureRoot)
    : path.join(repoRoot(), '.data/daily-report/fixtures')
  const workflowDir = path.join(fixtureRoot, args.workflow)
  const targetPath = path.join(workflowDir, `${targetDate}.json`)

  if (existsSync(targetPath) && !args.force) {
    fail('target_already_exists', 3, { path: targetPath }, `目标 fixture 已存在:${targetPath}(加 --force 覆盖)。`)
    return
  }

  const source = await pickSourceFixture(workflowDir, targetDate)
  if (!source.payload) {
    fail(
      'no_source_fixture',
      2,
      { searched: source.tried, workflowDir },
      `${workflowDir} 下没有早于 ${targetDate} 且可解析的 fixture。`,
    )
    return
  }

  const rolled = rollPayload(source.payload, source.date, targetDate)
  await mkdir(workflowDir, { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(rolled, null, 2)}\n`, 'utf8')

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      written: targetPath,
      source: source.date,
      target: targetDate,
      candidates: rolled.candidates.length,
    })}\n`,
  )
}

main().catch((cause) => {
  console.error(cause)
  fail('unexpected_error', 1, { message: cause?.message ?? String(cause) })
})
