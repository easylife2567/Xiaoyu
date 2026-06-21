import { resolvePublicOpinionConfig } from './config.js'

const DEFAULT_TIMEOUT_MS = 10_000

function formBody(params) {
  const usp = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    usp.set(key, value == null ? '' : String(value))
  }
  return usp.toString()
}

function extractSessionId(res) {
  // undici 暴露 getSetCookie();回退到合并的 set-cookie 头
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const joined = cookies.length ? cookies.join('; ') : res.headers.get('set-cookie') || ''
  const match = joined.match(/ASP\.NET_SessionId=[^;]+/)
  return match ? match[0] : null
}

/**
 * 创建一个舆情 ASMX 接入 client。
 *
 * - 表单编码 POST(JSON content-type 会被 .NET ScriptService 拒绝)。
 * - 会话式鉴权:首次调用前 login 取 ASP.NET_SessionId + token,二者一并随请求发送。
 * - 鉴权失败(code:2 / getSiteName 抛错)时自动重登一次再重试。
 * - 凭据仅存于服务端闭包,绝不下发浏览器。
 */
export function createAsmxClient(options = {}) {
  const config = options.config ?? resolvePublicOpinionConfig()
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const { base, userName, passWord } = config

  let session = null // { cookie, token }

  async function post(endpoint, params, cookie) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetchImpl(base + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: formBody(params),
        signal: controller.signal,
      })
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  async function login() {
    const res = await post('login', { userName, passWord })
    const text = await res.text()
    let body
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`舆情登录响应非 JSON(HTTP ${res.status})`)
    }
    const sessionId = extractSessionId(res)
    if (body?.code !== 0 || !body?.token || !sessionId) {
      throw new Error(`舆情登录失败:${body?.message || `code=${body?.code}`}`)
    }
    session = { cookie: `${sessionId}; userName=${userName}`, token: body.token }
    return session
  }

  async function ensureSession() {
    if (!session) {
      await login()
    }
    return session
  }

  function isAuthFailure(httpStatus, body) {
    // 会话失效表现:数据接口返回 code:2 失败,或 getSiteName 解析不出站点抛 500
    return httpStatus === 500 || body?.code === 2
  }

  async function callOnce(endpoint, params) {
    const current = await ensureSession()
    const res = await post(endpoint, { token: current.token, ...params }, current.cookie)
    const text = await res.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      // 非 JSON(通常是 .NET 500 错误页)→ 视为鉴权/服务端异常
    }
    return { httpStatus: res.status, body, raw: text }
  }

  /**
   * 调用一个数据接口,返回成功信封的 `data`。
   * 鉴权失败时自动重登一次重试;最终失败抛错。
   */
  async function call(endpoint, params = {}) {
    let result = await callOnce(endpoint, params)
    if (isAuthFailure(result.httpStatus, result.body)) {
      session = null
      await login()
      result = await callOnce(endpoint, params)
    }
    const { httpStatus, body, raw } = result
    if (body?.code === 0) {
      return body.data
    }
    const detail = body?.message || `HTTP ${httpStatus}` || raw.slice(0, 120)
    throw new Error(`舆情接口 ${endpoint} 调用失败:${detail}`)
  }

  return { call, login, ensureSession, get session() { return session } }
}
