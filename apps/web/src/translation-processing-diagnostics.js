function getLatestAttempt(task) {
  return task?.attempts?.at(-1) ?? null
}

function getFailedCall(task) {
  const latestAttempt = getLatestAttempt(task)
  return latestAttempt?.aiCalls?.findLast((call) => call.status === 'failed') ?? null
}

function getLastSuccessCall(task) {
  const latestAttempt = getLatestAttempt(task)
  return latestAttempt?.aiCalls?.findLast((call) => call.status === 'succeeded') ?? null
}

function formatScope(call) {
  if (call?.batchStartRow && call?.batchEndRow) {
    return call.batchStartRow === call.batchEndRow
      ? `${call.sheet} 第 ${call.batchStartRow} 行`
      : `${call.sheet} 第 ${call.batchStartRow}-${call.batchEndRow} 行批次`
  }

  if (call?.sheet && call?.row) {
    return `${call.sheet} 第 ${call.row} 行`
  }

  return '未定位到具体执行单元'
}

function detectEnvironmentFailure(task) {
  const message = task?.failure?.message ?? ''
  if (message.includes("No module named 'openpyxl'")) {
    return {
      type: 'environment',
      scope: 'Python worker 运行环境',
      cause: '缺少 openpyxl Excel 依赖',
      suggestions: [
        '为 worker Python 环境安装 openpyxl 依赖。',
        '安装完成后重新启动开发服务，确保新的 Python 环境变量生效。',
      ],
    }
  }

  return null
}

function getSensitiveFallbackIssue(task) {
  return task?.summary?.issues?.find((issue) => issue.code === 'sensitive_content_fallback') ?? null
}

function diagnoseFailure(task) {
  const environmentFailure = detectEnvironmentFailure(task)
  if (environmentFailure) {
    return {
      status: 'failed',
      headline: '运行环境缺少 Excel 依赖',
      failurePoint: environmentFailure,
      suggestions: environmentFailure.suggestions,
    }
  }

  const failedCall = getFailedCall(task)
  const category = task?.failure?.category ?? failedCall?.failureCategory ?? 'provider_error'

  const failurePoint = {
    type: failedCall?.batchStartRow ? 'batch' : 'row',
    scope: formatScope(failedCall),
    category,
    retryCount: failedCall?.retryCount ?? 0,
    lastHealthyScope: formatScope(getLastSuccessCall(task)),
  }

  const suggestionMap = {
    timeout: [
      '将 XIAOYU_AI_TIMEOUT_SECONDS 调高到更宽松的值，例如 60 或 90。',
      '适当降低 XIAOYU_AI_MAX_CONCURRENCY 或 XIAOYU_AI_BATCH_SIZE，减少慢请求叠加。',
      '如果当前使用高成本模型，可改用 qwen3.6-flash 先优先保证吞吐。',
    ],
    rate_limited: [
      '降低 XIAOYU_AI_MAX_CONCURRENCY，避免同一时刻批量请求过多。',
      '降低 XIAOYU_AI_BATCH_SIZE，让单次请求更轻。',
      '等待短暂退避后重试，确认上游配额与限流窗口已经恢复。',
    ],
    configuration_error: [
      '检查 XIAOYU_AI_PROVIDER、XIAOYU_AI_MODEL、XIAOYU_AI_BASE_URL 与 XIAOYU_AI_API_KEY 是否配置完整。',
      '确认根目录 .env.local 已被当前开发服务加载，必要时重启服务。',
    ],
    invalid_response: [
      '降低 XIAOYU_AI_BATCH_SIZE，减少模型一次返回过长或格式漂移的概率。',
      '保留 XIAOYU_AI_BATCH_FALLBACK_ENABLED=true，让坏批次自动降级到单行补救。',
      '检查运行日志中的批次范围，定位是否由个别异常文本触发结构化输出失败。',
    ],
    provider_error: [
      '先根据运行日志确认失败发生在单行还是批次，再决定是否缩小 XIAOYU_AI_BATCH_SIZE。',
      '如果是瞬时上游故障，可直接重试任务；若持续出现，则降低 XIAOYU_AI_MAX_CONCURRENCY。',
      '若 HTTP 400/请求参数异常反复出现，检查模型名、base URL 与 provider 兼容参数是否正确。',
    ],
  }

  const headlineMap = {
    timeout: '模型调用超时',
    rate_limited: '模型触发限流',
    configuration_error: '模型配置异常',
    invalid_response: '模型返回异常',
    provider_error: '模型服务异常',
  }

  return {
    status: 'failed',
    headline: headlineMap[category] ?? '任务执行失败',
    failurePoint,
    suggestions: suggestionMap[category] ?? suggestionMap.provider_error,
  }
}

export function diagnoseTranslationTask(task) {
  if (!task) {
    return {
      status: 'unknown',
      headline: '尚未发现任务数据',
      failurePoint: null,
      suggestions: [],
    }
  }

  if (task.status === 'completed') {
    const sensitiveIssue = getSensitiveFallbackIssue(task)
    if (sensitiveIssue) {
      return {
        status: 'completed_with_review',
        headline: '任务已完成，但包含需要人工复核的敏感内容。',
        failurePoint: {
          type: 'review',
          scope: `${sensitiveIssue.sheet} 第 ${sensitiveIssue.row} 行`,
          cause: sensitiveIssue.message,
          requiresHumanReview: true,
        },
        suggestions: [
          '优先人工复核被模板降级的行，确认是否需要人工改写研究内容。',
          '如这类内容经常出现，可继续补充本地敏感规则与模板文案。',
        ],
      }
    }

    return {
      status: 'healthy',
      headline: `任务已完成，共处理 ${task?.summary?.processedRows ?? 0} 条内容。`,
      failurePoint: null,
      suggestions: [],
    }
  }

  if (task.status === 'failed') {
    return diagnoseFailure(task)
  }

  return {
    status: 'running',
    headline: '任务仍在处理中',
    failurePoint: null,
    suggestions: [],
  }
}
