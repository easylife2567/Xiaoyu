import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function resolveProjectRoot() {
  return process.cwd().endsWith(path.join('apps', 'web')) ? path.resolve(process.cwd(), '../..') : process.cwd()
}

export const PROJECT_ROOT = resolveProjectRoot()
export const DATA_ROOT = path.resolve(PROJECT_ROOT, '.data/daily-report')
export const RUNTIME_ROOT = path.join(DATA_ROOT, 'runtime')
export const TASK_ROOT = path.join(RUNTIME_ROOT, 'tasks')
export const ARTIFACT_ROOT = path.join(RUNTIME_ROOT, 'artifacts')
export const PROGRESS_ROOT = path.join(RUNTIME_ROOT, 'progress')
export const DEFAULT_FIXTURE_ROOT = path.join(DATA_ROOT, 'fixtures')
export const TEMPLATE_ROOT = path.resolve(PROJECT_ROOT, 'services/worker/daily_report/templates')

export function resolveDailyReportRuntimeRepositoryMode() {
  if (process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY) {
    return process.env.XIAOYU_DAILY_REPORT_RUNTIME_REPOSITORY
  }

  if (process.env.NODE_ENV === 'test') {
    return 'memory'
  }

  return process.env.DATABASE_URL ? 'prisma' : 'file'
}

export function resolveDailyReportStorageAdapterMode() {
  return process.env.XIAOYU_DAILY_REPORT_STORAGE_ADAPTER || 'local'
}

export function resolveFixtureRoot() {
  return process.env.XIAOYU_DAILY_REPORT_FIXTURE_ROOT
    ? path.resolve(process.env.XIAOYU_DAILY_REPORT_FIXTURE_ROOT)
    : DEFAULT_FIXTURE_ROOT
}

export function resolvePythonBinary() {
  if (process.env.XIAOYU_PYTHON_BIN) {
    return process.env.XIAOYU_PYTHON_BIN
  }

  const bundledPython = path.join(
    os.homedir(),
    '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3',
  )

  return existsSync(bundledPython) ? bundledPython : 'python3'
}

export function resolveWorkerScript() {
  return path.resolve(PROJECT_ROOT, 'services/worker/daily_report/worker.py')
}