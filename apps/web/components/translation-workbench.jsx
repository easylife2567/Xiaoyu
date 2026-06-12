'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  clearTranslationWorkbenchCache,
  readTranslationWorkbenchCache,
  writeTranslationWorkbenchCache,
} from '../src/translation-processing-cache.js'
import { diagnoseTranslationTask } from '../src/translation-processing-diagnostics.js'
import { getRecentRuntimeEvents, getTranslationWorkflowState } from '../src/translation-processing-progress.js'
import { formatRuntimeEvent, summarizeFailure } from '../src/translation-processing-log.js'
import { EmptyState } from './workbench-shell.jsx'

const STATUS_COPY = {
  ready: '文件已就绪',
  queued: '等待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '处理失败',
}

function formatUpdatedAt(value) {
  if (!value) {
    return '等待首次更新'
  }

  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function resolveStatusTone(status) {
  if (status === 'completed') {
    return 'success'
  }

  if (status === 'failed') {
    return 'danger'
  }

  if (status === 'processing' || status === 'queued') {
    return 'live'
  }

  return 'neutral'
}

export function TranslationWorkbenchBody() {
  const inputRef = useRef(null)
  const [task, setTask] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [hydratedFromCache, setHydratedFromCache] = useState(false)
  const hasBootstrappedCache = useRef(false)

  async function refreshTask(taskId, { silent = false } = {}) {
    if (!taskId) {
      return
    }

    if (!silent) {
      setBusy(true)
    }

    try {
      const response = await fetch(`/api/translation-processing/tasks/${taskId}`)
      const payload = await response.json()
      if (!response.ok) {
        if (response.status === 404) {
          clearTranslationWorkbenchCache()
          setTask(null)
        }
        setError(payload.error ?? '任务状态刷新失败。')
        return
      }
      setTask(payload.task)
    } finally {
      if (!silent) {
        setBusy(false)
      }
    }
  }

  useEffect(() => {
    if (hasBootstrappedCache.current) {
      return
    }

    hasBootstrappedCache.current = true
    const cached = readTranslationWorkbenchCache()
    if (!cached?.task) {
      return
    }

    setTask(cached.task)
    setHydratedFromCache(true)
    refreshTask(cached.task.id, { silent: true }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!task || !['queued', 'processing'].includes(task.status)) {
      return undefined
    }

    const interval = setInterval(() => {
      refreshTask(task.id, { silent: true }).catch(() => {})
    }, 1200)

    return () => clearInterval(interval)
  }, [task])

  useEffect(() => {
    if (!task) {
      return
    }

    writeTranslationWorkbenchCache(task)
  }, [task])

  const latestArtifact = task?.artifacts?.at(-1) ?? null
  const canStart = task?.status === 'ready'
  const canRetry = task?.status === 'failed'
  const currentStatus = STATUS_COPY[task?.status] ?? '尚未开始'
  const sheetSummary = useMemo(() => task?.validation?.processableSheets?.join('、') ?? '尚未识别', [task])
  const failureSummary = task?.status === 'failed' ? summarizeFailure(task) : null
  const diagnostics = task ? diagnoseTranslationTask(task) : null
  const workflow = useMemo(() => getTranslationWorkflowState(task), [task])
  const recentEvents = useMemo(() => getRecentRuntimeEvents(task), [task])

  async function uploadFile(file) {
    if (!file) {
      return
    }

    setBusy(true)
    setError('')
    const formData = new FormData()
    formData.set('file', file)
    const response = await fetch('/api/translation-processing/tasks', {
      method: 'POST',
      body: formData,
    })
    const payload = await response.json()
    setBusy(false)

    if (!response.ok) {
      setError(payload.error ?? '文件上传失败。')
      return
    }

    setHydratedFromCache(false)
    setTask(payload.task)
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0]
    await uploadFile(file)
    if (event.target) {
      event.target.value = ''
    }
  }

  async function handleStart() {
    if (!task) {
      return
    }
    setBusy(true)
    setError('')
    const response = await fetch(`/api/translation-processing/tasks/${task.id}/start`, { method: 'POST' })
    const payload = await response.json()
    setBusy(false)

    if (!response.ok) {
      setError(payload.error ?? '任务启动失败。')
      return
    }
    setHydratedFromCache(false)
    setTask(payload.task)
    await refreshTask(task.id, { silent: true })
  }

  async function handleRetry() {
    if (!task) {
      return
    }
    setBusy(true)
    setError('')
    const response = await fetch(`/api/translation-processing/tasks/${task.id}/retry`, { method: 'POST' })
    const payload = await response.json()
    setBusy(false)

    if (!response.ok) {
      setError(payload.error ?? '任务重试失败。')
      return
    }
    setHydratedFromCache(false)
    setTask(payload.task)
    await refreshTask(task.id, { silent: true })
  }

  return (
    <>
      <section className="workflow-status live-workflow-status" aria-label="处理状态">
        <header>
          <div>
            <h2>处理流程</h2>
            <span>当前状态 · {currentStatus}</span>
          </div>
          <div className={`workflow-badge is-${resolveStatusTone(task?.status)}`}>
            {task?.status === 'processing' ? <span className="live-dot" aria-hidden="true" /> : null}
            <strong>{workflow.liveBadge}</strong>
            <em>{workflow.percentage}%</em>
          </div>
        </header>

        <div className="workflow-progressbar" aria-hidden="true">
          <span style={{ width: `${workflow.percentage}%` }} />
        </div>

        <div className="workflow-progress-meta">
          <div>
            <strong>{workflow.currentActivity}</strong>
            <span>最近更新 · {formatUpdatedAt(workflow.updatedAt)}</span>
          </div>
          <dl>
            <div>
              <dt>已完成</dt>
              <dd>
                {workflow.completedRows}/{workflow.totalRows || 0}
              </dd>
            </div>
            <div>
              <dt>活跃批次</dt>
              <dd>{workflow.activeBatches.length}</dd>
            </div>
            <div>
              <dt>累计批次</dt>
              <dd>
                {workflow.completedBatches}/{workflow.totalBatches || 0}
              </dd>
            </div>
          </dl>
        </div>

        <ol>
          {workflow.steps.map((step, index) => (
            <li className={`is-${step.state}`} key={step.key}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.label}</strong>
            </li>
          ))}
        </ol>

        {workflow.activeBatches.length ? (
          <div className="workflow-batch-strip" aria-label="当前活跃批次">
            {workflow.activeBatches.map((batch) => (
              <span key={`${batch.batchIndex}-${batch.startRow}-${batch.endRow}`}>
                {batch.sheet} · {batch.startRow}-{batch.endRow}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="workspace-grid translation-layout">
        <section className="console-section primary-workspace">
          <header>
            <h2>文件输入</h2>
            <span>仅支持 Excel</span>
          </header>
          <label
            className={dragActive ? 'upload-console is-dragging' : 'upload-console'}
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              uploadFile(event.dataTransfer.files?.[0]).catch(() => {})
            }}
          >
            <strong>{task ? task.sourceFileName : '拖拽或点击上传'}</strong>
            <span>{task ? '文件已上传并完成校验，可直接开始处理' : '上传原始 Excel，系统会自动识别工作表与行数'}</span>
            <em>支持 .xlsx / .xlsm</em>
            <input aria-label="上传原始 Excel" accept=".xlsx,.xlsm" ref={inputRef} type="file" onChange={handleUpload} />
          </label>
          <div className="upload-hints">
            <span>自动识别：工作表 / 行数 / 输出列</span>
            <span>
              {task
                ? `${hydratedFromCache ? '已恢复上次任务 · ' : ''}已识别 ${task.validation.sourceRows} 条可处理内容`
                : '上传后将展示识别结果'}
            </span>
          </div>
          {error ? <p className="inline-error">{error}</p> : null}
        </section>

        <section className="console-section side-workspace">
          <header>
            <h2>运行设置</h2>
            <span>自动化处理</span>
          </header>
          <div className="action-stack">
            <button className="primary-button" disabled={!canStart || busy} type="button" onClick={handleStart}>
              {busy && canStart ? '启动中…' : '开始处理'}
            </button>
            <div className="button-row">
              {canRetry ? (
                <button className="secondary-button" disabled={busy} type="button" onClick={handleRetry}>
                  重试任务
                </button>
              ) : null}
              {task ? (
                <button className="tertiary-button" disabled={busy} type="button" onClick={() => refreshTask(task.id)}>
                  立即刷新
                </button>
              ) : null}
            </div>
          </div>
          <dl className="compact-facts">
            <div>
              <dt>当前状态</dt>
              <dd>{currentStatus}</dd>
            </div>
            <div>
              <dt>识别工作表</dt>
              <dd>{sheetSummary}</dd>
            </div>
            <div>
              <dt>输出内容</dt>
              <dd>摘要 + 分类</dd>
            </div>
            <div>
              <dt>当前进度</dt>
              <dd>{workflow.percentage}%</dd>
            </div>
            {task ? (
              <div>
                <dt>会话缓存</dt>
                <dd>{hydratedFromCache ? '已恢复' : '已记住'}</dd>
              </div>
            ) : null}
          </dl>
        </section>

        {task ? (
          <section className="console-subsection process-insight">
            <p>输入识别</p>
            <h3>{task.validation.message}</h3>
            <span>已识别 {task.validation.sourceRows} 条可处理内容，当前工作台会按批次并发推进。</span>
            <div className="metric-grid">
              <article>
                <strong>{task.validation.processableSheets?.length ?? 0}</strong>
                <span>可处理工作表</span>
              </article>
              <article>
                <strong>{workflow.completedRows}</strong>
                <span>已完成内容</span>
              </article>
              <article>
                <strong>{workflow.remainingRows}</strong>
                <span>待处理内容</span>
              </article>
            </div>
          </section>
        ) : (
          <EmptyState eyebrow="输入识别" title="等待文件上传" description="上传后将在这里展示系统已识别的文件信息。" />
        )}

        {task?.status === 'completed' && latestArtifact ? (
          <section className="console-subsection empty-state">
            <p>结果交付</p>
            <h3>结果文件已生成</h3>
            <span>
              已处理 {task.summary.processedRows} 条内容。
              <a className="inline-link" href={`/api/translation-processing/tasks/${task.id}/download`}>
                下载结果
              </a>
            </span>
            {diagnostics?.status === 'completed_with_review' ? (
              <div className="failure-diagnostics">
                <strong>人工复核提醒</strong>
                <p>
                  {diagnostics.failurePoint.scope}
                  {diagnostics.failurePoint.cause ? ` · ${diagnostics.failurePoint.cause}` : ''}
                </p>
                {diagnostics.suggestions?.length ? (
                  <ul>
                    {diagnostics.suggestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : task?.status === 'failed' ? (
          <section className="console-subsection empty-state">
            <p>结果交付</p>
            <h3>{failureSummary.title}</h3>
            <span>{failureSummary.detail}</span>
            {diagnostics?.failurePoint ? (
              <div className="failure-diagnostics">
                <strong>错误定位</strong>
                <p>
                  {diagnostics.failurePoint.scope}
                  {diagnostics.failurePoint.cause ? ` · ${diagnostics.failurePoint.cause}` : ''}
                </p>
                {diagnostics.suggestions?.length ? (
                  <>
                    <strong>建议处理</strong>
                    <ul>
                      {diagnostics.suggestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : task?.status === 'processing' || task?.status === 'queued' ? (
          <section className="console-subsection live-delivery-card">
            <p>结果交付</p>
            <h3>结果正在生成</h3>
            <span>系统会持续轮询任务状态，处理完成后这里会直接切换为下载区。</span>
            <div className="live-status-note">
              <strong>{workflow.currentActivity}</strong>
              <em>已完成 {workflow.completedRows} / {workflow.totalRows || 0}</em>
            </div>
          </section>
        ) : (
          <EmptyState eyebrow="结果交付" title="等待处理完成" description="处理完成后，结果文件会出现在这里。" />
        )}

        <section className="console-subsection runtime-log">
          <p>运行日志</p>
          {recentEvents.length ? (
            <ol className="runtime-log-list">
              {recentEvents.map((event, index) => (
                <li key={`${event.type}-${event.createdAt ?? index}`}>
                  <strong>{formatRuntimeEvent(event)}</strong>
                  {event.createdAt ? <time>{new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour12: false })}</time> : null}
                </li>
              ))}
            </ol>
          ) : (
            <span>任务开始后，这里会展示最近的执行记录。</span>
          )}
        </section>
      </section>
    </>
  )
}
