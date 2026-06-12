import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWorkbenchSessionCacheKey,
  clearWorkbenchSessionCache,
  readWorkbenchSessionCache,
  writeWorkbenchSessionCache,
} from '../src/workbench-session-cache.js'

function createStorage() {
  const state = new Map()
  return {
    getItem(key) {
      return state.has(key) ? state.get(key) : null
    },
    setItem(key, value) {
      state.set(key, value)
    },
    removeItem(key) {
      state.delete(key)
    },
  }
}

test('builds stable per-workbench cache keys', () => {
  assert.equal(
    buildWorkbenchSessionCacheKey('translation-processing'),
    'xiaoyu.workbench.session.translation-processing',
  )
})

test('persists workbench snapshots by slug', () => {
  const storage = createStorage()

  writeWorkbenchSessionCache(
    'translation-processing',
    {
      task: { id: 'task-123', status: 'processing' },
    },
    { storage },
  )

  const cached = readWorkbenchSessionCache('translation-processing', { storage })
  assert.equal(cached.slug, 'translation-processing')
  assert.equal(cached.snapshot.task.id, 'task-123')
})

test('keeps different workbenches isolated', () => {
  const storage = createStorage()

  writeWorkbenchSessionCache('translation-processing', { task: { id: 'task-a' } }, { storage })
  writeWorkbenchSessionCache('international-daily-report', { selectedIds: ['news-1'] }, { storage })

  const translation = readWorkbenchSessionCache('translation-processing', { storage })
  const report = readWorkbenchSessionCache('international-daily-report', { storage })

  assert.equal(translation.snapshot.task.id, 'task-a')
  assert.deepEqual(report.snapshot.selectedIds, ['news-1'])
})

test('clears one workbench cache without touching others', () => {
  const storage = createStorage()

  writeWorkbenchSessionCache('translation-processing', { task: { id: 'task-a' } }, { storage })
  writeWorkbenchSessionCache('international-daily-report', { selectedIds: ['news-1'] }, { storage })
  clearWorkbenchSessionCache('translation-processing', { storage })

  assert.equal(readWorkbenchSessionCache('translation-processing', { storage }), null)
  assert.deepEqual(
    readWorkbenchSessionCache('international-daily-report', { storage }).snapshot.selectedIds,
    ['news-1'],
  )
})
