import React from 'react'
import { notFound } from 'next/navigation'
import { DailyReportWorkbenchBody } from '../../../components/daily-report-workbench.jsx'
import { TranslationWorkbenchBody } from '../../../components/translation-workbench.jsx'
import { WorkbenchFrame } from '../../../components/workbench-shell.jsx'
import { getWorkbenchBySlug } from '../../../src/workbenches.js'

export default async function WorkbenchPage({ params }) {
  const { slug } = await params
  const workbench = getWorkbenchBySlug(slug)

  if (!workbench) {
    notFound()
  }

  if (workbench.kind === 'file-processing') {
    return (
      <WorkbenchFrame {...workbench}>
        <TranslationWorkbenchBody />
      </WorkbenchFrame>
    )
  }

  return (
    <WorkbenchFrame {...workbench}>
      <DailyReportWorkbenchBody profile={workbench.reportProfile} />
    </WorkbenchFrame>
  )
}
