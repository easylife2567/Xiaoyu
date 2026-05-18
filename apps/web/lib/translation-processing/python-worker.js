import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolvePythonBinary, resolveWorkerScript } from './config.js'

const execFileAsync = promisify(execFile)

export async function runWorker(command, args) {
  try {
    const { stdout } = await execFileAsync(resolvePythonBinary(), [resolveWorkerScript(), command, ...args])
    return JSON.parse(stdout)
  } catch (error) {
    const stderr = error?.stderr ?? ''
    if (stderr.includes("No module named 'openpyxl'")) {
      throw new Error('处理环境缺少 Excel 依赖，请重新启动开发服务后再试。')
    }
    throw error
  }
}
