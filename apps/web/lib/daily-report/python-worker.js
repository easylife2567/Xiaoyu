import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolvePythonBinary, resolveWorkerScript } from './config.js'

const execFileAsync = promisify(execFile)

export async function runDailyReportWorker(command, args) {
  try {
    const { stdout } = await execFileAsync(resolvePythonBinary(), [
      resolveWorkerScript(),
      command,
      ...args,
    ], {
      maxBuffer: 32 * 1024 * 1024, // 32MB
    })
    return JSON.parse(stdout)
  } catch (error) {
    const stderr = error?.stderr ?? ''
    if (stderr.includes("No module named 'docx'") || stderr.includes("No module named 'python-docx'")) {
      throw new Error('日报 worker 缺少 python-docx 依赖，请先在 worker 环境安装。')
    }
    if (stderr.includes("No module named 'openpyxl'")) {
      throw new Error('日报 worker 缺少 openpyxl 依赖，请先在 worker 环境安装。')
    }
    throw error
  }
}