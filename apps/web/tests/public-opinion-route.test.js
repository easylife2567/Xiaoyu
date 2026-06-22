import assert from 'node:assert/strict'
import test from 'node:test'
import { GET } from '../app/api/public-opinion/overview/route.js'

/**
 * BFF 路由测试 — 只验证「未配置」降级路径,避免单测触网打真实 API。
 * 聚合 + 单组件降级逻辑由 public-opinion-overview.test.js 的 aggregateOverview 覆盖。
 */

test('未配置凭据时 GET 返回 configured:false 且 HTTP 200', async () => {
  const saved = {
    base: process.env.PUBLIC_OPINION_API_BASE,
    user: process.env.PUBLIC_OPINION_API_USERNAME,
    pass: process.env.PUBLIC_OPINION_API_PASSWORD,
  }
  delete process.env.PUBLIC_OPINION_API_BASE
  delete process.env.PUBLIC_OPINION_API_USERNAME
  delete process.env.PUBLIC_OPINION_API_PASSWORD
  try {
    const res = await GET(new Request('http://test/api/public-opinion/overview'))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.deepEqual(body, { configured: false })
  } finally {
    if (saved.base) process.env.PUBLIC_OPINION_API_BASE = saved.base
    if (saved.user) process.env.PUBLIC_OPINION_API_USERNAME = saved.user
    if (saved.pass) process.env.PUBLIC_OPINION_API_PASSWORD = saved.pass
  }
})
