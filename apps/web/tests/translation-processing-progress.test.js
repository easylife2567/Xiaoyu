import assert from 'node:assert/strict'
import test from 'node:test'
import { getRecentRuntimeEvents, getTranslationWorkflowState } from '../src/translation-processing-progress.js'

test('builds a live workflow model from in-flight task progress', () => {
  const workflow = getTranslationWorkflowState({
    status: 'processing',
    validation: { sourceRows: 165 },
    progress: {
      totalRows: 165,
      completedRows: 40,
      totalBatches: 9,
      completedBatches: 2,
      currentActivity: '正在处理 DFY官方 第 41-60 行批次',
      activeBatches: [
        { sheet: 'DFY官方', batchIndex: 3, startRow: 41, endRow: 60 },
        { sheet: 'DFY官方', batchIndex: 4, startRow: 61, endRow: 80 },
      ],
      updatedAt: '2026-05-20T12:00:00.000Z',
    },
  })

  assert.equal(workflow.completedRows, 40)
  assert.equal(workflow.remainingRows, 125)
  assert.equal(workflow.activeBatches.length, 2)
  assert.equal(workflow.liveBadge, '实时处理中')
  assert.equal(workflow.steps[2].state, 'current')
  assert.ok(workflow.percentage > 30)
})

test('combines persisted and live runtime events without duplication', () => {
  const createdAt = '2026-05-20T12:00:00.000Z'
  const events = getRecentRuntimeEvents({
    events: [{ type: 'task_created', createdAt, detail: {} }],
    attempts: [{ events: [{ type: 'attempt_started', createdAt, detail: {} }] }],
    progress: {
      events: [
        { type: 'attempt_started', createdAt, detail: {} },
        { type: 'ai_batch_started', createdAt: '2026-05-20T12:01:00.000Z', detail: { sheet: 'DFY官方', startRow: 2, endRow: 21 } },
      ],
    },
  })

  assert.equal(events.length, 3)
  assert.equal(events.at(-1).type, 'ai_batch_started')
})
