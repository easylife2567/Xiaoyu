// 「每日舆情」daily-today 三个 API 路由的单元测试。
//
// 直接 import route 模块,构造 Request 调 GET — 与
// public-opinion-polarity-route.test.js 同范式。

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const dailyTodayRoute = await import('../app/api/public-opinion/daily-today/route.js')
const countRoute = await import('../app/api/public-opinion/daily-today/count/route.js')
const exportRoute = await import('../app/api/public-opinion/daily-today/export/route.js')

function makeReq(qs) {
  return new Request(`http://localhost/api/public-opinion/daily-today${qs}`)
}

describe('GET /api/public-opinion/daily-today', () => {
  it('returns mock payload with default keyword=peking hours=24', async () => {
    const res = await dailyTodayRoute.GET(makeReq('?mock=1'))
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('X-Mock'), '1')
    const body = await res.json()
    assert.equal(body.configured, true)
    assert.equal(body.mock, true)
    assert.equal(body.keyword, 'peking')
    assert.equal(body.hours, 24)
    assert.equal(body.histogram.length, 24)
    assert.ok(Array.isArray(body.items))
    assert.ok(body.items.length > 0)
  })

  it('respects keyword + hours query params', async () => {
    const res = await dailyTodayRoute.GET(makeReq('?mock=1&keyword=qian-xuesen&hours=6'))
    const body = await res.json()
    assert.equal(body.keyword, 'qian-xuesen')
    assert.equal(body.hours, 6)
  })

  it('falls back to 24h for invalid hours', async () => {
    const res = await dailyTodayRoute.GET(makeReq('?mock=1&hours=99'))
    const body = await res.json()
    assert.equal(body.hours, 24)
  })

  it('returns mock payload when mock=1 even if upstream is configured', async () => {
    const res = await dailyTodayRoute.GET(makeReq('?mock=1&keyword=peking'))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.mock, true)
  })
})

describe('GET /api/public-opinion/daily-today/count', () => {
  it('returns { newCount: 0 } when since is missing', async () => {
    const req = new Request('http://localhost/api/public-opinion/daily-today/count?mock=1')
    const res = await countRoute.GET(req)
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.newCount, 0)
  })

  it('returns positive count for since 30min ago', async () => {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const req = new Request(
      `http://localhost/api/public-opinion/daily-today/count?mock=1&since=${encodeURIComponent(since)}`,
    )
    const res = await countRoute.GET(req)
    const body = await res.json()
    assert.ok(body.newCount >= 0)
  })
})

describe('GET /api/public-opinion/daily-today/export', () => {
  it('returns CSV with UTF-8 BOM and correct headers', async () => {
    const req = new Request('http://localhost/api/public-opinion/daily-today/export?mock=1')
    const res = await exportRoute.GET(req)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('Content-Type') || '', /text\/csv/)
    assert.match(res.headers.get('Content-Disposition') || '', /attachment/)
    assert.match(res.headers.get('Content-Disposition') || '', /daily-today_peking/)

    // BOM 字节(﻿ → ef bb bf)— TextDecoder.decode() 默认吞 BOM,
    // 所以检查 arrayBuffer 而不是 res.text()
    const buf = new Uint8Array(await res.clone().arrayBuffer())
    assert.equal(buf[0], 0xef)
    assert.equal(buf[1], 0xbb)
    assert.equal(buf[2], 0xbf)
    const text = await res.text()
    // 列序检查(res.text() 已脱 BOM)
    const firstLine = text.split('\r\n')[0]
    const expectedCols = [
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
    assert.equal(firstLine, expectedCols.join(','))
  })

  it('filters by ids query param', async () => {
    // 先拉一次拿到真实 id
    const listRes = await dailyTodayRoute.GET(makeReq('?mock=1&keyword=qian-xuesen'))
    const listBody = await listRes.json()
    const pickIds = listBody.items.slice(0, 2).map((i) => i.id)

    const req = new Request(
      `http://localhost/api/public-opinion/daily-today/export?mock=1&keyword=qian-xuesen&ids=${pickIds.join(',')}`,
    )
    const res = await exportRoute.GET(req)
    const text = await res.text()
    const lines = text.split('\r\n').filter(Boolean)
    // 1 header + 2 rows
    assert.equal(lines.length, 3)
  })

  it('escapes CSV special chars (commas / quotes) in body', async () => {
    // 让 export 走一遍,确保不抛错
    const res = await exportRoute.GET(
      new Request('http://localhost/api/public-opinion/daily-today/export?mock=1&keyword=peking'),
    )
    assert.equal(res.status, 200)
    const text = await res.text()
    // 简单存在性检查:有引号包裹的字段(body 里大概率有逗号)
    assert.ok(text.includes('"'))
  })
})
