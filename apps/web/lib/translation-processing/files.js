import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ARTIFACT_ROOT, UPLOAD_ROOT, resolveTranslationStorageAdapterMode } from './config.js'

function createLocalStorageAdapter() {
  return {
    async persistUpload({ fileName, buffer }) {
      await mkdir(UPLOAD_ROOT, { recursive: true })
      const extension = path.extname(fileName) || '.xlsx'
      const objectKey = `${randomUUID()}${extension}`
      const absolutePath = path.join(UPLOAD_ROOT, objectKey)
      await writeFile(absolutePath, buffer)
      return { objectKey, absolutePath }
    },
    async resolveUploadPath(objectKey) {
      return path.join(UPLOAD_ROOT, objectKey)
    },
    async reserveArtifactPath({ taskId, version }) {
      await mkdir(ARTIFACT_ROOT, { recursive: true })
      const fileName = `${taskId}-v${version}.xlsx`
      return {
        fileName,
        objectKey: fileName,
        absolutePath: path.join(ARTIFACT_ROOT, fileName),
      }
    },
    async readArtifactBytes(objectKey) {
      return readFile(path.join(ARTIFACT_ROOT, objectKey))
    },
  }
}

let cachedAdapter = null
let cachedMode = null

function getTranslationStorageAdapter() {
  const mode = resolveTranslationStorageAdapterMode()
  if (cachedAdapter && cachedMode === mode) {
    return cachedAdapter
  }

  if (mode !== 'local') {
    throw new Error(`不支持的翻译文件存储适配器: ${mode}`)
  }

  cachedAdapter = createLocalStorageAdapter()
  cachedMode = mode
  return cachedAdapter
}

export async function persistUpload(input) {
  return getTranslationStorageAdapter().persistUpload(input)
}

export async function resolveUploadPath(objectKey) {
  return getTranslationStorageAdapter().resolveUploadPath(objectKey)
}

export async function reserveArtifactPath(input) {
  return getTranslationStorageAdapter().reserveArtifactPath(input)
}

export async function readArtifactBytes(objectKey) {
  return getTranslationStorageAdapter().readArtifactBytes(objectKey)
}

export async function getFileSize(absolutePath) {
  const fileStats = await stat(absolutePath)
  return fileStats.size
}
