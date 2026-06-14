'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { EmptyState } from './workbench-shell.jsx'

const MIN_SELECTION_COUNT = 6

const PIPELINE_STEPS = [
  { key: 'select', label: '选择候选' },
  { key: 'draft', label: '生成草稿' },
  { key: 'export', label: '导出产物' },
]

const STATE_MAP = {
  drafting_pending: { badge: '选择候选', step: 1 },
  drafting_in_progress: { badge: '起草中', step: 2 },
  drafting_ready_for_review: { badge: '草稿待审', step: 2 },
  exporting_in_progress: { badge: '导出中', step: 3 },
  completed: { badge: '已完成', step: 4 },
  failed: { badge: '失败', step: 0 },
}

function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function DocumentIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 12h6m-6 4h6m-7 5h8a2 2 0 002-2V7l-5-5H7a2 2 0 00-2 2v15a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SpreadsheetIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10h16M4 14h16M10 4v16M14 4v16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function readActiveTaskKey(workflowSlug) {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`daily-report-active-${workflowSlug}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeActiveTaskKey(workflowSlug, taskId) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(`daily-report-active-${workflowSlug}`, JSON.stringify({ taskId }))
  } catch {
    // ignore
  }
}

function clearActiveTaskKey(workflowSlug) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(`daily-report-active-${workflowSlug}`)
  } catch {
    // ignore
  }
}

export function DailyReportWorkbenchBody({ profile, workflowSlug }) {
  const today = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  const [pool, setPool] = useState(null)
  const [task, setTask] = useState(null)
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editState, setEditState] = useState({ sectionIndex: null, title: '', body: '' })
  const [issueNumber, setIssueNumber] = useState('')

  // ── Initial load ─────────────────────────────────────────────────────

  useEffect(() => {
    const cached = readActiveTaskKey(workflowSlug)
    fetchPool().catch(() => {})
    if (cached?.taskId) {
      fetchTask(cached.taskId, { silent: true }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Poll while in flight ─────────────────────────────────────────────

  useEffect(() => {
    if (!task || !['drafting_in_progress', 'exporting_in_progress'].includes(task.status)) {
      return undefined
    }
    const interval = setInterval(() => {
      fetchTask(task.id, { silent: true }).catch(() => {})
    }, 1500)
    return () => clearInterval(interval)
  }, [task]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data helpers ─────────────────────────────────────────────────────

  async function fetchPool() {
    setError('')
    try {
      const response = await fetch(`/api/daily-report/candidate-pools/${workflowSlug}/${today}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '候选池加载失败。')
      }
      const body = await response.json()
      setPool(body.pool)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '候选池加载失败。')
    }
  }

  async function fetchTask(taskId, { silent = false } = {}) {
    if (!taskId) return
    if (!silent) setBusy(true)
    try {
      const response = await fetch(`/api/daily-report/tasks/${taskId}`)
      if (!response.ok) {
        if (response.status === 404) {
          clearActiveTaskKey(workflowSlug)
          setTask(null)
          return
        }
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '任务状态刷新失败。')
      }
      const body = await response.json()
      setTask(body.task)
      writeActiveTaskKey(workflowSlug, body.task.id)
      if (body.task.selections?.length > 0) {
        setSelectedCandidateIds(body.task.selections.map((s) => s.candidateId))
      }
    } catch (cause) {
      if (!silent) setError(cause instanceof Error ? cause.message : '任务刷新失败。')
    } finally {
      if (!silent) setBusy(false)
    }
  }

  // ── Mutations ────────────────────────────────────────────────────────

  async function handleResetTask() {
    if (!task) {
      clearActiveTaskKey(workflowSlug)
      setTask(null)
      setSelectedCandidateIds([])
      setEditState({ sectionIndex: null, title: '', body: '' })
      return
    }

    const confirmed = window.confirm('确定要重置当前日报任务吗？已选候选、草稿和产物记录都会清空。')
    if (!confirmed) return

    setError('')
    setBusy(true)
    try {
      const response = await fetch(`/api/daily-report/tasks/${task.id}`, { method: 'DELETE' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '任务重置失败。')
      }
      clearActiveTaskKey(workflowSlug)
      setTask(null)
      setSelectedCandidateIds([])
      setEditState({ sectionIndex: null, title: '', body: '' })
      setIssueNumber('')
      await fetchPool()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '任务重置失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateTask() {
    setError('')
    const normalizedIssueNumber = Number.parseInt(issueNumber, 10)
    if (!Number.isInteger(normalizedIssueNumber) || normalizedIssueNumber <= 0) {
      setError('请先填写有效的日报期号。')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/daily-report/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workflowSlug, issueDate: today, issueNumber: normalizedIssueNumber }),
      })
      if (!response.ok) {
        if (response.status === 409) {
          const body = await response.json().catch(() => ({}))
          if (body.existingTaskId) {
            await fetchTask(body.existingTaskId)
            return
          }
        }
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '任务创建失败。')
      }
      const body = await response.json()
      setTask(body.task)
      writeActiveTaskKey(workflowSlug, body.task.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '任务创建失败。')
    } finally {
      setBusy(false)
    }
  }

  function toggleCandidate(candidateId) {
    if (task && task.status !== 'drafting_pending') return
    setSelectedCandidateIds((prev) => {
      if (prev.includes(candidateId)) {
        return prev.filter((id) => id !== candidateId)
      }
      if (prev.length >= MIN_SELECTION_COUNT) {
        return prev
      }
      return [...prev, candidateId]
    })
  }

  async function handleSubmitSelections() {
    if (selectedCandidateIds.length !== MIN_SELECTION_COUNT) return
    setError('')
    setBusy(true)
    const selections = selectedCandidateIds.map((candidateId, index) => {
      const candidate = pool.candidates.find((c) => c.id === candidateId)
      return { candidateId, position: index + 1, candidateSnapshot: candidate ?? { id: candidateId } }
    })
    try {
      const response = await fetch(`/api/daily-report/tasks/${task.id}/selections`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ selections }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '提交选择失败。')
      }
      const body = await response.json()
      setTask(body.task)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '提交选择失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleStartDraft() {
    if (!task) return
    setError('')
    setBusy(true)
    try {
      const response = await fetch(`/api/daily-report/tasks/${task.id}/drafts`, { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '触发起草失败。')
      }
      const body = await response.json()
      setTask(body.task)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '触发起草失败。')
    } finally {
      setBusy(false)
    }
  }

  const latestDraft = useMemo(() => task?.draftVersions?.at(-1) ?? null, [task])

  function openEditSection(section) {
    setEditState({ sectionIndex: section.index, title: section.title, body: section.body })
  }

  function closeEditSection() {
    setEditState({ sectionIndex: null, title: '', body: '' })
  }

  async function handleSaveEdit() {
    if (!task || !latestDraft || !editState.sectionIndex) return
    setError('')
    setBusy(true)
    try {
      const response = await fetch(
        `/api/daily-report/tasks/${task.id}/drafts/${latestDraft.id}/sections/${editState.sectionIndex}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: editState.title, body: editState.body }),
        },
      )
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '编辑保存失败。')
      }
      const body = await response.json()
      setTask(body.task)
      closeEditSection()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '编辑保存失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleStartExport() {
    if (!task) return
    setError('')
    setBusy(true)
    try {
      const response = await fetch(`/api/daily-report/tasks/${task.id}/exports`, { method: 'POST' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? '触发导出失败。')
      }
      const body = await response.json()
      setTask(body.task)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '触发导出失败。')
    } finally {
      setBusy(false)
    }
  }

  // ── Derived state ────────────────────────────────────────────────────

  const stateInfo = STATE_MAP[task?.status] ?? { badge: '尚未开始', step: 0 }
  const canCreateTask = !task && pool
  const canSubmitSelections =
    task?.status === 'drafting_pending' &&
    selectedCandidateIds.length === MIN_SELECTION_COUNT &&
    task?.selections?.length !== MIN_SELECTION_COUNT &&
    !busy
  const canDraft = task?.status === 'drafting_pending' && task?.selections?.length >= MIN_SELECTION_COUNT && !busy
  const isDrafting = task?.status === 'drafting_in_progress'
  const canEdit = task?.status === 'drafting_ready_for_review' && latestDraft
  const isExporting = task?.status === 'exporting_in_progress'
  const taskCompleted = task?.status === 'completed'
  const taskFailed = task?.status === 'failed'

  const latestArtifactDocx = useMemo(
    () => task?.artifacts?.find((a) => a.kind === 'docx_report') ?? null,
    [task],
  )
  const latestArtifactXlsx = useMemo(
    () => task?.artifacts?.find((a) => a.kind === 'resource_pool_xlsx') ?? null,
    [task],
  )
  const failureSummary = taskFailed && task?.failure ? task.failure : null

  // Are we in a "selections locked" state where checkboxes should be disabled?
  const selectionsLocked = task && task.status !== 'drafting_pending'

  return (
    <section className="report-console">
      {/* ── Editorial focus strip ───────────────────────────────────── */}
      <div className="report-focus-strip">
        <span>筛选侧重</span>
        <strong>{profile.focus}</strong>
        <em>{profile.poolDescription}</em>
      </div>

      {/* ── Error banner ────────────────────────────────────────────── */}
      {error ? (
        <p className="inline-error" style={{ gridColumn: '1 / -1' }}>
          {error}
        </p>
      ) : null}

      {/* ── Horizontal production pipeline ──────────────────────────── */}
      <section aria-label="生产链路" className="report-progress-bar">
        <header>
          <h2>生产链路</h2>
          <div className="report-progress-actions">
            <span>当前状态 · {stateInfo.badge}</span>
            {task ? (
              <button className="reset-task-button" disabled={busy} type="button" onClick={handleResetTask}>
                重置任务
              </button>
            ) : null}
          </div>
        </header>
        <ol>
          {PIPELINE_STEPS.map((step, index) => {
            const stepNumber = index + 1
            const isCurrent = stateInfo.step === stepNumber
            const isCompleted = stateInfo.step > stepNumber
            return (
              <li
                className={`${isCurrent ? 'is-current' : ''}${isCompleted ? ' is-completed' : ''}`}
                key={step.key}
              >
                <span>{String(stepNumber).padStart(2, '0')}</span>
                <strong>{step.label}</strong>
              </li>
            )
          })}
        </ol>
      </section>

      {/* ── Main column (basket + draft + artifacts) ────────────────── */}
      <div className="report-main-column">
        {/* Selected basket */}
        <section className="console-section selected-zone">
          <header>
            <h2>已选篮子</h2>
            <span>
              {selectedCandidateIds.length} / {MIN_SELECTION_COUNT}
            </span>
          </header>

          {selectedCandidateIds.length > 0 ? (
            <div className="basket-list">
              {selectedCandidateIds.map((candidateId, index) => {
                const candidate =
                  pool?.candidates?.find((c) => c.id === candidateId) ??
                  task?.selections?.find((s) => s.candidateId === candidateId)?.candidateSnapshot
                return (
                  <div className="basket-item" key={candidateId}>
                    <span className="basket-position">{index + 1}</span>
                    <div className="basket-meta">
                      <span className="basket-title">{candidate?.title ?? candidateId}</span>
                      <span className="basket-source">{candidate?.sourceName ?? ''}</span>
                    </div>
                    {task?.status === 'drafting_pending' ? (
                      <button
                        className="basket-remove-button"
                        disabled={busy}
                        type="button"
                        onClick={() => toggleCandidate(candidateId)}
                      >
                        移除
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : (
            <strong>待选择</strong>
          )}

          {canSubmitSelections ? (
            <div className="basket-action-row">
              <button
                className="primary-button"
                disabled={busy}
                type="button"
                onClick={handleSubmitSelections}
              >
                {busy ? '提交中…' : `确认选中 ${MIN_SELECTION_COUNT} 条`}
              </button>
            </div>
          ) : canDraft ? (
            <div className="basket-action-row">
              <button className="primary-button" disabled={busy} type="button" onClick={handleStartDraft}>
                {busy ? '启动中…' : '生成草稿'}
              </button>
            </div>
          ) : null}
        </section>

        {/* Draft section */}
        {isDrafting ? (
          <div className="live-banner" role="status">
            <span aria-hidden="true" className="live-banner-icon" />
            <div className="live-banner-text">
              <span className="live-banner-title">正在生成草稿…</span>
              <span className="live-banner-detail">AI 正在根据 {MIN_SELECTION_COUNT} 条选择撰写国际日报全文。</span>
            </div>
          </div>
        ) : canEdit ? (
          <section className="console-section">
            <header>
              <h2>正文草稿</h2>
              <span>
                v{latestDraft.version} · {latestDraft.source === 'ai_generated' ? 'AI 生成' : '已编辑'}
              </span>
            </header>

            {latestDraft.sections.map((section) => {
              const isEditing = editState.sectionIndex === section.index
              return (
                <div
                  className={`draft-section-card${isEditing ? '' : ' is-readonly'}`}
                  key={section.index}
                  onClick={isEditing ? undefined : () => openEditSection(section)}
                >
                  {isEditing ? (
                    <div className="draft-edit-form" onClick={(e) => e.stopPropagation()}>
                      <label className="draft-edit-label">
                        标题
                        <input
                          className="draft-edit-input"
                          value={editState.title}
                          onChange={(e) => setEditState((s) => ({ ...s, title: e.target.value }))}
                        />
                      </label>
                      <label className="draft-edit-label">
                        正文
                        <textarea
                          className="draft-edit-textarea"
                          rows={4}
                          value={editState.body}
                          onChange={(e) => setEditState((s) => ({ ...s, body: e.target.value }))}
                        />
                      </label>
                      <div className="draft-edit-actions">
                        <button className="primary-button" disabled={busy} type="button" onClick={handleSaveEdit}>
                          {busy ? '保存中…' : '保存'}
                        </button>
                        <button className="tertiary-button" type="button" onClick={closeEditSection}>
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="draft-section-header">
                      <div>
                        <h3 className="draft-section-title">
                          {section.index}. {section.title}
                        </h3>
                        <p className="draft-section-body">{section.body}</p>
                      </div>
                      <span className="draft-section-edit-button">编辑</span>
                    </div>
                  )}
                </div>
              )
            })}

            {task?.status === 'drafting_ready_for_review' ? (
              <div className="draft-zone-footer">
                <span>{latestDraft.sections.length} 段已就绪</span>
                <div className="draft-zone-footer-actions">
                  <button className="tertiary-button" disabled={busy} type="button" onClick={handleStartDraft}>
                    重新生成
                  </button>
                  <button
                    className="primary-button"
                    disabled={busy || isExporting}
                    type="button"
                    onClick={handleStartExport}
                  >
                    {isExporting ? '导出中…' : '导出产物'}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : taskCompleted ? null : (
          <EmptyState
            description="选择 6 条候选后，点击生成即可让 AI 撰写国际日报全文草稿。"
            eyebrow="正文草稿"
            title="等待生成"
          />
        )}

        {/* Export / artifact zone */}
        {isExporting ? (
          <div className="live-banner" role="status">
            <span aria-hidden="true" className="live-banner-icon" />
            <div className="live-banner-text">
              <span className="live-banner-title">正在生成产物…</span>
              <span className="live-banner-detail">系统正在渲染 DOCX 报告并更新资源池表格。</span>
            </div>
          </div>
        ) : taskCompleted ? (
          <section className="console-section">
            <header>
              <h2>产物交付</h2>
              <span>已完成</span>
            </header>
            <div className="artifact-list">
              {latestArtifactDocx ? (
                <a
                  className="artifact-row"
                  href={`/api/daily-report/tasks/${task.id}/artifacts/${latestArtifactDocx.id}/download`}
                >
                  <span aria-hidden="true" className="artifact-icon">
                    <DocumentIcon />
                  </span>
                  <span className="artifact-meta">
                    <span className="artifact-name">{latestArtifactDocx.fileName}</span>
                    <span className="artifact-size">{formatFileSize(latestArtifactDocx.sizeBytes)} · DOCX 报告</span>
                  </span>
                  <span className="artifact-download-cta">下载</span>
                </a>
              ) : null}
              {latestArtifactXlsx ? (
                <a
                  className="artifact-row"
                  href={`/api/daily-report/tasks/${task.id}/artifacts/${latestArtifactXlsx.id}/download`}
                >
                  <span aria-hidden="true" className="artifact-icon">
                    <SpreadsheetIcon />
                  </span>
                  <span className="artifact-meta">
                    <span className="artifact-name">{latestArtifactXlsx.fileName}</span>
                    <span className="artifact-size">{formatFileSize(latestArtifactXlsx.sizeBytes)} · 资源池 XLSX</span>
                  </span>
                  <span className="artifact-download-cta">下载</span>
                </a>
              ) : null}
            </div>
          </section>
        ) : taskFailed ? (
          <div className="failure-card">
            <h3 className="failure-card-title">{failureSummary?.message ?? '任务失败'}</h3>
            <p className="failure-card-message">
              {failureSummary?.category === 'validation_failure'
                ? '产物未通过导出校验，已撤回所有文件。'
                : '请在排查后重新触发任务。'}
            </p>
            {failureSummary?.validationReport?.checks?.some?.((c) => !c.passed) ? (
              <ul className="failure-validation-list">
                {failureSummary.validationReport.checks
                  .filter((c) => !c.passed)
                  .map((c, i) => (
                    <li key={i}>
                      {c.scope} · {c.code}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <EmptyState
            description="草稿就绪后，点击导出即可生成 DOCX 报告与更新后的资源池表格。"
            eyebrow="导出区"
            title="等待导出"
          />
        )}
      </div>

      {/* ── Side column: candidate pool ─────────────────────────────── */}
      <div className="report-side-column">
        <section className="console-section candidate-zone">
          <header>
            <h2>
              {profile.poolTitle} · {today}
            </h2>
            {canCreateTask ? (
              <div className="issue-number-control">
                <label>
                  <span>期号</span>
                  <input
                    inputMode="numeric"
                    placeholder="如 1189"
                    value={issueNumber}
                    onChange={(event) => setIssueNumber(event.target.value.replace(/\D/g, ''))}
                  />
                </label>
                <button className="primary-button" disabled={busy} type="button" onClick={handleCreateTask}>
                  {busy ? '创建中…' : '开始今日日报'}
                </button>
              </div>
            ) : pool ? (
              <span>{pool.candidates?.length ?? 0} 条候选</span>
            ) : null}
          </header>

          {pool && pool.candidates?.length > 0 ? (
            <>
              {pool.candidates.map((candidate) => {
                const isSelected = selectedCandidateIds.includes(candidate.id)
                const selectionDisabled =
                  selectionsLocked || (!isSelected && selectedCandidateIds.length >= MIN_SELECTION_COUNT)
                return (
                  <label
                    className={`candidate-row${isSelected ? ' is-selected' : ''}${
                      selectionDisabled ? ' is-disabled' : ''
                    }`}
                    key={candidate.id}
                  >
                    <input
                      checked={isSelected}
                      disabled={selectionDisabled}
                      type="checkbox"
                      onChange={() => toggleCandidate(candidate.id)}
                    />
                    <span className="candidate-title">{candidate.title}</span>
                    <span className="candidate-source">{candidate.sourceName}</span>
                    <time className="candidate-time">
                      {candidate.publishedAt ? candidate.publishedAt.slice(0, 10) : ''}
                    </time>
                  </label>
                )
              })}
            </>
          ) : pool === null && !error ? (
            <EmptyState
              description="正在获取今日候选列表。"
              eyebrow={profile.poolTitle}
              title="加载候选池"
            />
          ) : !pool && error ? (
            <EmptyState description={error} eyebrow={profile.poolTitle} title="候选池不可用" />
          ) : null}
        </section>
      </div>
    </section>
  )
}
