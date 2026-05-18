import { startTranslationTask } from '../../../../../../lib/translation-processing/service.js'

export const runtime = 'nodejs'

export async function POST(_request, { params }) {
  const { taskId } = await params
  try {
    const task = await startTranslationTask(taskId)
    return Response.json({ task }, { status: 202 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '任务启动失败。' },
      { status: 400 },
    )
  }
}
