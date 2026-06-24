// 「正负面舆情」聚合路由 — 与 /api/public-opinion/overview 同范式。
//
//  GET /api/public-opinion/polarity
//    ?sentiment3=全部|正面|中立|负面
//    &platform=全部|<平台名>
//    &start=YYYY-MM-DD&end=YYYY-MM-DD
//    &page=1&pageSize=10
//    &slice=summary|items   // 可选切片,不传则返回全部
//    &mock=1                // 仅 dev 直通;prod 看 PUBLIC_OPINION_MOCK=1
//
// 失败语义:
//  - 未配置 → 200 + { configured: false }
//  - 上游单 widget 失败 → 200 + 该字段 null + errors[key]
//  - 路由内部异常 → 500 + { error }

import { aggregatePolarity } from '../../../../src/public-opinion/polarity.js'
import { createAsmxClient } from '../../../../src/public-opinion/asmx-client.js'
import { isPublicOpinionConfigured } from '../../../../src/public-opinion/config.js'

export const dynamic = 'force-dynamic'

function parseFilters(url) {
  return {
    sentiment3: url.searchParams.get('sentiment3') || '全部',
    platform: url.searchParams.get('platform') || '全部',
    page: Number(url.searchParams.get('page')) || 1,
    pageSize: Number(url.searchParams.get('pageSize')) || 10,
    range: {
      start: url.searchParams.get('start') || undefined,
      end: url.searchParams.get('end') || undefined,
    },
    slice: url.searchParams.get('slice') || null,
  }
}

function applySlice(payload, slice) {
  if (slice === 'summary') {
    return { configured: payload.configured, range: payload.range, summary: payload.summary, errors: payload.errors }
  }
  if (slice === 'items') {
    return {
      configured: payload.configured,
      range: payload.range,
      items: payload.items,
      pagination: payload.pagination,
      errors: payload.errors,
    }
  }
  return payload
}

export async function GET(req) {
  if (!isPublicOpinionConfigured()) {
    return Response.json({ configured: false })
  }

  const url = new URL(req.url)
  const filters = parseFilters(url)

  const mockParam = url.searchParams.get('mock') === '1'
  const mockEnv = process.env.PUBLIC_OPINION_MOCK === '1'
  const isDev = process.env.NODE_ENV !== 'production'
  const mockOn = isDev ? mockParam : mockEnv

  if (mockOn) {
    const { buildPolarityMock } = await import('../../../../src/public-opinion/polarity-mock.js')
    const payload = buildPolarityMock(filters)
    return Response.json(applySlice(payload, filters.slice), { headers: { 'X-Mock': '1' } })
  }

  try {
    const payload = await aggregatePolarity(createAsmxClient(), filters)
    return Response.json(applySlice(payload, filters.slice))
  } catch (error) {
    return Response.json({ error: error?.message ?? '聚合失败' }, { status: 500 })
  }
}
