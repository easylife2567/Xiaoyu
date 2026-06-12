import assert from 'node:assert/strict'
import test from 'node:test'
import { diagnoseTranslationTask } from '../src/translation-processing-diagnostics.js'

test('diagnoses timeout failures with row-level recovery suggestions', () => {
  const diagnostics = diagnoseTranslationTask({
    status: 'failed',
    failure: {
      category: 'timeout',
      message: 'AI 摘要生成失败：模型调用超时，请稍后重试。',
    },
    attempts: [
      {
        aiCalls: [
          { sheet: 'DFY官方', row: 40, status: 'succeeded' },
          { sheet: 'DFY官方', row: 41, status: 'failed', failureCategory: 'timeout', retryCount: 2 },
        ],
      },
    ],
  })

  assert.equal(diagnostics.status, 'failed')
  assert.equal(diagnostics.failurePoint.scope, 'DFY官方 第 41 行')
  assert.match(diagnostics.headline, /模型调用超时/)
  assert.ok(diagnostics.suggestions.some((item) => item.includes('XIAOYU_AI_TIMEOUT_SECONDS')))
  assert.ok(diagnostics.suggestions.some((item) => item.includes('XIAOYU_AI_MAX_CONCURRENCY')))
})

test('diagnoses batch-level rate limiting with throughput suggestions', () => {
  const diagnostics = diagnoseTranslationTask({
    status: 'failed',
    failure: {
      category: 'rate_limited',
      message: 'AI 摘要生成失败：模型触发限流，请稍后重试。',
    },
    attempts: [
      {
        aiCalls: [
          {
            sheet: 'DFY官方',
            batchStartRow: 22,
            batchEndRow: 41,
            status: 'failed',
            failureCategory: 'rate_limited',
            retryCount: 1,
            httpStatus: 429,
          },
        ],
      },
    ],
  })

  assert.equal(diagnostics.failurePoint.scope, 'DFY官方 第 22-41 行批次')
  assert.ok(diagnostics.suggestions.some((item) => item.includes('XIAOYU_AI_MAX_CONCURRENCY')))
  assert.ok(diagnostics.suggestions.some((item) => item.includes('XIAOYU_AI_BATCH_SIZE')))
})

test('diagnoses missing openpyxl dependency as environment issue', () => {
  const diagnostics = diagnoseTranslationTask({
    status: 'failed',
    failure: {
      category: 'provider_error',
      code: 'unexpected_worker_failure',
      message: "Command failed: ... ModuleNotFoundError: No module named 'openpyxl'",
    },
    attempts: [{ aiCalls: [] }],
  })

  assert.equal(diagnostics.failurePoint.type, 'environment')
  assert.ok(diagnostics.suggestions.some((item) => item.includes('openpyxl')))
  assert.ok(diagnostics.suggestions.some((item) => item.includes('重新启动开发服务')))
})

test('reports completed tasks as healthy', () => {
  const diagnostics = diagnoseTranslationTask({
    status: 'completed',
    summary: { processedRows: 165 },
    attempts: [{ aiCalls: [] }],
  })

  assert.equal(diagnostics.status, 'healthy')
  assert.match(diagnostics.headline, /任务已完成/)
  assert.equal(diagnostics.suggestions.length, 0)
})

test('reports downgraded sensitive rows as completed with manual review guidance', () => {
  const diagnostics = diagnoseTranslationTask({
    status: 'completed',
    summary: {
      processedRows: 10,
      issueCount: 1,
      issues: [
        {
          sheet: 'DFY官方',
          row: 41,
          code: 'sensitive_content_fallback',
          message: '该行命中敏感内容规则，已使用模板摘要并建议人工复核。',
        },
      ],
    },
    attempts: [{ aiCalls: [] }],
  })

  assert.equal(diagnostics.status, 'completed_with_review')
  assert.match(diagnostics.headline, /人工复核/)
  assert.equal(diagnostics.failurePoint.scope, 'DFY官方 第 41 行')
  assert.ok(diagnostics.suggestions.some((item) => item.includes('人工复核')))
})
