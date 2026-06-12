import assert from 'node:assert/strict'
import test from 'node:test'
import { formatRuntimeEvent, summarizeFailure } from '../src/translation-processing-log.js'

test('summarizes a recent real-world failure shape as timeout-aware stoppage', () => {
  const summary = summarizeFailure({
    failure: {
      category: 'timeout',
      message: 'AI 摘要生成失败：模型调用超时，请稍后重试。',
    },
    attempts: [
      {
        aiCalls: [
          { sheet: 'DFY官方', row: 2, status: 'succeeded' },
          { sheet: 'DFY官方', row: 3, status: 'succeeded' },
          { sheet: 'DFY官方', row: 4, status: 'failed', failureCategory: 'timeout' },
        ],
      },
    ],
  })

  assert.equal(summary.title, '模型调用超时')
  assert.equal(summary.detail, '最近成功处理到 DFY官方 第 3 行，随后在第 4 行超时。')
})

test('summarizes batch failure shapes with batch scope', () => {
  const summary = summarizeFailure({
    failure: {
      category: 'provider_error',
      message: 'AI 摘要生成失败：模型服务暂时不可用，请稍后重试。',
    },
    attempts: [
      {
        aiCalls: [
          { sheet: 'DFY官方', batchStartRow: 2, batchEndRow: 21, status: 'succeeded' },
          { sheet: 'DFY官方', batchStartRow: 22, batchEndRow: 41, status: 'failed', failureCategory: 'provider_error' },
        ],
      },
    ],
  })

  assert.equal(summary.title, '模型服务异常')
  assert.equal(summary.detail, '最近成功处理到 DFY官方 第 2-21 行批次，随后在 DFY官方 第 22-41 行批次失败。')
})

test('formats batch fallback runtime events', () => {
  assert.equal(
    formatRuntimeEvent({
      type: 'ai_batch_fallback_started',
      detail: { sheet: 'DFY官方', startRow: 22, endRow: 41 },
    }),
    '开始降级处理 DFY官方 第 22-41 行批次',
  )
})

test('formats sensitive fallback runtime events', () => {
  assert.equal(
    formatRuntimeEvent({
      type: 'sensitive_content_downgraded',
      detail: { sheet: 'DFY官方', row: 41 },
    }),
    'DFY官方 第 41 行命中敏感规则，已降级为模板摘要',
  )
})
