import { createTranslationTask } from '../../../../lib/translation-processing/service.js'

export const runtime = 'nodejs'

export async function POST(request) {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return Response.json({ error: '请先上传原始 Excel 文件。' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const task = await createTranslationTask({ fileName: file.name, buffer })
    return Response.json({ task }, { status: 201 })
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : '文件上传失败。',
        code: error?.code,
      },
      { status: 400 },
    )
  }
}
