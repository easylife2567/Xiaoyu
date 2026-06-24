import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import HomePage from '../app/page.jsx'
import PublicOpinionOverviewPage from '../app/public-opinion/page.jsx'
import DailySummaryPage from '../app/public-opinion/daily/page.jsx'
import DailyPolarityPage from '../app/public-opinion/daily/polarity/page.jsx'
import DailyTrendsPage from '../app/public-opinion/daily/trends/page.jsx'
import SentimentTodayPage from '../app/public-opinion/sentiment/today/page.jsx'
import SentimentRangePage from '../app/public-opinion/sentiment/range/page.jsx'

/**
 * 舆情速览导航模块测试 — 守护 public-opinion-overview 与 workbench-shell-ux
 * (可折叠嵌套子分组)契约。
 *
 * SSR 测试原则:用 renderToStaticMarkup 断言导航结构 / aria-expanded / 高亮;
 * 真实滚动与折叠动效由人工 viewport 验证(详见 design.md)。
 */

test('舆情速览分组在 sidebar 中与工作台、管理并列', () => {
  const html = renderToStaticMarkup(HomePage())
  assert.match(html, /舆情速览/)
  assert.match(html, /舆情总览/)
  assert.match(html, /每日舆情/)
  assert.match(html, /情感倾向/)

  // 三个顶层分组的相对顺序:工作台 → 舆情速览 → 管理
  const idxWorkbench = html.indexOf('工作台')
  const idxPublicOpinion = html.indexOf('舆情速览')
  const idxManage = html.indexOf('>管理<')
  assert.ok(idxWorkbench < idxPublicOpinion, '工作台应在舆情速览之前')
  assert.ok(idxPublicOpinion < idxManage, '舆情速览应在管理之前')
})

test('舆情总览作为独立条目链接到 /public-opinion', () => {
  const html = renderToStaticMarkup(HomePage())
  assert.match(html, /href="\/public-opinion"/)
})

test('未命中子条目时,两个子分组默认收起(aria-expanded=false 且子条目不渲染)', () => {
  const html = renderToStaticMarkup(HomePage())
  assert.match(html, /aria-expanded="false"/)
  // 收起态下子条目不应出现在 DOM
  assert.doesNotMatch(html, /正负面舆情/)
  assert.doesNotMatch(html, /趋势与占比/)
  assert.doesNotMatch(html, /今日情感分析/)
})

test('当前页位于「每日舆情」子条目时,该子分组默认展开、情感倾向保持收起', () => {
  const html = renderToStaticMarkup(DailyPolarityPage())
  // 每日舆情子分组展开:其子条目渲染
  assert.match(html, /正负面舆情/)
  assert.match(html, /趋势与占比/)
  assert.match(html, /aria-expanded="true"/)
  // 情感倾向子分组保持收起:其子条目不渲染
  assert.doesNotMatch(html, /今日情感分析/)
  assert.doesNotMatch(html, /任意时间段情感分析/)
})

test('当前子条目在 sidebar 中高亮(is-active)', () => {
  const html = renderToStaticMarkup(DailyPolarityPage())
  assert.match(html, /nav-item nav-subitem is-active[^>]*>[^<]*<strong>正负面舆情/)
})

test('既有扁平分组条目不带可折叠交互(chevron/aria-expanded 仅属于子分组)', () => {
  const html = renderToStaticMarkup(HomePage())
  // sidebar 中只有「每日舆情」「情感倾向」两个可折叠子分组
  const chevrons = html.match(/nav-chevron/g) ?? []
  const toggles = html.match(/aria-expanded=/g) ?? []
  assert.equal(chevrons.length, 2, '应恰好有两个子分组 chevron')
  assert.equal(toggles.length, 2, '应恰好有两个 aria-expanded 子分组标题')
  // 工作台总览等扁平条目仍是锚点链接
  assert.match(html, /<a[^>]*href="\/"/)
})

const publicOpinionPages = [
  ['每日舆情', DailySummaryPage],
  ['趋势与占比', DailyTrendsPage],
  ['今日情感分析', SentimentTodayPage],
  ['任意时间段情感分析', SentimentRangePage],
]

for (const [title, Page] of publicOpinionPages) {
  test(`占位页「${title}」在 console shell 内渲染且展示功能建设中`, () => {
    const html = renderToStaticMarkup(Page())
    assert.match(html, new RegExp(title))
    assert.match(html, /主导航/)
    assert.match(html, /小舆工作台/)
    assert.match(html, /功能建设中/)
  })
}

test('舆情总览页呈现数据看板(不再是功能建设中占位)', () => {
  const html = renderToStaticMarkup(PublicOpinionOverviewPage())
  assert.match(html, /舆情总览/)
  assert.match(html, /主导航/)
  assert.match(html, /po-dashboard/)
  assert.doesNotMatch(html, /功能建设中/)
})

test('正负面舆情页呈现分析页(不再是功能建设中占位)', () => {
  const html = renderToStaticMarkup(DailyPolarityPage())
  assert.match(html, /正负面舆情/)
  assert.match(html, /主导航/)
  // 渲染 DailyPolarityBoard 容器,不再是 placeholder-state
  assert.match(html, /po-polarity-shell/)
  assert.doesNotMatch(html, /功能建设中/)
})
