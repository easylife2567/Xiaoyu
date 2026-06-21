import React from 'react'
import { ConsoleShell } from '../../../../components/console-shell.jsx'

export default function SentimentTodayPage() {
  return (
    <ConsoleShell
      activeSlug="po-sentiment-today"
      description="当日舆情的情感倾向分析。"
      eyebrow="舆情速览 · 情感倾向"
      title="今日情感分析"
    >
      <section className="console-section placeholder-state">
        <h2>功能建设中</h2>
        <p>今日情感分析能力尚未接入，后续将在此展示当日舆情的情感倾向分布。</p>
      </section>
    </ConsoleShell>
  )
}
