import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * v3 控制台分区视觉守护测试 — 静态源码断言。
 * - KPI rail 取代 KpiBar + 预警 Panel(三 KPI + 7d mini + alert badge)
 * - 中部分析区由 3 个 <Band> 组成(态势 / 结构 / 热点)
 * - .po-tile 取代 .po-panel 作为图表槽(无边框 + hover 浅底)
 * - aside top:0 与 rail 顶端基线对齐
 * 真实视觉与悬停交互由人工 viewport 校验。
 */

const cssPath = path.resolve(import.meta.dirname, '../app/globals.css')
const cssText = readFileSync(cssPath, 'utf8')
const dashPath = path.resolve(
  import.meta.dirname,
  '../components/public-opinion-overview-dashboard.jsx',
)
const dashText = readFileSync(dashPath, 'utf8')

test('CSS 含 v3 控制台分区主键类(.po-rail / .po-band / .po-tile)', () => {
  assert.match(cssText, /\.po-rail\s*\{/)
  assert.match(cssText, /\.po-band\s*\{/)
  assert.match(cssText, /\.po-band-label\s*\{/)
  assert.match(cssText, /\.po-band-grid\s*\{/)
  assert.match(cssText, /\.po-tile\s*\{/)
})

test('CSS .po-tile 无外边框、无外阴影、hover 仅切换 background', () => {
  const tile = cssText.match(/\.po-tile\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(tile, /border:\s*0/)
  assert.match(tile, /background:\s*transparent/)
  assert.doesNotMatch(tile, /box-shadow:/)
  const hover = cssText.match(/\.po-tile:hover\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(hover, /background:\s*var\(--po-tile-hover-bg/)
  // hover 不引入 transform 或位移
  assert.doesNotMatch(hover, /transform:/)
})

test('CSS .po-band 顶部 1px hairline 作为弱分隔', () => {
  const label = cssText.match(/\.po-band-label\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(label, /border-top:\s*1px solid var\(--color-divider\)/)
})

test('CSS .po-alert-badge 三态(idle/warn/major)', () => {
  assert.match(cssText, /\.po-alert-badge\s*\{/)
  assert.match(cssText, /\.po-alert-badge\[data-state='idle'\]/)
  assert.match(cssText, /\.po-alert-badge\[data-state='warn'\]/)
  assert.match(cssText, /\.po-alert-badge\[data-state='major'\]/)
})

test('CSS .po-alert-popover 含计数与关键词云容器锚点', () => {
  assert.match(cssText, /\.po-alert-popover\s*\{/)
  assert.match(cssText, /\.po-alert-popover-counts\s*\{/)
})

test('CSS aside top: 0 与 rail 顶端对齐', () => {
  const aside = cssText.match(/\.po-overview-aside\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(aside, /top:\s*0/)
})

test('CSS v3 token 密度下调一档(pad/gap/radius/title-size)', () => {
  const dash = cssText.match(/\.po-dashboard\s*\{[\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(dash, /--po-pad:\s*10px/)
  assert.match(dash, /--po-gap:\s*10px/)
  assert.match(dash, /--po-panel-radius:\s*8px/)
  assert.match(dash, /--po-title-size:\s*12px/)
})

test('CSS reduced-motion 守护 .po-alert-badge 与 .po-tile transition', () => {
  // 至少出现两次 reduced-motion 块(rail / tile / alert 等)
  const matches = cssText.match(/@media \(prefers-reduced-motion:\s*reduce\)/g) ?? []
  assert.ok(matches.length >= 2, `reduced-motion 块至少 2 处,当前 ${matches.length}`)
})

test('看板组件含 KpiRail / Band / AlertBadge', () => {
  assert.match(dashText, /function KpiRail\(/)
  assert.match(dashText, /function Band\(/)
  assert.match(dashText, /function AlertBadge\(/)
})

test('看板组件渲染 3 个 <Band>,语义标签分别为 态势 / 结构 / 热点', () => {
  const bandUses = dashText.match(/<Band\s+label="([^"]+)"\s+latin="([^"]+)"/g) ?? []
  assert.equal(bandUses.length, 3, `期望 3 个 <Band>,实际 ${bandUses.length}`)
  assert.match(dashText, /<Band\s+label="态势"\s+latin="trend"/)
  assert.match(dashText, /<Band\s+label="结构"\s+latin="composition"/)
  assert.match(dashText, /<Band\s+label="热点"\s+latin="hot spots"/)
})

test('看板组件不再渲染独立「预警概览」Panel(由 KpiRail 内 AlertBadge 接管)', () => {
  assert.doesNotMatch(dashText, /title="预警概览"/)
  // 预警数据仍传给 KpiRail
  assert.match(dashText, /<KpiRail[\s\S]{0,200}warnings=/)
})

test('看板组件 Panel 内部已切换至 .po-tile / .po-tile-head 结构', () => {
  const panelFn = dashText.match(/function Panel\([\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(panelFn, /className="po-tile"/)
  assert.match(panelFn, /className="po-tile-head"/)
  // 不再使用 .po-panel + console-section 外框
  assert.doesNotMatch(panelFn, /className="po-panel console-section"/)
})

test('KpiRail 含 7d 态势 mini + AlertBadge 槽', () => {
  const rail = dashText.match(/function KpiRail\([\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(rail, /className="po-rail"/)
  assert.match(rail, /className="po-rail-mini"/)
  assert.match(rail, /<AlertBadge\s/)
})

test('AlertBadge 含 idle/warn/major 三态判定与 a11y 属性', () => {
  const fn = dashText.match(/function AlertBadge\([\s\S]*?\n\}/)?.[0] ?? ''
  assert.match(fn, /data-state=\{state\}/)
  assert.match(fn, /aria-expanded/)
  assert.match(fn, /aria-haspopup="dialog"/)
  // popover 关闭交互:ESC + 点击外部
  assert.match(fn, /Escape/)
  assert.match(fn, /mousedown/)
})

test('v2 守护仍通过(双列、新图、轮询、mock)', () => {
  // 关键 v2 特征在 v3 仍存在
  assert.match(dashText, /className="po-overview-main"/)
  assert.match(dashText, /className="po-overview-aside"/)
  assert.match(dashText, /function StackedSentimentArea\(/)
  assert.match(dashText, /function HourlyMediaHeat\(/)
  assert.match(dashText, /function MediaSentimentPercentBar\(/)
  assert.match(dashText, /function Sparkline\(/)
  assert.match(dashText, /slice=latest/)
})
