import React from 'react'
import { EmptyState } from './workbench-shell.jsx'

export function DailyReportWorkbenchBody({ profile }) {
  return (
    <section className="report-console">
      <div className="report-focus-strip">
        <span>筛选侧重</span>
        <strong>{profile.focus}</strong>
        <em>{profile.poolDescription}</em>
      </div>

      <section className="console-section candidate-zone">
        <header>
          <h2>{profile.poolTitle}</h2>
          <span>待接入</span>
        </header>
        <div className="placeholder-table">
          <span>新闻标题</span>
          <span>来源</span>
          <span>发布时间</span>
          <span>选择</span>
        </div>
        <div className="placeholder-rows" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p>候选池接入后，将在这里展示当天新闻、来源与发布时间。</p>
      </section>

      <section className="console-section selected-zone">
        <header>
          <h2>已选篮子</h2>
          <span>0 / 6</span>
        </header>
        <strong>待选择</strong>
        <p>从左侧候选池中选择 6 条后，这里会显示顺序与结构。</p>
      </section>

      <section className="draft-zone">
        <EmptyState eyebrow="正文草稿" title="等待生成" description="选择完成后，系统会在这里承接后续的轻量编辑流程。" />
        <EmptyState eyebrow="导出区" title="尚未生成产物" description="导出能力接入后，成品文件会从这里交付。" />
      </section>
    </section>
  )
}
