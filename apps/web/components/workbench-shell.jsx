import React from 'react'
import { ConsoleShell } from './console-shell.jsx'

export const SHELL_STATUS_STATES = ['尚未开始', '等待后续能力接入', '处理中', '已完成', '失败']

export function WorkbenchFrame({ slug, kind, title, subtitle, description, children }) {
  return (
    <ConsoleShell activeSlug={slug} description={description} eyebrow={subtitle} title={title}>
      <section className="workflow-status" aria-label="处理状态">
        <header>
          <h2>{kind === 'daily-report' ? '生产链路' : '处理流程'}</h2>
          <span>当前状态 · 尚未开始</span>
        </header>
        <ol>
          {SHELL_STATUS_STATES.map((state, index) => (
            <li className={index === 0 ? 'is-current' : ''} key={state}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{state}</strong>
            </li>
          ))}
        </ol>
      </section>
      {children}
    </ConsoleShell>
  )
}

export function EmptyState({ eyebrow, title, description }) {
  return (
    <section className="console-subsection empty-state">
      <p>{eyebrow}</p>
      <h3>{title}</h3>
      <span>{description}</span>
    </section>
  )
}
