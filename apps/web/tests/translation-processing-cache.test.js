import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearTranslationWorkbenchCache,
  readTranslationWorkbenchCache,
  writeTranslationWorkbenchCache,
} from '../src/translation-processing-cache.js'

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

test('persists and restores a translation workbench snapshot', () => {
  const storage = createStorage()

  writeTranslationWorkbenchCache(
    {
      id: 'task-123',
      status: 'completed',
      sourceFileName: 'demo.xlsx',
      summary: { processedRows: 165 },
    },
    { storage },
  )

  const cached = readTranslationWorkbenchCache({ storage })
  assert.equal(cached.task.id, 'task-123')
  assert.equal(cached.task.status, 'completed')
  assert.equal(cached.task.summary.processedRows, 165)
})

test('clears cached translation snapshots', () => {
  const storage = createStorage()

  writeTranslationWorkbenchCache({ id: 'task-123', status: 'processing' }, { storage })
  clearTranslationWorkbenchCache({ storage })

  assert.equal(readTranslationWorkbenchCache({ storage }), null)
})

test('ignores malformed cache payloads', () => {
  const storage = createStorage()
  storage.setItem('xiaoyu.workbench.translation-processing.cache', '{not-json')

  assert.equal(readTranslationWorkbenchCache({ storage }), null)
})
