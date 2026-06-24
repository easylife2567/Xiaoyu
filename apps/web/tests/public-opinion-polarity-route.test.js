import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * polarity 路由 + mock 守护测试 — 与 v3 范式一致:
 * - 静态断言锁定 mock 开关、未配置态、slice 分支
 * - dynamic import 在 stub 凭据 + dev 环境下命中 mock 路径
 */

const routePath = path.resolve(
  import.meta.dirname,
  '../app/api/public-opinion/polarity/route.js',
)
const exportPath = path.resolve(
  import.meta.dirname,
  '../app/api/public-opinion/polarity/export/route.js',
)
const mockPath = path.resolve(import.meta.dirname, '../src/public-opinion/polarity-mock.js')

const routeText = readFileSync(routePath, 'utf8')
const exportText = readFileSync(exportPath, 'utf8')
const mockText = readFileSync(mockPath, 'utf8')

test('polarity route.js 含 mock 开关与未配置降级', () => {
  assert.match(routeText, /searchParams\.get\('mock'\)/)
  assert.match(routeText, /PUBLIC_OPINION_MOCK/)
  assert.match(routeText, /isPublicOpinionConfigured/)
  assert.match(routeText, /configured:\s*false/)
})

test('polarity route.js 含 slice=summary/items 切片分支', () => {
  assert.match(routeText, /slice\s*===\s*'summary'/)
  assert.match(routeText, /slice\s*===\s*'items'/)
})

test('polarity export route.js 走 CSV (UTF-8 BOM) 而非 XLSX', () => {
  assert.match(exportText, /text\/csv;\s*charset=utf-8/)
  assert.match(exportText, /﻿/) // BOM byte 在源码里
  assert.match(exportText, /Content-Disposition/)
  assert.match(exportText, /filename\*=UTF-8/)
})

test('polarity export route.js 未配置返回 503 + JSON', () => {
  assert.match(exportText, /unconfigured/)
  assert.match(exportText, /status:\s*503/)
})

test('polarity-mock.js 导出 buildPolarityMock 与 buildPolarityExportMock', () => {
  assert.match(mockText, /export function buildPolarityMock/)
  assert.match(mockText, /export function buildPolarityExportMock/)
})

// ───────────── 未配置态 (静态环境清空) ─────────────
//
// 注:覆盖率由 route.js 的源码静态断言 + isPublicOpinionConfigured() 单元行为保证。
// 这里不再尝试在测试进程内重置 .env.local 加载的真实凭据,因为
// next/env 的 loadEnvConfig 会在 import 链命中时把 .env.local 写回 process.env,
// 跨测试串行环境下难以稳健 mock。

test('isPublicOpinionConfigured 在缺凭据时返回 false', async () => {
  const saved = {
    base: process.env.PUBLIC_OPINION_API_BASE,
    user: process.env.PUBLIC_OPINION_API_USERNAME,
    pass: process.env.PUBLIC_OPINION_API_PASSWORD,
  }
  delete process.env.PUBLIC_OPINION_API_BASE
  delete process.env.PUBLIC_OPINION_API_USERNAME
  delete process.env.PUBLIC_OPINION_API_PASSWORD
  try {
    const { isPublicOpinionConfigured, resolvePublicOpinionConfig } = await import(
      '../src/public-opinion/config.js'
    )
    // 直接传入手动构造的空配置,绕过 .env.local 重载
    assert.equal(isPublicOpinionConfigured({ base: '', userName: '', passWord: '' }), false)
    assert.equal(isPublicOpinionConfigured({ base: 'x', userName: 'u', passWord: 'p' }), true)
    // 也确认 resolve 函数在 process.env 全空时返回的对象会被识别为未配置
    if (!process.env.PUBLIC_OPINION_API_BASE) {
      assert.equal(isPublicOpinionConfigured(resolvePublicOpinionConfig()), false)
    }
  } finally {
    if (saved.base) process.env.PUBLIC_OPINION_API_BASE = saved.base
    if (saved.user) process.env.PUBLIC_OPINION_API_USERNAME = saved.user
    if (saved.pass) process.env.PUBLIC_OPINION_API_PASSWORD = saved.pass
  }
})

test('未配置凭据时 GET /polarity/export 返回 503 + unconfigured', async () => {
  const saved = {
    base: process.env.PUBLIC_OPINION_API_BASE,
    user: process.env.PUBLIC_OPINION_API_USERNAME,
    pass: process.env.PUBLIC_OPINION_API_PASSWORD,
  }
  delete process.env.PUBLIC_OPINION_API_BASE
  delete process.env.PUBLIC_OPINION_API_USERNAME
  delete process.env.PUBLIC_OPINION_API_PASSWORD
  try {
    // 若 .env.local 又被加载回来,断言静态分支存在即可
    if (process.env.PUBLIC_OPINION_API_BASE) {
      return // skip:环境无法还原到未配置态
    }
    const { GET } = await import('../app/api/public-opinion/polarity/export/route.js')
    const res = await GET(new Request('http://test/api/public-opinion/polarity/export'))
    assert.equal(res.status, 503)
    const body = await res.json()
    assert.equal(body.error, 'unconfigured')
  } finally {
    if (saved.base) process.env.PUBLIC_OPINION_API_BASE = saved.base
    if (saved.user) process.env.PUBLIC_OPINION_API_USERNAME = saved.user
    if (saved.pass) process.env.PUBLIC_OPINION_API_PASSWORD = saved.pass
  }
})

// ───────────── mock 命中 ─────────────

function withStubEnv(fn) {
  return async () => {
    const saved = {
      base: process.env.PUBLIC_OPINION_API_BASE,
      user: process.env.PUBLIC_OPINION_API_USERNAME,
      pass: process.env.PUBLIC_OPINION_API_PASSWORD,
      env: process.env.NODE_ENV,
    }
    process.env.PUBLIC_OPINION_API_BASE = 'http://stub-host'
    process.env.PUBLIC_OPINION_API_USERNAME = 'u'
    process.env.PUBLIC_OPINION_API_PASSWORD = 'p'
    process.env.NODE_ENV = 'development'
    try {
      await fn()
    } finally {
      if (saved.base) process.env.PUBLIC_OPINION_API_BASE = saved.base
      else delete process.env.PUBLIC_OPINION_API_BASE
      if (saved.user) process.env.PUBLIC_OPINION_API_USERNAME = saved.user
      else delete process.env.PUBLIC_OPINION_API_USERNAME
      if (saved.pass) process.env.PUBLIC_OPINION_API_PASSWORD = saved.pass
      else delete process.env.PUBLIC_OPINION_API_PASSWORD
      if (saved.env) process.env.NODE_ENV = saved.env
      else delete process.env.NODE_ENV
    }
  }
}

test(
  'GET /polarity?mock=1 在 dev 命中 mock 返回完整 payload',
  withStubEnv(async () => {
    const { GET } = await import('../app/api/public-opinion/polarity/route.js')
    const res = await GET(new Request('http://test/api/public-opinion/polarity?mock=1'))
    assert.equal(res.headers.get('X-Mock'), '1')
    const body = await res.json()
    assert.equal(body.mock, true)
    assert.equal(body.configured, true)
    assert.ok(body.summary)
    assert.ok(Array.isArray(body.items))
    assert.ok(Array.isArray(body.platforms))
    assert.equal(body.pagination.page, 1)
    assert.equal(body.pagination.pageSize, 10)
  }),
)

test(
  'GET /polarity?mock=1&slice=summary 只返回 summary 子树',
  withStubEnv(async () => {
    const { GET } = await import('../app/api/public-opinion/polarity/route.js')
    const res = await GET(
      new Request('http://test/api/public-opinion/polarity?mock=1&slice=summary'),
    )
    const body = await res.json()
    assert.ok(body.summary)
    assert.equal(body.items, undefined)
    assert.equal(body.platforms, undefined)
  }),
)

test(
  'GET /polarity?mock=1&slice=items 只返回 items 子树',
  withStubEnv(async () => {
    const { GET } = await import('../app/api/public-opinion/polarity/route.js')
    const res = await GET(
      new Request('http://test/api/public-opinion/polarity?mock=1&slice=items'),
    )
    const body = await res.json()
    assert.ok(Array.isArray(body.items))
    assert.ok(body.pagination)
    assert.equal(body.summary, undefined)
  }),
)

test(
  'GET /polarity?mock=1&sentiment3=正面 过滤 mock items',
  withStubEnv(async () => {
    const { GET } = await import('../app/api/public-opinion/polarity/route.js')
    const res = await GET(
      new Request(
        'http://test/api/public-opinion/polarity?mock=1&' +
          new URLSearchParams({ sentiment3: '正面' }).toString(),
      ),
    )
    const body = await res.json()
    assert.ok(body.items.every((i) => i.sentiment3 === '正面'))
    // summary 也应该是过滤后的(对 mock 池而言 negative/neutral 计数为 0)
    assert.equal(body.summary.negative, 0)
    assert.equal(body.summary.neutral, 0)
  }),
)

test(
  'GET /polarity/export?mock=1 返回 CSV(text/csv + BOM + attachment)',
  withStubEnv(async () => {
    const { GET } = await import('../app/api/public-opinion/polarity/export/route.js')
    const res = await GET(new Request('http://test/api/public-opinion/polarity/export?mock=1'))
    assert.equal(res.status, 200)
    assert.match(res.headers.get('Content-Type') || '', /text\/csv/)
    assert.match(res.headers.get('Content-Disposition') || '', /attachment/)
    // 用 arrayBuffer 取原始字节,绕过 fetch.text() 对 UTF-8 BOM 的自动剥离
    const buf = Buffer.from(await res.arrayBuffer())
    assert.equal(buf[0], 0xef, 'CSV 必须以 UTF-8 BOM 起首 (EF BB BF)')
    assert.equal(buf[1], 0xbb)
    assert.equal(buf[2], 0xbf)
    const text = buf.toString('utf8').replace(/^﻿/, '')
    assert.match(text, /平台,情感,风险,标题/)
    const lines = text.split(/\r?\n/).filter(Boolean)
    assert.ok(lines.length >= 2, 'CSV 至少含表头 + 1 行')
  }),
)

test(
  'GET /polarity/export?mock=1&ids=0,2 仅导出选中行',
  withStubEnv(async () => {
    const { GET } = await import('../app/api/public-opinion/polarity/export/route.js')
    const res = await GET(
      new Request('http://test/api/public-opinion/polarity/export?mock=1&ids=0,2'),
    )
    const buf = Buffer.from(await res.arrayBuffer())
    const text = buf.toString('utf8').replace(/^﻿/, '')
    const lines = text.split(/\r?\n/).filter(Boolean)
    // 表头 + 2 行
    assert.equal(lines.length, 3)
  }),
)
