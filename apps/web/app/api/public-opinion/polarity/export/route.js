// 「正负面舆情」CSV 导出路由。
//
//  GET /api/public-opinion/polarity/export
//    ?sentiment3=&platform=&start=&end=&ids=0,3,7
//
// 行为:
//  - 复用 aggregatePolarity,pageSize=10000 单次拉满 (MVP 上限)
//  - 输出 CSV (UTF-8 BOM),双击 Excel 即可解析中文
//  - 失败 → 503/500 + application/json {error},前端可据此弹错
//  - ids 子集导出 (基于全量数组下标),供"勾选下载所选"路径

import { aggregatePolarity } from '../../../../../src/public-opinion/polarity.js'
import { createAsmxClient } from '../../../../../src/public-opinion/asmx-client.js'
import { isPublicOpinionConfigured } from '../../../../../src/public-opinion/config.js'

export const dynamic = 'force-dynamic'

const CSV_HEADERS = ['平台', '情感', '风险', '标题', '关键词', '发布时间', '链接']

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
        item.platform,
        item.sentiment3,
        item.risk ? '是' : '否',
        item.title,
        item.keyword,
        item.pubTime,
        item.url,
      ]
        .map(csvCell)
        .join(','),
    )
  }
  return '﻿' + lines.join('\r\n')
}

function parseFilters(url) {
  const ids = url.searchParams.get('ids')
  return {
    sentiment3: url.searchParams.get('sentiment3') || '全部',
    platform: url.searchParams.get('platform') || '全部',
    range: {
      start: url.searchParams.get('start') || undefined,
      end: url.searchParams.get('end') || undefined,
    },
    ids: ids
      ? ids
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null,
  }
}

function buildAttachmentHeaders(range) {
  const filename = `正负面舆情_${range.start}_${range.end}.csv`
  const encoded = encodeURIComponent(filename)
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`,
    'Cache-Control': 'no-store',
  }
}

export async function GET(req) {
  if (!isPublicOpinionConfigured()) {
    return Response.json({ error: 'unconfigured' }, { status: 503 })
  }

  const url = new URL(req.url)
  const filters = parseFilters(url)

  const mockParam = url.searchParams.get('mock') === '1'
  const mockEnv = process.env.PUBLIC_OPINION_MOCK === '1'
  const isDev = process.env.NODE_ENV !== 'production'
  const mockOn = isDev ? mockParam : mockEnv

  try {
    let items
    let range
    if (mockOn) {
      const { buildPolarityExportMock } = await import(
        '../../../../../src/public-opinion/polarity-mock.js'
      )
      const payload = buildPolarityExportMock({
        sentiment3: filters.sentiment3,
        platform: filters.platform,
        ids: filters.ids,
        range: filters.range.start && filters.range.end ? filters.range : undefined,
      })
      items = payload.items
      range = payload.range
    } else {
      const payload = await aggregatePolarity(createAsmxClient(), {
        sentiment3: filters.sentiment3,
        platform: filters.platform,
        page: 1,
        pageSize: 10000,
        range: filters.range,
      })
      items = payload.items
      range = payload.range
      if (filters.ids && filters.ids.length) {
        const idSet = new Set(filters.ids)
        items = items.filter((_, i) => idSet.has(String(i)))
      }
    }

    const body = toCsv(items)
    return new Response(body, { status: 200, headers: buildAttachmentHeaders(range) })
  } catch (error) {
    return Response.json({ error: error?.message ?? '导出失败' }, { status: 500 })
  }
}
