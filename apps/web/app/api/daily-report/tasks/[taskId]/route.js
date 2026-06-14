import { getDailyReportTask, resetDailyReportTask } from '../../../../../lib/daily-report/service.js'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { taskId } = await params
  try {
    const task = await getDailyReportTask(taskId)
    return Response.json({ task })
  } catch {
    return Response.json({ error: '未找到任务。' }, { status: 404 })
  }
}

export async function DELETE(_request, { params }) {
  const { taskId } = await params
  try {
    await resetDailyReportTask(taskId)
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: '任务重置失败。' }, { status: 500 })
  }
}