import React from 'react'
import { ConsoleShell } from '../../components/console-shell.jsx'

export default function SettingsPage() {
  return (
    <ConsoleShell
      activeSlug="settings"
      description="管理成员、角色与工作台访问权限。"
      eyebrow="管理"
      title="权限管理"
    >
      <section className="console-section placeholder-state">
        <h2>功能建设中</h2>
        <p>权限管理能力尚未接入，后续将在此配置成员角色与各工作台的访问范围。</p>
      </section>
    </ConsoleShell>
  )
}
