import React from 'react'
import { ConsoleShell } from '../../components/console-shell.jsx'

export default function ArtifactsPage() {
  return (
    <ConsoleShell
      activeSlug="artifacts"
      description="集中查看与下载各工作台产出的结果文件。"
      eyebrow="管理"
      title="产物归档"
    >
      <section className="console-section placeholder-state">
        <h2>功能建设中</h2>
        <p>产物归档能力尚未接入，后续将在此汇总各工作台的历史产出与下载入口。</p>
      </section>
    </ConsoleShell>
  )
}
