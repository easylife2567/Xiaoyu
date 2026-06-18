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

// fixture 缺失时是否回退到最近一份。disabled / 0 / false / off 关闭(默认启用)。
export function resolveDailyReportFixtureStaleFallbackEnabled() {
  const raw = process.env.XIAOYU_DAILY_REPORT_FIXTURE_STALE_FALLBACK
  if (!raw) return true
  const v = raw.trim().toLowerCase()
  return v !== 'disabled' && v !== '0' && v !== 'false' && v !== 'off'
}

// fixture 回退窗口天数,0 视为关闭,负数/解析失败回到默认 7。
export function resolveDailyReportFixtureStaleWindowDays() {
  const raw = process.env.XIAOYU_DAILY_REPORT_FIXTURE_STALE_WINDOW_DAYS
  if (!raw) return 7
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return 7
  return n
}

// 真实采集器(collect 子命令) 单 feed HTTP 超时秒数,负数/解析失败回到默认 15。
export function resolveCollectorTimeoutSeconds() {
  const raw = process.env.XIAOYU_DAILY_REPORT_COLLECTOR_TIMEOUT_SECONDS
  if (!raw) return 15
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return 15
  return n
}

// 真实采集器请求 RSS 时使用的 User-Agent,空值/未设置回到默认。
export function resolveCollectorUserAgent() {
  const raw = process.env.XIAOYU_DAILY_REPORT_COLLECTOR_USER_AGENT
  if (!raw || !raw.trim()) return 'xiaoyu-daily-report/0.1'
  return raw.trim()
}