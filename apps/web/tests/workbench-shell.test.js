import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DAILY_REPORT_WORKBENCHES,
  FILE_PROCESSING_WORKBENCH,
  WORKBENCHES,
} from '../src/workbenches.js'
import HomePage from '../app/page.jsx'
import WorkbenchPage from '../app/workbenches/[slug]/page.jsx'

test('home page renders as an enterprise console overview', () => {
  const html = renderToStaticMarkup(HomePage())

  assert.equal(WORKBENCHES.length, 3)
  assert.match(html, /小舆工作台/)
  assert.match(html, /工作台总览/)
  assert.match(html, /主导航/)
  assert.match(html, /为你推荐以下工作台/)
  assert.match(html, /常用工作台/)
  assert.match(html, /全部工作台/)
  assert.match(html, /选择工作台/)
  assert.match(html, /快捷工具/)
  assert.match(html, /更多工作台/)
  assert.doesNotMatch(html, /华北 2（北京）/)
  assert.doesNotMatch(html, /默认业务空间/)
  assert.doesNotMatch(html, /workbench-card/)
})

test('translation workbench renders as an operations console', async () => {
  const html = renderToStaticMarkup(await WorkbenchPage({ params: { slug: FILE_PROCESSING_WORKBENCH.slug } }))

  assert.match(html, /文件输入/)
  assert.match(html, /上传原始 Excel/)
  assert.match(html, /处理流程/)
  assert.match(html, /输入识别/)
  assert.match(html, /结果交付/)
  assert.match(html, /开始处理/)
  assert.doesNotMatch(html, /列位映射/)
  assert.doesNotMatch(html, /模型设置/)
})

test('daily-report workbenches expose console zones without topic-file uploads', async () => {
  for (const workbench of DAILY_REPORT_WORKBENCHES) {
    const html = renderToStaticMarkup(await WorkbenchPage({ params: { slug: workbench.slug } }))
    assert.match(html, /已选篮子/)
    assert.match(html, /待选择/)
    assert.match(html, /正文草稿/)
    assert.match(html, /导出区/)
    assert.match(html, /生产链路/)
    assert.doesNotMatch(html, /上传选题文件/)
  }
})

test('daily-report variants carry distinct editorial focus', async () => {
  const generalHtml = renderToStaticMarkup(
    await WorkbenchPage({ params: { slug: 'international-daily-report' } }),
  )
  const focusedHtml = renderToStaticMarkup(
    await WorkbenchPage({ params: { slug: 'international-hotspot-daily-report' } }),
  )

  assert.match(generalHtml, /综合国际热点/)
  assert.match(generalHtml, /今日候选池/)
  assert.match(focusedHtml, /AI 与城市治理/)
  assert.match(focusedHtml, /专题候选池/)
})

test('all pages expose console shell affordances', async () => {
  const translationHtml = renderToStaticMarkup(
    await WorkbenchPage({ params: { slug: FILE_PROCESSING_WORKBENCH.slug } }),
  )
  assert.match(translationHtml, /skip to main content/i)
  assert.match(translationHtml, /主导航/)
  assert.match(translationHtml, /折叠侧栏/)
  assert.match(translationHtml, /尚未开始/)
  assert.match(translationHtml, /处理中/)
  assert.match(translationHtml, /已完成/)
  assert.match(translationHtml, /失败/)
})
