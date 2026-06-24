import React from 'react'
import { ConsoleShell } from '../../../../components/console-shell.jsx'
import { DailyPolarityBoard } from '../../../../components/public-opinion-polarity-board.jsx'

export default function DailyPolarityPage() {
  return (
    <ConsoleShell
      activeSlug="po-daily-polarity"
      description="按情感档位与平台筛选当日 / 7 天 / 自定义时间窗内的舆情条目,可批量导出。"
      eyebrow="舆情速览 · 每日舆情"
      title="正负面舆情"
    >
      <DailyPolarityBoard />
    </ConsoleShell>
  )
}
