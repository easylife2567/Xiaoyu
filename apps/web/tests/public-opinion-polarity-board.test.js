import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * 「正负面舆情」组件守护测试 — 静态源码断言。
 * 断言:
 *  - 页面 polarity/page.jsx 已脱离 placeholder,渲染 DailyPolarityBoard
 *  - 组件含 PolaritySummary / PolarityFilters / PolarityTable 三段
 *  - 含 aria-pressed chip 与 <input type="checkbox" 行级勾选
 *  - 含 data-sentiment 在行上(行首 4px 色条选择器)
 *  - 含 /api/public-opinion/polarity/export 字符串(下载入口)
 *  - 5→3 折叠未被在组件内重写 (只 import 而不重写)
 *  - CSS 含 .po-polarity-shell / -summary / -strip / -chips / -table / -row
 */

const pagePath = path.resolve(
  import.meta.dirname,
  '../app/public-opinion/daily/polarity/page.jsx',
)
const compPath = path.resolve(
  import.meta.dirname,
  '../components/public-opinion-polarity-board.jsx',
)
const cssPath = path.resolve(import.meta.dirname, '../app/globals.css')

const pageText = readFileSync(pagePath, 'utf8')
const compText = readFileSync(compPath, 'utf8')
const cssText = readFileSync(cssPath, 'utf8')

// ───────────── 页面挂载 ─────────────

test('polarity/page.jsx 已挂载 DailyPolarityBoard,不再是 placeholder', () => {
  assert.match(pageText, /DailyPolarityBoard/)
  assert.doesNotMatch(pageText, /placeholder-state/)
  assert.doesNotMatch(pageText, /功能建设中/)
})

test('polarity/page.jsx 保持 ConsoleShell 外壳与 activeSlug', () => {
  assert.match(pageText, /ConsoleShell/)
  assert.match(pageText, /activeSlug="po-daily-polarity"/)
})

// ───────────── 组件结构 ─────────────

test('组件导出 DailyPolarityBoard', () => {
  assert.match(compText, /export function DailyPolarityBoard/)
})

test('组件含三段:Summary / Filters / Table', () => {
  assert.match(compText, /function PolaritySummary/)
  assert.match(compText, /function PolarityFilters/)
  assert.match(compText, /function PolarityTable/)
})

test('组件用 aria-pressed chip 提供 a11y', () => {
  assert.match(compText, /aria-pressed=/)
})

test('组件提供行级 checkbox 勾选', () => {
  assert.match(compText, /<input[^>]*type="checkbox"/)
})

test('组件把 data-sentiment 放在行元素上(行首色条选择器)', () => {
  assert.match(compText, /data-sentiment=/)
})

test('组件提供下载入口指向 /api/public-opinion/polarity/export', () => {
  assert.match(compText, /\/api\/public-opinion\/polarity\/export/)
})

test('组件不在本地重写 5→3 折叠规则 (只 import 同源常量)', () => {
  // 允许 import / 引用 SENTIMENT3_LABELS,但禁止本地条件分支重写规则
  assert.doesNotMatch(compText, /偏正面.*===.*正面.*\?/) // 简化的反例
  assert.doesNotMatch(compText, /if\s*\(\s*['"]偏正面['"]/)
})

// ───────────── 日期段 / 平台 / 情感 三档 ─────────────

test('组件含 今日 / 7 天 / 自定义 三档日期切换', () => {
  assert.match(compText, /今日/)
  assert.match(compText, /7 天|7天/)
  assert.match(compText, /自定义/)
})

test('组件情感 chip 三档而非五档', () => {
  // 顶部 chip 文案不应直接出现「偏正面」「偏负面」
  // (只有占比横条 hover popover 才提到 5 档)
  const sentimentSection = compText.match(/sentimentOptions[\s\S]*?\]/)
  assert.ok(sentimentSection, '应找到 sentimentOptions 定义')
  assert.doesNotMatch(sentimentSection[0], /偏正面/)
  assert.doesNotMatch(sentimentSection[0], /偏负面/)
})

// ───────────── CSS 主键类 ─────────────

test('CSS 含 .po-polarity-* 主键类', () => {
  assert.match(cssText, /\.po-polarity-shell\s*\{/)
  assert.match(cssText, /\.po-polarity-summary\s*\{/)
  assert.match(cssText, /\.po-polarity-strip\s*\{/)
  assert.match(cssText, /\.po-polarity-chips\s*\{/)
  assert.match(cssText, /\.po-polarity-chip\s*\{/)
  assert.match(cssText, /\.po-polarity-table\s*\{/)
  assert.match(cssText, /\.po-polarity-row\s*\{/)
  assert.match(cssText, /\.po-polarity-pager\s*\{/)
})

test('CSS 行首 4px 色条由 ::before 渲染并消费 --row-emotion-color', () => {
  assert.match(cssText, /\.po-polarity-row::before/)
  assert.match(cssText, /--row-emotion-color/)
})

test('CSS 用既有 token 而非引入新色板 (复用 v3 设计令牌)', () => {
  // 主色 #1677ff、5 模态色 #00b42a/#86909c/#f53f3f 已在 v3 出现;新代码不应引入异色
  // 给一个宽松断言:CSS 内 polarity 块未硬编码新的 hex 三元组(校验 #00b42a / #f53f3f 等
  // 既有色仍是 polarity 块的主色)
  const polaritySlice = cssText.slice(cssText.indexOf('.po-polarity-shell'))
  assert.match(polaritySlice, /#00b42a/)
  assert.match(polaritySlice, /#86909c/)
  assert.match(polaritySlice, /#f53f3f/)
})

test('CSS 含 reduced-motion 偏好下的过渡降级', () => {
  assert.match(cssText, /prefers-reduced-motion/)
  // polarity 块自身的 reduced-motion 守护
  assert.match(cssText, /po-polarity-chip[\s\S]{0,200}transition:\s*none/)
})

// ───────────── 不回归 v3 总览 ─────────────

test('总览 dashboard 文件未被本次 polarity 改动污染', () => {
  const dashPath = path.resolve(
    import.meta.dirname,
    '../components/public-opinion-overview-dashboard.jsx',
  )
  const dashText = readFileSync(dashPath, 'utf8')
  assert.match(dashText, /KpiRail|po-rail/) // v3 KPI rail 还在
  assert.doesNotMatch(dashText, /DailyPolarityBoard/) // 不应交叉引用
})
