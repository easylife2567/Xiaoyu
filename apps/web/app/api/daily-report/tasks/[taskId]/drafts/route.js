import { startDraftAttempt } from '../../../../../../lib/daily-report/service.js'

export const runtime = 'nodejs'

export async function POST(_request, { params }) {
  const { taskId } = await params

  try {
    const task = await startDraftAttempt(taskId)
    return Response.json({ task }, { status: 202 })
  } catch (error) {
    const status =
      error?.code === 'invalid_task_state' || error?.code === 'selections_not_submitted'
        ? 409
        : 500
    return Response.json(
      { error: error?.message ?? '起草失败。', code: error?.code ?? 'unknown_error' },
      { status },
    )
  }
}