import {
  clearWorkbenchSessionCache,
  readWorkbenchSessionCache,
  writeWorkbenchSessionCache,
} from './workbench-session-cache.js'

const WORKBENCH_SLUG = 'translation-processing'

export function readTranslationWorkbenchCache({ storage } = {}) {
  const payload = readWorkbenchSessionCache(WORKBENCH_SLUG, { storage })
  if (!payload?.snapshot?.task?.id) {
    return null
  }

  return {
    version: payload.version,
    cachedAt: payload.cachedAt,
    task: payload.snapshot.task,
  }
}

export function writeTranslationWorkbenchCache(task, { storage } = {}) {
  if (!task?.id) {
    return
  }

  writeWorkbenchSessionCache(
    WORKBENCH_SLUG,
    {
      task,
    },
    { storage },
  )
}

export function clearTranslationWorkbenchCache({ storage } = {}) {
  clearWorkbenchSessionCache(WORKBENCH_SLUG, { storage })
}
