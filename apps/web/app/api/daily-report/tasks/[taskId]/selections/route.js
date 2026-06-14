import { submitSelections } from '../../../../../../lib/daily-report/service.js'

export const runtime = 'nodejs'

export async function POST(request, { params }) {
  const { taskId } = await params
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求体不是合法 JSON。' }, { status: 400 })
  }

  const selections = body?.selections
  if (!Array.isArray(selections)) {
    return Response.json({ error: 'selections 必须为数组。' }, { status: 400 })
  }

  try {
    const task = await submitSelections(taskId, selections)
    return Response.json({ task })
  } catch (error) {
    const status =
      error?.code === 'invalid_task_state' || error?.code === 'invalid_selection_count'
        ? 409
        : error?.code === 'invalid_selections'
          ? 400
          : 500
    return Response.json(
      { error: error?.message ?? '选择提交失败。', code: error?.code ?? 'unknown_error' },
      { status },
    )
  }
}