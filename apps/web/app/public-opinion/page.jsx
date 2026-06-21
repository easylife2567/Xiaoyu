import React from 'react'
import { ConsoleShell } from '../../components/console-shell.jsx'
import { PublicOpinionOverviewDashboard } from '../../components/public-opinion-overview-dashboard.jsx'

export default function PublicOpinionOverviewPage() {
  return (
    <ConsoleShell
      activeSlug="po-overview"
      description="从关键指标、本周趋势、情感分布与媒体来源多角度速览舆情态势。"
      eyebrow="舆情速览"
      title="舆情总览"
    >
      <PublicOpinionOverviewDashboard />
    </ConsoleShell>
  )
}
