import React from 'react'
import { ConsoleShell } from '../components/console-shell.jsx'
import { WorkbenchLauncher } from '../components/workbench-launcher.jsx'

export default function HomePage() {
  return (
    <ConsoleShell
      activeSlug="overview"
      description="选择你今天要处理的生产任务。"
      eyebrow="Workspace"
      title="工作台总览"
    >
      <WorkbenchLauncher />
      <section className="experience-empty-state">
        <strong>请选择工作台，再开始处理</strong>
      </section>
    </ConsoleShell>
  )
}
