import { loadRuntimeEnv } from '../runtime-env.js'

// 舆情看板运行时配置 — 经 @next/env 从仓库根加载 .env.local。
// 凭据(服务账号用户名/密码)仅在服务端读取,绝不下发浏览器。
loadRuntimeEnv()

export function resolvePublicOpinionConfig() {
  const base = process.env.PUBLIC_OPINION_API_BASE
  const userName = process.env.PUBLIC_OPINION_API_USERNAME
  const passWord = process.env.PUBLIC_OPINION_API_PASSWORD
  return { base, userName, passWord }
}

export function isPublicOpinionConfigured(config = resolvePublicOpinionConfig()) {
  return Boolean(config.base && config.userName && config.passWord)
}
