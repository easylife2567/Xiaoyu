import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PROGRESS_ROOT } from './config.js'

async function ensureProgressRoot() {
  await mkdir(PROGRESS_ROOT, { recursive: true })
}

function progressPath(taskId, attemptId) {
  return path.join(PROGRESS_ROOT, `${taskId}.${attemptId}.json`)
}

export async function readTaskProgress(taskId, attemptId) {
  if (!taskId || !attemptId) {
    return null
  }

  await ensureProgressRoot()
  try {
    const raw = await readFile(progressPath(taskId, attemptId), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function writeTaskProgress(taskId, attemptId, progress) {
  await ensureProgressRoot()
  const targetPath = progressPath(taskId, attemptId)
  const tempPath = `${targetPath}.${randomUUID()}.tmp`
  await writeFile(tempPath, JSON.stringify(progress, null, 2))
  await rename(tempPath, targetPath)
  return progress
}

export async function removeTaskProgress(taskId, attemptId) {
  if (!taskId || !attemptId) {
    return
  }

  await ensureProgressRoot()
  await rm(progressPath(taskId, attemptId), { force: true })
}

export async function resetProgressStoreForTests() {
  await ensureProgressRoot()
  await rm(PROGRESS_ROOT, { recursive: true, force: true })
  await ensureProgressRoot()
}

