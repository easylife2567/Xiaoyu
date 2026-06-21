import React from 'react'
import { ConsoleShell } from '../../../../components/console-shell.jsx'

export default function SentimentRangePage() {
  return (
    <ConsoleShell
      activeSlug="po-sentiment-range"
      description="自定义时间段内的情感倾向分析。"
      eyebrow="舆情速览 · 情感倾向"
      title="任意时间段情感分析"
    >
      <section className="console-section placeholder-state">
        <h2>功能建设中</h2>
        <p>任意时间段情感分析能力尚未接入，后续将在此按所选时间范围统计情感倾向。</p>
      </section>
    </ConsoleShell>
  )
}
