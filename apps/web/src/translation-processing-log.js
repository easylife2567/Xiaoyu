const FAILURE_COPY = {
  configuration_error: {
    title: '模型配置异常',
  },
  rate_limited: {
    title: '模型触发限流',
  },
  timeout: {
    title: '模型调用超时',
  },
  invalid_response: {
    title: '模型返回异常',
  },
  provider_error: {
    title: '模型服务异常',
  },
}

function describeScope(call) {
  if (call?.batchStartRow && call?.batchEndRow) {
    return call.batchStartRow === call.batchEndRow
      ? `${call.sheet} 第 ${call.batchStartRow} 行`
      : `${call.sheet} 第 ${call.batchStartRow}-${call.batchEndRow} 行批次`
  }

  if (call?.row) {
    return `${call.sheet} 第 ${call.row} 行`
  }

  return '任务批次'
}

function describeRelativeFailureScope(failedCall, lastSuccess) {
  if (
    failedCall?.sheet &&
    lastSuccess?.sheet &&
    failedCall.sheet === lastSuccess.sheet &&
    failedCall?.row &&
    !failedCall?.batchStartRow
  ) {
    return `第 ${failedCall.row} 行`
  }

  return describeScope(failedCall)
}

export function summarizeFailure(task) {
  const category = task?.failure?.category ?? 'provider_error'
  const latestAttempt = task?.attempts?.at(-1)
  const calls = latestAttempt?.aiCalls ?? []
  const failedCall = calls.findLast((call) => call.status === 'failed')
  const lastSuccess = calls.findLast((call) => call.status === 'succeeded')
  const copy = FAILURE_COPY[category] ?? FAILURE_COPY.provider_error

  if (failedCall && lastSuccess) {
    const retryCount = latestAttempt?.aiCalls?.at(-1)?.retryCount ?? 0
    const failureScope = describeRelativeFailureScope(failedCall, lastSuccess)
    const separator = failureScope.startsWith('第 ') ? '' : ' '
    return {
      title: copy.title,
      detail: `${retryCount > 0 ? `系统已自动重试 ${retryCount} 次，` : ''}最近成功处理到 ${describeScope(lastSuccess)}，随后在${separator}${failureScope}${category === 'timeout' ? '超时' : '失败'}。`,
    }
  }

  if (failedCall) {
    return {
      title: copy.title,
      detail: `任务在 ${describeScope(failedCall)}停止。`,
    }
  }

  return {
    title: copy.title,
    detail: task?.failure?.message ?? '任务执行失败。',
  }
}

export function formatRuntimeEvent(event) {
  const detail = event.detail ?? {}
  switch (event.type) {
    case 'task_created':
      return '任务已创建'
    case 'validation_passed':
      return '文件校验通过'
    case 'attempt_queued':
      return '任务已进入队列'
    case 'attempt_started':
      return '任务开始处理'
    case 'sheet_started':
      return `开始处理工作表 ${detail.sheet}`
    case 'sensitive_content_downgraded':
      return `${detail.sheet} 第 ${detail.row} 行命中敏感规则，已降级为模板摘要`
    case 'ai_batch_started':
      return `开始处理 ${detail.sheet} 第 ${detail.startRow}-${detail.endRow} 行批次`
    case 'ai_call_started':
      return `开始处理 ${detail.sheet} 第 ${detail.row} 行`
    case 'ai_batch_succeeded':
      return `AI 完成 ${detail.sheet} 第 ${detail.startRow}-${detail.endRow} 行批次`
    case 'ai_batch_failed':
      return `AI 在 ${detail.sheet} 第 ${detail.startRow}-${detail.endRow} 行批次失败`
    case 'ai_batch_fallback_started':
      return `开始降级处理 ${detail.sheet} 第 ${detail.startRow}-${detail.endRow} 行批次`
    case 'ai_batch_fallback_completed':
      return `已完成降级处理 ${detail.sheet} 第 ${detail.startRow}-${detail.endRow} 行批次`
    case 'ai_call_retry_scheduled':
      return `AI 将在 ${detail.nextDelayMs}ms 后重试 ${detail.sheet} 第 ${detail.row} 行`
    case 'ai_call_succeeded':
      return `AI 完成 ${detail.sheet} 第 ${detail.row} 行`
    case 'ai_call_failed':
      return `AI 在 ${detail.sheet} 第 ${detail.row} 行失败`
    case 'attempt_completed':
      return '任务已完成'
    case 'attempt_failed':
      return '任务处理失败'
    default:
      return event.type
  }
}
