import React from 'react'
import { ConsoleShell } from '../components/console-shell.jsx'

export default function NotFound() {
  return (
    <ConsoleShell description="当前路径没有对应的工作台。" eyebrow="404" title="未找到工作台">
      <section className="console-section not-found-state">
        <h2>页面不存在</h2>
        <p>请通过左侧主导航重新选择工作台。</p>
      </section>
    </ConsoleShell>
  )
}
