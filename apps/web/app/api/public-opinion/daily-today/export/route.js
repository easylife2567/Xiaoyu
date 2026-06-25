// 「每日舆情」daily-today CSV 导出路由 — 与 /api/public-opinion/polarity/export 同范式。
//
//  GET /api/public-opinion/daily-today/export
//    ?keyword=peking
//    &hours=24
//    &ids=peking-0,peking-3,peking-7      // 可选,空则导出全部
//    &mock=1
//
// 行为:
//  - 输出 CSV (UTF-8 BOM),双击 Excel 可解析中文
//  - 列序与 polarity 末尾追加 translation_zh / matched_keyword 两列
//  - 文件名 daily-today_<keyword>_<yyyyMMdd-HHmm>.csv

import { isPublicOpinionConfigured } from '../../../../../src/public-opinion/config.js'
import { buildDailyTodayExportMock } from '../../../../../src/public-opinion/daily-today-mock.js'

export const dynamic = 'force-dynamic'

const CSV_HEADERS = [
  'id',
  'platform',
  'publishedAt',
  'author_handle',
  'author_display_name',
  'body',
  'translation_zh',
  'sentiment',
  'polarity',
  'reposts',
  'likes',
  'replies',
  'source_url',
  'matched_keyword',
]

function csvCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

function toCsv(items) {
  const lines = [CSV_HEADERS.join(',')]
  for (const item of items) {
    lines.push(
      [
        item.id,
        item.platform?.name ?? '',
        item.publishedAt,
        item.author?.handle ?? '',
        item.author?.displayName ?? '',
        item.body,
        item.translation?.zh ?? '',
        item.sentiment,
        item.polarity,
        item.metrics?.reposts ?? 0,
        item.metrics?.likes ?? 0,
        item.metrics?.replies ?? 0,
        item.sourceUrl,
        item.matchedKeyword,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return '\uFEFF' + lines.join('\r\n')
}

function parseFilters(url) {
  const keyword = url.searchParams.get('keyword') || 'peking'
  const hoursRaw = Number(url.searchParams.get('hours'))
  const hours = [6, 12, 24].includes(hoursRaw) ? hoursRaw : 24
  const idsParam = url.searchParams.get('ids')
  const ids = idsParam
    ? idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : null
  return { keyword, hours, ids }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function buildAttachmentHeaders(keyword) {
  const d = new Date()
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  const filename = `daily-today_${keyword}_${ts}.csv`
  const encoded = encodeURIComponent(filename)
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'no-store',
  }
}

export async function GET(req) {
  const url = new URL(req.url)
  const filters = parseFilters(url)

  const mockParam = url.searchParams.get('mock') === '1'
  const mockEnv = process.env.PUBLIC_OPINION_MOCK === '1'
  const isDev = process.env.NODE_ENV !== 'production'
  const mockOn = isDev ? mockParam || !isPublicOpinionConfigured() : mockEnv

  try {
    let items
    if (mockOn || !isPublicOpinionConfigured()) {
      const payload = buildDailyTodayExportMock({
        keyword: filters.keyword,
        hours: filters.hours,
        ids: filters.ids,
      })
      items = payload.items
    } else {
      return Response.json(
        { error: 'real-data-source-not-connected', configured: true },
        { status: 501 },
      )
    }

    const body = toCsv(items)
    return new Response(body, { status: 200, headers: buildAttachmentHeaders(filters.keyword) })
  } catch (error) {
    return Response.json({ error: error?.message ?? '导出失败' }, { status: 500 })
  }
}
