const CACHE_VERSION = 1
const CACHE_NAMESPACE = 'xiaoyu.workbench.session'

function resolveStorage(storage) {
  if (storage) {
    return storage
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return null
  }

  return window.localStorage
}

export function buildWorkbenchSessionCacheKey(slug) {
  return `${CACHE_NAMESPACE}.${slug}`
}

export function readWorkbenchSessionCache(slug, { storage } = {}) {
  const target = resolveStorage(storage)
  if (!target || !slug) {
    return null
  }

  try {
    const raw = target.getItem(buildWorkbenchSessionCacheKey(slug))
    if (!raw) {
      return null
    }

    const payload = JSON.parse(raw)
    if (payload?.version !== CACHE_VERSION || payload?.slug !== slug || payload?.snapshot == null) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export function writeWorkbenchSessionCache(slug, snapshot, { storage } = {}) {
  const target = resolveStorage(storage)
  if (!target || !slug || snapshot == null) {
    return
  }

  const payload = {
    version: CACHE_VERSION,
    slug,
    cachedAt: new Date().toISOString(),
    snapshot,
  }

  target.setItem(buildWorkbenchSessionCacheKey(slug), JSON.stringify(payload))
}

export function clearWorkbenchSessionCache(slug, { storage } = {}) {
  const target = resolveStorage(storage)
  if (!target || !slug) {
    return
  }

  target.removeItem(buildWorkbenchSessionCacheKey(slug))
}
