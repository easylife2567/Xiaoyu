// 「每日舆情」daily-today 聚合路由 — 与 /api/public-opinion/polarity 同范式。
//
//  GET /api/public-opinion/daily-today
//    ?keyword=peking|belt-and-road|...
//    &hours=6|12|24
//    &mock=1                // 仅 dev 直通;prod 看 PUBLIC_OPINION_MOCK=1
//
// 失败语义:
//  - 未配置 → 200 + { configured: false }
//  - 上游异常 → 500 + { error }
//
// 本期(MVP)实际仅走 Mock,真实 BFF 接入是下一期。

import { isPublicOpinionConfigured } from '../../../../src/public-opinion/config.js'
import { buildDailyTodayMock } from '../../../../src/public-opinion/daily-today-mock.js'

export const dynamic = 'force-dynamic'

function parseFilters(url) {
  const keyword = url.searchParams.get('keyword') || 'peking'
  const hoursRaw = Number(url.searchParams.get('hours'))
  const hours = [6, 12, 24].includes(hoursRaw) ? hoursRaw : 24
  return { keyword, hours }
}

export async function GET(req) {
  const url = new URL(req.url)
  const filters = parseFilters(url)

  const mockParam = url.searchParams.get('mock') === '1'
  const mockEnv = process.env.PUBLIC_OPINION_MOCK === '1'
  const isDev = process.env.NODE_ENV !== 'production'
  const mockOn = isDev ? mockParam || !isPublicOpinionConfigured() : mockEnv

  // MVP:无论是否配置上游,只要不主动指定真实数据源就走 Mock。
  // 真实 BFF 接入是下一期 — 那时 mockOn=false 走 aggregateDailyToday(...)。
  if (mockOn || !isPublicOpinionConfigured()) {
    const payload = buildDailyTodayMock(filters)
    return Response.json(payload, { headers: { 'X-Mock': '1' } })
  }

  // 真实 BFF 占位 — 下一期实现 aggregateDailyToday。
  return Response.json(
    { error: 'real-data-source-not-connected', configured: true },
    { status: 501 },
  )
}
