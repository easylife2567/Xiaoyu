import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * v2 Mock 开关 / slice 守护 — 静态断言 + 行为断言。
 * 用源码搜索锁定路由的 mock 开关与 slice 分支不被回退;
 * 用 dynamic import 在配置凭据空时调用 GET(?mock=1) 验证 mock 命中。
 */

const routePath = path.resolve(
  import.meta.dirname,
  '../app/api/public-opinion/overview/route.js',
)
const routeText = readFileSync(routePath, 'utf8')
const mockPath = path.resolve(import.meta.dirname, '../src/public-opinion/mock-payload.js')
const mockText = readFileSync(mockPath, 'utf8')

test('route.js 含 mock=1 query 解析与 PUBLIC_OPINION_MOCK env 检查', () => {
  assert.match(routeText, /searchParams\.get\('mock'\)/)
  assert.match(routeText, /PUBLIC_OPINION_MOCK/)
})

test('route.js 含 slice=latest 分支', () => {
  assert.match(routeText, /searchParams\.get\('slice'\)\s*===\s*'latest'/)
})

test('route.js 在生产环境忽略 mock query', () => {
  // dev 才认 mock query 的实现
  assert.match(routeText, /NODE_ENV\s*!==\s*'production'/)
})

test('mock-payload.js 导出 MOCK_PAYLOAD,字段集合完整', () => {
  assert.match(mockText, /export const MOCK_PAYLOAD/)
  for (const key of [
    'kpis',
    'weeklyTrend',
    'todayHourly',
    'sentimentDistribution',
    'mediaShare',
    'todayPlatformShare',
    'mediaSentimentMatrix',
    'warnings',
    'topHotNews',
    'latestNews',
  ]) {
    assert.match(mockText, new RegExp(key))
  }
})

test('route.js 在未配置时走 GET 返回 configured:false 的静态逻辑', () => {
  // 由于 .env.local 可能已预加载真实凭据,此测试仅做源码静态断言:
  // 确认 route.js 中有 isPublicOpinionConfigured() 检查并能返回 configured:false 分支
  assert.match(routeText, /configured:\s*false/)
  assert.match(routeText, /isPublicOpinionConfigured/)
})

test('GET ?mock=1 在 dev 环境命中 mock(响应携带 mock:true 与 X-Mock 头)', async () => {
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
    const { GET } = await import('../app/api/public-opinion/overview/route.js')
    const res = await GET(new Request('http://test/api/public-opinion/overview?mock=1'))
    assert.equal(res.headers.get('X-Mock'), '1')
    const body = await res.json()
    assert.equal(body.mock, true)
    assert.equal(body.latestNews.length, 30)
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
})

test('GET ?mock=1&slice=latest 只返回 latestNews 分段', async () => {
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
    const { GET } = await import('../app/api/public-opinion/overview/route.js')
    const res = await GET(new Request('http://test/api/public-opinion/overview?mock=1&slice=latest'))
    const body = await res.json()
    assert.ok(Array.isArray(body.latestNews))
    assert.equal(body.latestNews.length, 30)
    assert.equal(body.mock, true)
    // 不应携带 kpis 等其它字段
    assert.equal(body.kpis, undefined)
    assert.equal(body.weeklyTrend, undefined)
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
})

test('GET 在生产环境忽略 ?mock=1 query(无 env 时走真实链路,不返回 mock)', async () => {
  const saved = {
    env: process.env.NODE_ENV,
    mock: process.env.PUBLIC_OPINION_MOCK,
  }
  delete process.env.PUBLIC_OPINION_MOCK
  process.env.NODE_ENV = 'production'
  try {
    const { GET } = await import('../app/api/public-opinion/overview/route.js')
    const res = await GET(new Request('http://test/api/public-opinion/overview?mock=1'))
    // 关键断言:不应携带 mock:true 与 X-Mock 头
    assert.notEqual(res.headers.get('X-Mock'), '1')
    const body = await res.json()
    assert.notEqual(body.mock, true)
  } finally {
    if (saved.env) process.env.NODE_ENV = saved.env
    else delete process.env.NODE_ENV
    if (saved.mock) process.env.PUBLIC_OPINION_MOCK = saved.mock
  }
})
