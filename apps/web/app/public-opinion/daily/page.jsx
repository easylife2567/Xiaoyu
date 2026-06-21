import React from 'react'
import { ConsoleShell } from '../../../components/console-shell.jsx'

export default function DailySummaryPage() {
  return (
    <ConsoleShell
      activeSlug="po-daily-summary"
      description="按日聚合的舆情概览。"
      eyebrow="舆情速览 · 每日舆情"
      title="每日舆情"
    >
      <section className="console-section placeholder-state">
        <h2>功能建设中</h2>
        <p>每日舆情能力尚未接入，后续将在此展示按日聚合的舆情条目与统计。</p>
      </section>
    </ConsoleShell>
  )
}
