import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, before, beforeEach, test } from 'node:test'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = path.resolve(HERE, '..', '..', '..', 'scripts', 'daily-report', 'roll-fixture.mjs')

let tempRoot

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'xiaoyu-roll-fixture-'))
})

after(async () => {
  await rm(tempRoot, { recursive: true, force: true })
})

beforeEach(async () => {
  // 每个用例独立 workflow 目录避免互相污染
})

function runScript(args, options = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    ...options,
  })
}

function parseStdoutSummary(stdout) {
  const trimmed = stdout.trim()
  const lastLine = trimmed.split('\n').pop() ?? ''
  return JSON.parse(lastLine)
}

async function writeSourceFixture(workflowDir, issueDate, candidates) {
  await mkdir(workflowDir, { recursive: true })
  const payload = {
    workflowSlug: path.basename(workflowDir),
    issueDate,
    generatedAt: `${issueDate}T01:30:00.000Z`,
    sourceType: 'fixture',
    candidates,
  }
  await writeFile(path.join(workflowDir, `${issueDate}.json`), JSON.stringify(payload, null, 2))
  return payload
}

function makeCandidate(workflow, issueDate, index) {
  return {
    id: `${workflow.slice(0, 4)}-${issueDate}-${String(index).padStart(3, '0')}`,
    sourceType: 'fixture',
    title: `候选 ${index}`,
    sourceName: `源 ${index}`,
    sourceUrl: `https://example.com/${index}`,
    publishedAt: `${issueDate}T22:00:00.000Z`,
    summary: `摘要 ${index}`,
    retrievalMetadata: {
      collectedAt: `${issueDate}T00:30:00.000Z`,
      language: 'en',
      confidence: 0.9,
    },
  }
}

test('正常路径:把更早的 fixture 平移为目标日期', async () => {
  const workflow = 'roll-happy'
  const workflowDir = path.join(tempRoot, workflow)
  await writeSourceFixture(workflowDir, '2026-06-12', [
    makeCandidate(workflow, '2026-06-12', 1),
    makeCandidate(workflow, '2026-06-12', 2),
  ])

  const result = runScript([
    '--workflow', workflow,
    '--date', '2026-06-15',
    '--fixture-root', tempRoot,
  ])
  assert.equal(result.status, 0, `stderr: ${result.stderr}`)

  const summary = parseStdoutSummary(result.stdout)
  assert.equal(summary.ok, true)
  assert.equal(summary.source, '2026-06-12')
  assert.equal(summary.target, '2026-06-15')
  assert.equal(summary.candidates, 2)

  const written = JSON.parse(await readFile(path.join(workflowDir, '2026-06-15.json'), 'utf8'))
  assert.equal(written.issueDate, '2026-06-15')
  assert.equal(written.generatedAt, '2026-06-15T01:30:00.000Z')
  assert.equal(written.candidates[0].id, 'roll-2026-06-15-001')
  assert.equal(written.candidates[0].publishedAt, '2026-06-15T22:00:00.000Z')
  assert.equal(written.candidates[0].retrievalMetadata.collectedAt, '2026-06-15T00:30:00.000Z')
  assert.equal(written.candidates[1].id, 'roll-2026-06-15-002')
})

test('退出码 2 + no_source_fixture:目录里没有早于目标日期的 fixture', async () => {
  const workflow = 'roll-empty'
  const workflowDir = path.join(tempRoot, workflow)
  await mkdir(workflowDir, { recursive: true })

  const result = runScript([
    '--workflow', workflow,
    '--date', '2026-06-15',
    '--fixture-root', tempRoot,
  ])
  assert.equal(result.status, 2)

  const summary = parseStdoutSummary(result.stdout)
  assert.equal(summary.ok, false)
  assert.equal(summary.code, 'no_source_fixture')
})

test('退出码 3 + target_already_exists:目标日期已有 fixture', async () => {
  const workflow = 'roll-exists'
  const workflowDir = path.join(tempRoot, workflow)
  await writeSourceFixture(workflowDir, '2026-06-12', [makeCandidate(workflow, '2026-06-12', 1)])
  await writeSourceFixture(workflowDir, '2026-06-15', [makeCandidate(workflow, '2026-06-15', 1)])

  const result = runScript([
    '--workflow', workflow,
    '--date', '2026-06-15',
    '--fixture-root', tempRoot,
  ])
  assert.equal(result.status, 3)

  const summary = parseStdoutSummary(result.stdout)
  assert.equal(summary.code, 'target_already_exists')
})

test('退出码 1:缺 --workflow', async () => {
  const result = runScript(['--date', '2026-06-15', '--fixture-root', tempRoot])
  assert.equal(result.status, 1)

  const summary = parseStdoutSummary(result.stdout)
  assert.equal(summary.code, 'missing_workflow')
})

test('--force 可覆盖已存在的目标 fixture', async () => {
  const workflow = 'roll-force'
  const workflowDir = path.join(tempRoot, workflow)
  await writeSourceFixture(workflowDir, '2026-06-12', [makeCandidate(workflow, '2026-06-12', 1)])
  await writeSourceFixture(workflowDir, '2026-06-15', [makeCandidate(workflow, '2026-06-15', 99)])

  const result = runScript([
    '--workflow', workflow,
    '--date', '2026-06-15',
    '--fixture-root', tempRoot,
    '--force',
  ])
  assert.equal(result.status, 0, `stderr: ${result.stderr}`)

  const written = JSON.parse(await readFile(path.join(workflowDir, '2026-06-15.json'), 'utf8'))
  // 覆盖后的 ID 应来自 6-12 平移而来,不再是 99
  assert.equal(written.candidates[0].id, 'roll-2026-06-15-001')
})
