import { readLatestArtifact } from '../../../../../../lib/translation-processing/service.js'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  const { taskId } = await params
  const latest = await readLatestArtifact(taskId)

  if (!latest) {
    return Response.json({ error: '结果文件尚未生成。' }, { status: 404 })
  }

  return new Response(latest.bytes, {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${latest.artifact.fileName}"`,
    },
  })
}
