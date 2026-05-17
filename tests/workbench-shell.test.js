import test from 'node:test'
import assert from 'node:assert/strict'

import {
  renderDailyReportWorkbench,
  getWorkbenchByRoute,
  renderHomePage,
  renderTranslationWorkbench,
  renderWorkbenchFrame,
} from '../src/workbenches.js'

test('home page exposes the three v1 workbench entries', () => {
  const html = renderHomePage()

  assert.match(html, /大翻译数据处理/)
  assert.match(html, /国际日报/)
  assert.match(html, /国际热点日报二处/)
})

test('routing resolves each supported workbench', () => {
  assert.equal(getWorkbenchByRoute('/translation')?.title, '大翻译数据处理')
  assert.equal(getWorkbenchByRoute('/international-daily')?.title, '国际日报')
  assert.equal(getWorkbenchByRoute('/hotspot-daily')?.title, '国际热点日报二处')
})

test('shared workbench frame renders title, subtitle, explanation, status, and empty state', () => {
  const html = renderWorkbenchFrame({
    title: '示例工作台',
    subtitle: '示例副标题',
    description: '示例说明',
    body: '<p>正文</p>',
  })

  assert.match(html, /示例工作台/)
  assert.match(html, /示例副标题/)
  assert.match(html, /示例说明/)
  assert.match(html, /尚未开始/)
  assert.match(html, /正文/)
})

test('translation workbench renders a single excel upload flow without low-level configuration', () => {
  const html = renderTranslationWorkbench()

  assert.match(html, /上传原始 Excel/)
  assert.match(html, /仅支持 Excel 文件/)
  assert.match(html, /输入识别/)
  assert.match(html, /任务状态/)
  assert.match(html, /结果交付/)
  assert.doesNotMatch(html, /Sheet/)
  assert.doesNotMatch(html, /列映射/)
  assert.doesNotMatch(html, /模型/)
})

test('daily report workbench renders candidate-selection regions without topic-file upload', () => {
  const html = renderDailyReportWorkbench({
    title: '国际日报',
    subtitle: '从今日国际热点生成正式日报',
    description: '测试说明',
  })

  assert.match(html, /候选池/)
  assert.match(html, /已选篮子/)
  assert.match(html, /正文草稿/)
  assert.match(html, /导出/)
  assert.doesNotMatch(html, /上传选题文件/)
})

test('daily report workbenches keep distinct copy', () => {
  const internationalDaily = renderDailyReportWorkbench(
    getWorkbenchByRoute('/international-daily'),
  )
  const hotspotDaily = renderDailyReportWorkbench(
    getWorkbenchByRoute('/hotspot-daily'),
  )

  assert.match(internationalDaily, /今日国际热点/)
  assert.match(hotspotDaily, /AI 与城市治理热点/)
})

test('shells expose honest placeholder states and only matching start affordances', () => {
  const translationHtml = renderTranslationWorkbench()
  const reportHtml = renderDailyReportWorkbench(
    getWorkbenchByRoute('/international-daily'),
  )

  assert.match(translationHtml, /尚未开始/)
  assert.match(translationHtml, /等待文件上传/)
  assert.match(translationHtml, /开始处理/)
  assert.match(translationHtml, /真实处理能力尚未接入/)

  assert.match(reportHtml, /等待每日候选池接入/)
  assert.match(reportHtml, /尚未选择新闻/)
  assert.match(reportHtml, /后续将在这里展示/)
  assert.doesNotMatch(reportHtml, /开始处理/)
})
