import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import PublicOpinionOverviewPage from '../app/public-opinion/page.jsx'

/**
 * 密度化重构守护测试 — 锁定信息惯用语 + d3 自定义不被回退。
 * SSR 上看到的是加载骨架(数据 fetch 在 useEffect 触发);
 * 数据态下的实际组件结构通过组件源码搜索断言。
 */

const cssPath = path.resolve(import.meta.dirname, '../app/globals.css')
const cssText = readFileSync(cssPath, 'utf8')
const dashPath = path.resolve(import.meta.dirname, '../components/public-opinion-overview-dashboard.jsx')
const dashText = readFileSync(dashPath, 'utf8')
const d3UtilsPath = path.resolve(import.meta.dirname, '../src/public-opinion/d3-utils.js')
const d3UtilsText = readFileSync(d3UtilsPath, 'utf8')

test('CSS 定义 12 列栅格 + data-span 属性选择器', () => {
  assert.match(cssText, /\.po-grid-12\s*\{[^}]*grid-template-columns:\s*repeat\(12,\s*1fr\)/)
  assert.match(cssText, /\.po-grid-12\s*>\s*\[data-span='12'\]/)
})

test('KPI 紧凑条样式存在(po-kpi-bar / po-kpi-tile)', () => {
  assert.match(cssText, /\.po-kpi-bar\s*\{/)
  assert.match(cssText, /\.po-kpi-tile\s*\{/)
})

test('热力矩阵 / MiniDonut / 双 chip 样式存在', () => {
  assert.match(cssText, /\.po-heatmap-cell\s*\{/)
  assert.match(cssText, /\.po-mini-donut\s*\{/)
  assert.match(cssText, /\.po-chip--primary\s*\{/)
  assert.match(cssText, /\.po-chip-bar\s*\{/)
})

test('卡片入场 stagger 动画定义', () => {
  assert.match(cssText, /@keyframes po-card-in/)
  assert.match(cssText, /@keyframes po-donut-grow/)
})

test('组件按需引入 d3 子包(不引整个 d3)', () => {
  assert.match(d3UtilsText, /from 'd3-scale'/)
  assert.match(d3UtilsText, /from 'd3-scale-chromatic'/)
  assert.match(d3UtilsText, /from 'd3-shape'/)
  assert.match(d3UtilsText, /from 'd3-array'/)
  // 严守边界:不引 d3-selection 直接操作 DOM
  assert.doesNotMatch(d3UtilsText, /from 'd3-selection'/)
  // 严守边界:不整体引 d3
  assert.doesNotMatch(d3UtilsText, /from 'd3'/)
})

test('d3-utils 暴露关键工具', () => {
  for (const sym of ['blueScale', 'donutArcPath', 'useCountUp', 'contrastTextOn']) {
    assert.match(d3UtilsText, new RegExp(`export (function|const) ${sym}\\b`))
  }
})

test('看板组件使用 MiniDonut 与 Heatmap 子组件 + ReferenceLine 均值线', () => {
  assert.match(dashText, /function MiniDonut\(/)
  assert.match(dashText, /function Heatmap\(/)
  assert.match(dashText, /function RankRow\(/)
  assert.match(dashText, /function KpiBar\(/)
  // 情感分布渲染 5 个 MiniDonut(由 sentiment.map 驱动)
  assert.match(dashText, /sentiment\.map\(\(entry\) => \(\s*<MiniDonut/)
  // 趋势加 Avg 均值线
  const refLines = dashText.match(/<ReferenceLine /g) ?? []
  assert.ok(refLines.length >= 2, '本周趋势 + 今日分时 应各有一条 ReferenceLine')
})

test('情感 5 模态保留语义色序(正面绿→负面红)', () => {
  assert.match(dashText, /正面:\s*'#00b42a'/)
  assert.match(dashText, /负面:\s*'#f53f3f'/)
})

test('SSR 加载态使用 12 列栅格 + data-span 骨架', () => {
  const html = renderToStaticMarkup(PublicOpinionOverviewPage())
  assert.match(html, /class="po-dashboard"/)
  assert.match(html, /po-grid-12/)
  assert.match(html, /data-span="12"/)
  assert.match(html, /主导航/)
})
