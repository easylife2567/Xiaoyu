// 「每日舆情」daily-today 新数据增量计数路由。
//
//  GET /api/public-opinion/daily-today/count
//    ?keyword=peking
//    &hours=24
//    &since=<ISO>
//    &mock=1
//
// 返回 { newCount: number }。
//
// 90s 心跳调用入口 — 前端配合"↑ N 条新条目"横条。
// 失败语义:500 + { error }。

import { isPublicOpinionConfigured } from '../../../../../src/public-opinion/config.js'
import { buildDailyTodayCountMock } from '../../../../../src/public-opinion/daily-today-mock.js'

export const dynamic = 'force-dynamic'

function parseFilters(url) {
  const keyword = url.searchParams.get('keyword') || 'peking'
  const hoursRaw = Number(url.searchParams.get('hours'))
  const hours = [6, 12, 24].includes(hoursRaw) ? hoursRaw : 24
  const since = url.searchParams.get('since') || null
  return { keyword, hours, since }
}

export async function GET(req) {
  const url = new URL(req.url)
  const filters = parseFilters(url)

  const mockParam = url.searchParams.get('mock') === '1'
  const mockEnv = process.env.PUBLIC_OPINION_MOCK === '1'
  const isDev = process.env.NODE_ENV !== 'production'
  const mockOn = isDev ? mockParam || !isPublicOpinionConfigured() : mockEnv

  if (mockOn || !isPublicOpinionConfigured()) {
    const payload = buildDailyTodayCountMock(filters)
    return Response.json(payload, { headers: { 'X-Mock': '1' } })
  }

  return Response.json(
    { error: 'real-data-source-not-connected', configured: true },
    { status: 501 },
  )
}
