import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * v2 看板布局/新图/信息流升级守护测试 — 静态源码断言。
 * 真实视觉与轮询交互由人工 viewport / DevTools Network 验证。
 */

const cssPath = path.resolve(import.meta.dirname, '../app/globals.css')
const cssText = readFileSync(cssPath, 'utf8')
const dashPath = path.resolve(
  import.meta.dirname,
  '../components/public-opinion-overview-dashboard.jsx',
)
const dashText = readFileSync(dashPath, 'utf8')
const d3UtilsPath = path.resolve(import.meta.dirname, '../src/public-opinion/d3-utils.js')
const d3UtilsText = readFileSync(d3UtilsPath, 'utf8')

test('CSS 含 .po-overview-main / .po-overview-aside / .po-overview-grid', () => {
  assert.match(cssText, /\.po-overview-main\s*\{/)
  assert.match(cssText, /\.po-overview-aside\s*\{/)
  assert.match(cssText, /\.po-overview-grid\s*\{/)
})

test('CSS aside 使用 sticky + 内部滚动', () => {
  const aside = cssText.match(/\.po-overview-aside\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(aside, /position:\s*sticky/)
  assert.match(aside, /overflow-y:\s*auto/)
  // v3:aside top 从 84px 降为 0(与 KPI rail 顶部基线对齐)
  assert.match(aside, /top:\s*0/)
})

test('CSS 含 v2 中等密度 token(--po-pad / --po-gap / --po-panel-radius)', () => {
  assert.match(cssText, /--po-pad/)
  assert.match(cssText, /--po-gap/)
  assert.match(cssText, /--po-panel-radius/)
  assert.match(cssText, /--po-title-size/)
})

test('CSS 含 1280px 断点塌单列(aside 失去 sticky)', () => {
  assert.match(cssText, /@media \(max-width: 1280px\)/)
  // 1280 段必须把 dashboard 改为 1fr
  const block = cssText.match(/@media \(max-width: 1280px\)\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(block, /grid-template-columns:\s*1fr/)
})

test('CSS 含 v2 信息流 chip / emo bar / risk / live-dot', () => {
  assert.match(cssText, /\.po-feed-chip\s*\{/)
  assert.match(cssText, /\.po-feed-emo-bar\s*\{/)
  assert.match(cssText, /\.po-feed-item\.is-risk\s*\{/)
  assert.match(cssText, /\.po-live-dot\s*\{/)
})

test('CSS reduced-motion 守护(脉冲 / sparkline / 卡片入场)', () => {
  assert.match(cssText, /@media \(prefers-reduced-motion:\s*reduce\)/)
})

test('看板组件含 v2 新图组件定义', () => {
  assert.match(dashText, /function StackedSentimentArea\(/)
  assert.match(dashText, /function HourlyMediaHeat\(/)
  assert.match(dashText, /function MediaSentimentPercentBar\(/)
  assert.match(dashText, /function Sparkline\(/)
})

test('看板组件含 v2 双列结构 + 信息流升级', () => {
  // 双列结构(v2/v3 共同保留 main+aside;v3 已用 Band 取代 .po-overview-grid 顶层栅格)
  assert.match(dashText, /className="po-overview-main"/)
  assert.match(dashText, /className="po-overview-aside"/)
  // 信息流升级
  assert.match(dashText, /function FeedChips\(/)
  assert.match(dashText, /po-feed-emo-bar/)
  assert.match(dashText, /po-live-dot/)
  assert.match(dashText, /is-risk/)
})

test('看板组件含 30s 轮询(useInterval + 30_000 + slice=latest)', () => {
  assert.match(dashText, /function useInterval\(/)
  assert.match(dashText, /30[_,]?000/)
  assert.match(dashText, /slice=latest/)
  // visibilityState 守护
  assert.match(dashText, /visibilityState/)
})

test('d3-utils 暴露 sparklinePath', () => {
  assert.match(d3UtilsText, /export (function|const) sparklinePath\b/)
  // 仍按需引入,不引整个 d3
  assert.doesNotMatch(d3UtilsText, /from 'd3'/)
  assert.doesNotMatch(d3UtilsText, /from 'd3-selection'/)
})

test('看板组件使用 sparklinePath + Sparkline 注入到 KpiTile', () => {
  assert.match(dashText, /import\s*\{[^}]*sparklinePath[^}]*\}\s*from/)
  assert.match(dashText, /<Sparkline /)
  assert.match(dashText, /sparkPoints/)
})

test('mock 模式下提示信息(console.info 与 live-dot.is-mock)', () => {
  assert.match(dashText, /console\.info\(.*mock/)
  assert.match(dashText, /is-mock/)
})

test('aria-pressed 与 role="button" 标注 chip 状态(a11y)', () => {
  assert.match(dashText, /aria-pressed/)
  assert.match(dashText, /role="button"/)
})

test('overview.js 含 weeklySentiment / todayHourlyByMedia 派生', () => {
  const overviewPath = path.resolve(
    import.meta.dirname,
    '../src/public-opinion/overview.js',
  )
  const overviewText = readFileSync(overviewPath, 'utf8')
  assert.match(overviewText, /deriveWeeklySentiment|weeklySentiment/)
  assert.match(overviewText, /deriveTodayHourlyByMedia|todayHourlyByMedia/)
  // limit 已经 15 → 30
  assert.match(overviewText, /number:\s*30/)
  // sentiment 字段已挂到信息流条目
  assert.match(overviewText, /sentiment:/)
})
