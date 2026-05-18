import React from 'react'
import './globals.css'

export const metadata = {
  title: '小舆工作台',
  description: '面向内部舆情生产流程的小舆工作台',
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
