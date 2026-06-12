import { getTranslationTask } from '../../../../../lib/translation-processing/service.js'
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
