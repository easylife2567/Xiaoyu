import {
  getTranslationTask,
  resetTranslationTask,
} from '../../../../../lib/translation-processing/service.js'
import { diagnoseTranslationTask } from '../../../../../src/translation-processing-diagnostics.js'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { taskId } = await params

  try {
    const task = await getTranslationTask(taskId)
    return Response.json({ task, diagnostics: diagnoseTranslationTask(task) })
  } catch {
    return Response.json({ error: '未找到任务。' }, { status: 404 })
  }
}

/**
 * 删除翻译任务及其所有 attempt / artifact / upload 记录。
 * 幂等:对不存在的 taskId 仍返回 200(对齐 daily-report 的 reset 语义)。
 */
export async function DELETE(_request, { params }) {
  const { taskId } = await params
  try {
    await resetTranslationTask(taskId)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: '任务重置失败。' }, { status: 500 })
  }
}
