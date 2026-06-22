import { aggregateOverview } from '../../../../src/public-opinion/overview.js'
import { createAsmxClient } from '../../../../src/public-opinion/asmx-client.js'
import { isPublicOpinionConfigured } from '../../../../src/public-opinion/config.js'

export const dynamic = 'force-dynamic'

export async function GET(req) {
  if (!isPublicOpinionConfigured()) {
    return Response.json({ configured: false })
  }

  const url = new URL(req.url)
  const mockParam = url.searchParams.get('mock') === '1'
  const mockEnv = process.env.PUBLIC_OPINION_MOCK === '1'
  const isDev = process.env.NODE_ENV !== 'production'
  const mockOn = isDev ? mockParam : mockEnv

  if (mockOn) {
    const { MOCK_PAYLOAD } = await import('../../../../src/public-opinion/mock-payload.js')
    if (url.searchParams.get('slice') === 'latest') {
      return Response.json({ latestNews: MOCK_PAYLOAD.latestNews, mock: true })
    }
    return Response.json(MOCK_PAYLOAD, { headers: { 'X-Mock': '1' } })
  }

  // slice=latest 只拉信息流,跳过其余聚合
  if (url.searchParams.get('slice') === 'latest') {
    const { OVERVIEW_WIDGETS } = await import('../../../../src/public-opinion/overview.js')
    const client = createAsmxClient()
    const ctx = await import('../../../../src/public-opinion/overview.js').then(
      (m) => m.buildOverviewContext(),
    )
    const latestNews = await OVERVIEW_WIDGETS.latestNews(client, ctx)
    return Response.json({ latestNews })
  }

  const payload = await aggregateOverview(createAsmxClient())
  return Response.json(payload)
}
