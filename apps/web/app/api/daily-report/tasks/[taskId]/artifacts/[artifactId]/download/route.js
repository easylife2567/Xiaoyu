import { getDailyReportTask, readArtifactBytes } from '../../../../../../../../lib/daily-report/service.js'

export const runtime = 'nodejs'

const MIME_BY_KIND = {
  docx_report: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  resource_pool_xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export async function GET(_request, { params }) {
  const { taskId, artifactId } = await params

  let task
  try {
    task = await getDailyReportTask(taskId)
  } catch {
    return Response.json({ error: '未找到任务。' }, { status: 404 })
  }

  const artifact = task.artifacts.find((a) => a.id === artifactId)
  if (!artifact) {
    return Response.json({ error: '未找到产物。' }, { status: 404 })
  }

  try {
    const bytes = await readArtifactBytes(artifact.objectKey)
    return new Response(bytes, {
      headers: {
        'content-type': MIME_BY_KIND[artifact.kind] ?? 'application/octet-stream',
        'content-disposition': `attachment; filename="${encodeURIComponent(artifact.fileName)}"`,
      },
    })
  } catch (error) {
    return Response.json(
      { error: error?.message ?? '下载失败。', code: error?.code ?? 'unknown_error' },
      { status: 500 },
    )
  }
}