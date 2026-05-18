'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { EmptyState } from './workbench-shell.jsx'

const STATUS_COPY = {
  ready: '文件已就绪',
  queued: '等待处理',
  processing: '处理中',
  completed: '已完成',
  failed: '处理失败',
}

export function TranslationWorkbenchBody() {
  const [task, setTask] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!task || !['queued', 'processing'].includes(task.status)) {
      return undefined
    }

    const interval = setInterval(async () => {
      const response = await fetch(`/api/translation-processing/tasks/${task.id}`)
      const payload = await response.json()
      if (response.ok) {
        setTask(payload.task)
      }
    }, 1200)

    return () => clearInterval(interval)
  }, [task])

  const latestArtifact = task?.artifacts?.at(-1) ?? null
  const canStart = task?.status === 'ready'
  const canRetry = task?.status === 'failed'
  const currentStatus = STATUS_COPY[task?.status] ?? '尚未开始'
  const sheetSummary = useMemo(() => task?.validation?.processableSheets?.join('、') ?? '尚未识别', [task])

  async function handleUpload(event) {
    const file = event.target.files?.[0]
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

    setTask(payload.task)
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
    setTask(payload.task)
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
    setTask(payload.task)
  }

  return (
    <section className="workspace-grid translation-layout">
      <section className="console-section primary-workspace">
        <header>
          <h2>文件输入</h2>
          <span>仅支持 Excel</span>
        </header>
        <label className="upload-console">
          <strong>{task ? task.sourceFileName : '拖拽或点击上传'}</strong>
          <span>{task ? '文件已上传并完成校验' : '上传原始 Excel'}</span>
          <em>支持 .xlsx / .xlsm</em>
          <input aria-label="上传原始 Excel" accept=".xlsx,.xlsm" type="file" onChange={handleUpload} />
        </label>
        {error ? <p className="inline-error">{error}</p> : null}
      </section>

      <section className="console-section side-workspace">
        <header>
          <h2>运行设置</h2>
          <span>默认流程</span>
        </header>
        <button className="primary-button" disabled={!canStart || busy} type="button" onClick={handleStart}>
          {busy && canStart ? '启动中…' : '开始处理'}
        </button>
        {canRetry ? (
          <button className="secondary-button" disabled={busy} type="button" onClick={handleRetry}>
            重试任务
          </button>
        ) : null}
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
        </dl>
      </section>

      {task ? (
        <section className="console-subsection empty-state">
          <p>输入识别</p>
          <h3>{task.validation.message}</h3>
          <span>已识别 {task.validation.sourceRows} 条可处理内容。</span>
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
        </section>
      ) : task?.status === 'failed' ? (
        <section className="console-subsection empty-state">
          <p>结果交付</p>
          <h3>任务未完成</h3>
          <span>{task.failure?.message ?? '处理失败，请重试。'}</span>
        </section>
      ) : (
        <EmptyState eyebrow="结果交付" title="等待处理完成" description="处理完成后，结果文件会出现在这里。" />
      )}
    </section>
  )
}
