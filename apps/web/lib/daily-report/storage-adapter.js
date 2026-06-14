import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import {
  ARTIFACT_ROOT,
  resolveDailyReportStorageAdapterMode,
  resolveFixtureRoot,
  TEMPLATE_ROOT,
} from './config.js'

function createLocalStorageAdapter() {
  return {
    async resolveFixturePath({ workflowSlug, issueDate }) {
      return path.join(resolveFixtureRoot(), workflowSlug, `${issueDate}.json`)
    },
    async resolveTemplatePath(templateRelativePath) {
      return path.join(TEMPLATE_ROOT, templateRelativePath)
    },
    async resolveArtifactPath({ taskId, fileName }) {
      await mkdir(path.join(ARTIFACT_ROOT, taskId), { recursive: true })
      const objectKey = path.posix.join(taskId, fileName)
      return {
        objectKey,
        absolutePath: path.join(ARTIFACT_ROOT, taskId, fileName),
      }
    },
    async persistArtifactBytes({ objectKey, bytes }) {
      const absolutePath = path.join(ARTIFACT_ROOT, objectKey)
      await mkdir(path.dirname(absolutePath), { recursive: true })
      await writeFile(absolutePath, bytes)
      return { absolutePath, sizeBytes: bytes.byteLength ?? bytes.length ?? 0 }
    },
    async copyTemplateIntoArtifactSlot({ templateRelativePath, objectKey }) {
      const source = path.join(TEMPLATE_ROOT, templateRelativePath)
      const target = path.join(ARTIFACT_ROOT, objectKey)
      await mkdir(path.dirname(target), { recursive: true })
      await copyFile(source, target)
      const fileStats = await stat(target)
      return { absolutePath: target, sizeBytes: fileStats.size }
    },
    async readArtifactBytes(objectKey) {
      return readFile(path.join(ARTIFACT_ROOT, objectKey))
    },
    async statArtifact(objectKey) {
      return stat(path.join(ARTIFACT_ROOT, objectKey))
    },
  }
}

let cachedAdapter = null
let cachedMode = null

export function getDailyReportStorageAdapter() {
  const mode = resolveDailyReportStorageAdapterMode()
  if (cachedAdapter && cachedMode === mode) {
    return cachedAdapter
  }

  if (mode !== 'local') {
    throw new Error(`不支持的日报存储适配器: ${mode}`)
  }

  cachedAdapter = createLocalStorageAdapter()
  cachedMode = mode
  return cachedAdapter
}

export function resetDailyReportStorageAdapterForTests() {
  cachedAdapter = null
  cachedMode = null
}