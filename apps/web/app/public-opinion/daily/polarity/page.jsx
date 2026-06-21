import React from 'react'
import { ConsoleShell } from '../../../../components/console-shell.jsx'

export default function DailyPolarityPage() {
  return (
    <ConsoleShell
      activeSlug="po-daily-polarity"
      description="区分正面与负面的当日舆情分布。"
      eyebrow="舆情速览 · 每日舆情"
      title="正负面舆情"
    >
      <section className="console-section placeholder-state">
        <h2>功能建设中</h2>
        <p>正负面舆情能力尚未接入，后续将在此展示正面/负面舆情的分类与明细。</p>
      </section>
    </ConsoleShell>
  )
}
