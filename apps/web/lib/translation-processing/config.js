import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function resolveProjectRoot() {
  return process.cwd().endsWith(path.join('apps', 'web')) ? path.resolve(process.cwd(), '../..') : process.cwd()
}

export const PROJECT_ROOT = resolveProjectRoot()
export const DATA_ROOT = path.resolve(PROJECT_ROOT, '.data/translation-processing')
export const TASK_ROOT = path.join(DATA_ROOT, 'tasks')
export const UPLOAD_ROOT = path.join(DATA_ROOT, 'uploads')
export const ARTIFACT_ROOT = path.join(DATA_ROOT, 'artifacts')

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
  return path.resolve(PROJECT_ROOT, 'services/worker/translation_processing/worker.py')
}
