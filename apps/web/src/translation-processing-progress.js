const WORKFLOW_STEPS = [
  { key: 'upload', label: '上传校验' },
  { key: 'queue', label: '进入队列' },
  { key: 'process', label: '批量处理' },
  { key: 'deliver', label: '结果交付' },
]

function clampProgress(value) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(value)))
}

function dedupeEvents(events) {
  const seen = new Set()
  return events.filter((event, index) => {
    const key = `${event.type}-${event.createdAt ?? index}-${JSON.stringify(event.detail ?? {})}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function getStepIndex(task) {
  if (!task) {
    return 0
  }

  if (task.status === 'ready') {
    return 0
  }

  if (task.status === 'queued') {
    return 1
  }

  if (task.status === 'processing' || task.status === 'failed') {
    return 2
  }

  if (task.status === 'completed') {
    return 3
  }

  return 0
}

export function getTranslationWorkflowState(task) {
  const totalRows = task?.progress?.totalRows ?? task?.validation?.sourceRows ?? 0
  const completedRows = task?.status === 'completed'
    ? task?.summary?.processedRows ?? totalRows
    : task?.progress?.completedRows ?? 0
  const activeBatches = task?.progress?.activeBatches ?? []
  const totalBatches = task?.progress?.totalBatches ?? 0
  const completedBatches = task?.progress?.completedBatches ?? 0

  let percentage = 0
  if (task?.status === 'ready') {
    percentage = totalRows > 0 ? 8 : 0
  } else if (task?.status === 'queued') {
    percentage = 12
  } else if (task?.status === 'processing') {
    percentage = totalRows > 0 ? 18 + (completedRows / totalRows) * 74 : 20
  } else if (task?.status === 'completed') {
    percentage = 100
  } else if (task?.status === 'failed') {
    percentage = totalRows > 0 ? 18 + (completedRows / totalRows) * 74 : 18
  }

  const stepIndex = getStepIndex(task)
  const steps = WORKFLOW_STEPS.map((step, index) => ({
    ...step,
    state: index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'upcoming',
  }))

  return {
    steps,
    percentage: clampProgress(percentage),
    totalRows,
    completedRows,
    remainingRows: Math.max(totalRows - completedRows, 0),
    totalBatches,
    completedBatches,
    activeBatches,
    currentActivity:
      task?.progress?.currentActivity ??
      (task?.status === 'completed'
        ? `任务已完成，共处理 ${task?.summary?.processedRows ?? 0} 条内容`
        : task?.status === 'failed'
          ? '任务在处理中断，请查看错误定位与建议处理'
          : task?.status === 'ready'
            ? '文件已通过校验，可以开始处理'
            : task?.status === 'queued'
              ? '任务已进入队列，等待 worker 启动'
              : '等待任务开始'),
    liveBadge:
      task?.status === 'processing'
        ? '实时处理中'
        : task?.status === 'queued'
          ? '队列中'
          : task?.status === 'completed'
            ? '已完成'
            : task?.status === 'failed'
              ? '已中断'
              : '待开始',
    updatedAt: task?.progress?.updatedAt ?? task?.updatedAt ?? null,
  }
}

export function getRecentRuntimeEvents(task) {
  const latestAttempt = task?.attempts?.at(-1) ?? null
  const persistedEvents = [...(task?.events ?? []), ...(latestAttempt?.events ?? [])]
  const liveEvents = task?.progress?.events ?? []
  return dedupeEvents([...persistedEvents, ...liveEvents]).slice(-10)
}
