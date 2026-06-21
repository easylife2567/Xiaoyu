import React from 'react'
import { ConsoleShell } from '../../../../components/console-shell.jsx'

export default function DailyTrendsPage() {
  return (
    <ConsoleShell
      activeSlug="po-daily-trends"
      description="舆情随时间的趋势变化与构成占比。"
      eyebrow="舆情速览 · 每日舆情"
      title="趋势与占比"
    >
      <section className="console-section placeholder-state">
        <h2>功能建设中</h2>
        <p>趋势与占比能力尚未接入，后续将在此以图表展示舆情走势与分布占比。</p>
      </section>
    </ConsoleShell>
  )
}
