import React from 'react'
import { ConsoleShell } from '../../../../components/console-shell.jsx'
import { DailyTodayBoard } from '../../../../components/public-opinion-daily-today-board.jsx'

export default function DailyTodayPage() {
  return (
    <ConsoleShell
      activeSlug="po-daily-summary"
      description="按监测词聚合当日 6/12/24 小时内全平台的原始信息流,按时间倒序展开。支持平台筛选、关键词搜索、行级勾选与 CSV 导出;新数据通过顶部横条主动加载。"
      eyebrow="舆情速览 · 每日舆情"
      title="每日舆情"
    >
      <DailyTodayBoard />
    </ConsoleShell>
  )
}
