import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'

/**
 * 「每日舆情」daily-today 组件守护测试 — 静态源码断言。
 *
 * 范围:
 *  - 页面 daily/today/page.jsx 已挂载 DailyTodayBoard,不再是占位
 *  - ConsoleShell activeSlug=po-daily-summary(与既有侧边栏定义对齐)
 *  - 组件含五件套:FilterBar / HistogramStrip / NewItemsBanner / Feed (+ Row) / Drawer
 *  - 行级 checkbox + 抽屉内勾选按钮(双向同步)
 *  - 三个 API 路由全部被引用:/daily-today、/count、/export
 *  - 90s 轮询 / visibilitychange / 失败暂停 三个钩子在源里存在
 *  - 虚拟滚动(@tanstack/react-virtual)、ROW_HEIGHT 34、OVERSCAN 8
 *  - CSS 令牌 --daily-today-row-height / --daily-today-aside-width 等存在
 *  - 既有 console-shell.jsx 侧边栏 po-daily-summary 指向新路由
 */

const pagePath = path.resolve(
  import.meta.dirname,
  '../app/public-opinion/daily/today/page.jsx',
)
const compPath = path.resolve(
  import.meta.dirname,
  '../components/public-opinion-daily-today-board.jsx',
)
const cssPath = path.resolve(import.meta.dirname, '../app/globals.css')
const shellPath = path.resolve(import.meta.dirname, '../components/console-shell.jsx')

const pageText = readFileSync(pagePath, 'utf8')
const compText = readFileSync(compPath, 'utf8')
const cssText = readFileSync(cssPath, 'utf8')
const shellText = readFileSync(shellPath, 'utf8')

// ───────────── 页面挂载 ─────────────

test('daily/today/page.jsx 已挂载 DailyTodayBoard,不再是占位', () => {
  assert.match(pageText, /DailyTodayBoard/)
  assert.doesNotMatch(pageText, /placeholder-state/)
  assert.doesNotMatch(pageText, /功能建设中/)
})

test('page.jsx 保持 ConsoleShell 外壳并使用 activeSlug=po-daily-summary', () => {
  assert.match(pageText, /ConsoleShell/)
  assert.match(pageText, /activeSlug="po-daily-summary"/)
})

test('page.jsx eyebrow=「舆情速览 · 每日舆情」', () => {
  assert.match(pageText, /舆情速览 · 每日舆情/)
})

// ───────────── 五件套组件结构 ─────────────

test('组件导出 DailyTodayBoard 顶层入口', () => {
  assert.match(compText, /export function DailyTodayBoard/)
})

test('组件含五件套子组件函数定义', () => {
  assert.match(compText, /function DailyTodayFilterBar/)
  assert.match(compText, /function DailyTodayHistogramStrip/)
  assert.match(compText, /function DailyTodayNewItemsBanner/)
  assert.match(compText, /function DailyTodayFeed/)
  assert.match(compText, /function DailyTodayFeedRow/)
  assert.match(compText, /function DailyTodayDrawer/)
})

test('组件标记为 client component', () => {
  assert.match(compText, /^'use client'/)
})

// ───────────── 三个 API 路由 ─────────────

test('组件引用主路由 /api/public-opinion/daily-today', () => {
  assert.match(compText, /\/api\/public-opinion\/daily-today\b/)
})

test('组件引用 count 心跳路由', () => {
  assert.match(compText, /\/api\/public-opinion\/daily-today\/count/)
})

test('组件引用 export 路由', () => {
  assert.match(compText, /\/api\/public-opinion\/daily-today\/export/)
})

// ───────────── 行级勾选 + 双向同步 ─────────────

test('组件提供行级 <input type="checkbox" 勾选', () => {
  assert.match(compText, /<input[^>]*type="checkbox"/)
})

test('抽屉内有 ✓/勾选 按钮', () => {
  assert.match(compText, /po-daily-today-drawer-select/)
  assert.match(compText, /已勾选/)
  assert.match(compText, /加入勾选/)
})

test('selectedIds 是组件 state(双向同步入口)', () => {
  assert.match(compText, /setSelectedIds/)
  assert.match(compText, /selectedIds/)
})

// ───────────── 实时轮询 ─────────────

test('组件 90s 默认心跳常量存在', () => {
  assert.match(compText, /POLL_MS_DEFAULT\s*=\s*90_000/)
})

test('组件订阅 visibilitychange 用于 tab 失焦暂停', () => {
  assert.match(compText, /visibilitychange/)
  assert.match(compText, /visibilityState/)
})

test('组件有连续失败暂停的常量', () => {
  assert.match(compText, /MAX_FAIL_BEFORE_PAUSE/)
})

test('组件有新数据横条文案「条新条目」', () => {
  assert.match(compText, /条新条目/)
})

// ───────────── 虚拟滚动 ─────────────

test('组件用 @tanstack/react-virtual 实现虚拟滚动', () => {
  assert.match(compText, /@tanstack\/react-virtual/)
  assert.match(compText, /useVirtualizer/)
})

test('组件设定 ROW_HEIGHT 在 32-36px 区间', () => {
  const m = compText.match(/ROW_HEIGHT\s*=\s*(\d+)/)
  assert.ok(m, 'ROW_HEIGHT constant missing')
  const v = Number(m[1])
  assert.ok(v >= 32 && v <= 36, `ROW_HEIGHT=${v} not in [32, 36]`)
})

test('组件设定 OVERSCAN 缓冲行', () => {
  assert.match(compText, /OVERSCAN/)
})

// ───────────── 排序 / 筛选 / facet ─────────────

test('组件不提供排序切换控件', () => {
  // 没有 sortBy / sortField / 排序方向 等切换
  assert.doesNotMatch(compText, /sortBy|sortField|sortDirection/)
})

test('组件实现前端 filter 函数 filterItems', () => {
  assert.match(compText, /function filterItems/)
})

test('组件实现 facet count 计算函数', () => {
  assert.match(compText, /computePlatformFacets/)
})

test('组件实现 histogram 计算函数', () => {
  assert.match(compText, /function computeHistogram/)
})

// ───────────── 命中词高亮 + 译文角标 ─────────────

test('组件实现 highlightMatch(用 indexOf 而非正则,避免 unicode 边界)', () => {
  assert.match(compText, /function highlightMatch/)
  assert.match(compText, /text\.indexOf\(alias\)/)
})

test('组件渲染 <mark> 高亮命中词', () => {
  assert.match(compText, /<mark className="po-daily-today-mark">/)
})

test('外文条目渲染「译」角标', () => {
  assert.match(compText, /isCJK/)
  assert.match(compText, /po-daily-today-row-trans/)
})

// ───────────── CSS 令牌 ─────────────

test('CSS 含 daily-today 专用令牌', () => {
  assert.match(cssText, /--daily-today-row-height:\s*34px/)
  assert.match(cssText, /--daily-today-aside-width:\s*360px/)
  assert.match(cssText, /--daily-today-histogram-height/)
  assert.match(cssText, /--daily-today-fresh-stripe/)
})

test('CSS 含五件套主选择器', () => {
  assert.match(cssText, /\.po-daily-today\b/)
  assert.match(cssText, /\.po-daily-today-filterbar/)
  assert.match(cssText, /\.po-daily-today-histogram\b/)
  assert.match(cssText, /\.po-daily-today-banner/)
  assert.match(cssText, /\.po-daily-today-feed\b/)
  assert.match(cssText, /\.po-daily-today-row\b/)
  assert.match(cssText, /\.po-daily-today-drawer\b/)
})

test('CSS 沿用 v3 控制台令牌(--po-pad / --po-gap / --po-panel-radius)', () => {
  // 引用既有令牌而不引入新名,验证 daily-today CSS 块里有引用
  const dailyBlock = cssText.match(/「每日舆情」daily-today[\s\S]+$/)
  assert.ok(dailyBlock, 'daily-today CSS section not found')
  assert.match(dailyBlock[0], /--po-pad/)
  assert.match(dailyBlock[0], /--po-gap/)
  assert.match(dailyBlock[0], /--po-panel-radius/)
})

test('CSS reduced-motion 跳过新动画', () => {
  const dailyBlock = cssText.match(/「每日舆情」daily-today[\s\S]+$/)
  assert.match(dailyBlock[0], /prefers-reduced-motion: reduce/)
})

// ───────────── 侧边栏路由对齐 ─────────────

test('console-shell.jsx 中 po-daily-summary 指向 /public-opinion/daily/today', () => {
  assert.match(shellText, /slug: 'po-daily-summary'.*href: '\/public-opinion\/daily\/today'/)
})

test('console-shell.jsx 「每日舆情」子分组三子项顺序仍为 polarity → summary → trends', () => {
  // 取 po-daily 块,断言三子项的顺序
  const m = shellText.match(/slug: 'po-daily'[\s\S]+?\]/m)
  assert.ok(m, 'po-daily group not found')
  const block = m[0]
  const polarityIdx = block.indexOf("'po-daily-polarity'")
  const summaryIdx = block.indexOf("'po-daily-summary'")
  const trendsIdx = block.indexOf("'po-daily-trends'")
  assert.ok(polarityIdx > 0)
  assert.ok(summaryIdx > polarityIdx)
  assert.ok(trendsIdx > summaryIdx)
})
