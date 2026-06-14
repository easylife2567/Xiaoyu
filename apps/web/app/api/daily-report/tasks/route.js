import { createDailyReportTask } from '../../../../lib/daily-report/service.js'

export const runtime = 'nodejs'

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求体不是合法 JSON。' }, { status: 400 })
  }

  const { workflowSlug, issueDate, issueNumber } = body ?? {}
  if (!workflowSlug || !issueDate || !issueNumber) {
    return Response.json(
      { error: '缺少必填字段：workflowSlug / issueDate / issueNumber。' },
      { status: 400 },
    )
  }

  try {
    const task = await createDailyReportTask({ workflowSlug, issueDate, issueNumber })
    return Response.json({ task }, { status: 201 })
  } catch (error) {
    if (error?.code === 'unsupported_issue_date') {
      return Response.json({ error: error.message, code: error.code }, { status: 400 })
    }
    if (error?.code === 'task_already_exists') {
      return Response.json(
        { error: error.message, code: error.code, existingTaskId: error.existingTaskId },
        { status: 409 },
      )
    }
    return Response.json(
      { error: error?.message ?? '任务创建失败。', code: error?.code ?? 'unknown_error' },
      { status: 500 },
    )
  }
}