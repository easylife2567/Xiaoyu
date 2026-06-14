import { saveSectionEdit } from '../../../../../../../../../lib/daily-report/service.js'
import { getDailyReportTask } from '../../../../../../../../../lib/daily-report/service.js'

export const runtime = 'nodejs'

export async function PATCH(request, { params }) {
  const { taskId, versionId, index } = await params
  const sectionIndex = Number.parseInt(index, 10)
  if (Number.isNaN(sectionIndex) || sectionIndex < 1) {
    return Response.json({ error: 'index 必须是正整数。' }, { status: 400 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求体不是合法 JSON。' }, { status: 400 })
  }

  const { title, body: sectionBody } = body ?? {}
  if (typeof title !== 'string' || typeof sectionBody !== 'string') {
    return Response.json({ error: '需要提供 title 与 body 字符串。' }, { status: 400 })
  }

  try {
    const task = await getDailyReportTask(taskId)
    const targetVersion = task.draftVersions.find((v) => v.id === versionId)
    if (!targetVersion) {
      return Response.json({ error: '未找到指定草稿版本。' }, { status: 404 })
    }

    const updatedSections = targetVersion.sections.map((section) =>
      section.index === sectionIndex
        ? { ...section, title: title.trim(), body: sectionBody.trim() }
        : section,
    )

    const next = await saveSectionEdit(taskId, { sections: updatedSections })
    return Response.json({ task: next })
  } catch (error) {
    const status = error?.code === 'invalid_task_state' ? 409 : 500
    return Response.json(
      { error: error?.message ?? '编辑保存失败。', code: error?.code ?? 'unknown_error' },
      { status },
    )
  }
}