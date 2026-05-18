import { randomUUID } from 'node:crypto'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { ARTIFACT_ROOT, UPLOAD_ROOT } from './config.js'

export async function persistUpload({ fileName, buffer }) {
  await mkdir(UPLOAD_ROOT, { recursive: true })
  const extension = path.extname(fileName) || '.xlsx'
  const objectKey = `${randomUUID()}${extension}`
  const absolutePath = path.join(UPLOAD_ROOT, objectKey)
  await writeFile(absolutePath, buffer)
  return { objectKey, absolutePath }
}

export async function resolveUploadPath(objectKey) {
  return path.join(UPLOAD_ROOT, objectKey)
}

export async function reserveArtifactPath({ taskId, version }) {
  await mkdir(ARTIFACT_ROOT, { recursive: true })
  const fileName = `${taskId}-v${version}.xlsx`
  return {
    fileName,
    objectKey: fileName,
    absolutePath: path.join(ARTIFACT_ROOT, fileName),
  }
}

export async function getFileSize(absolutePath) {
  const fileStats = await stat(absolutePath)
  return fileStats.size
}
