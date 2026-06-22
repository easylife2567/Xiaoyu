import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import PublicOpinionOverviewPage from '../app/public-opinion/page.jsx'

/**
 * 百炼视觉改造守护测试 — 校验应用级设计令牌与图表主题落位。
 * 真实观感由人工 viewport 验证;此处只锁定令牌/主题不被回退。
 */

const cssPath = path.resolve(import.meta.dirname, '../app/globals.css')
const cssText = readFileSync(cssPath, 'utf8')
const dashPath = path.resolve(import.meta.dirname, '../components/public-opinion-overview-dashboard.jsx')
const dashText = readFileSync(dashPath, 'utf8')

test(':root 定义百炼应用级设计令牌', () => {
  assert.match(cssText, /--color-primary:\s*#1677ff/)
  assert.match(cssText, /--color-bg-page:\s*#f0f2f5/)
  assert.match(cssText, /--color-title:\s*#1d2129/)
  assert.match(cssText, /--font-sans:[^;]*PingFang SC/)
})

test('sidebar 选中态使用主色 + 主色浅底 + 左侧饰条', () => {
  const block = cssText.match(/\.nav-item\.is-active\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(block, /var\(--color-primary-bg\)/)
  assert.match(block, /var\(--color-primary\)/)
  assert.match(block, /inset 3px 0 0/)
})

test('topbar 与 sidebar 改用令牌(无遗留硬编码灰蓝)', () => {
  const topbar = cssText.match(/\.console-topbar\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(topbar, /var\(--color-border\)/)
  assert.match(topbar, /var\(--color-bg-card\)/)
})

test('看板卡片使用令牌阴影/边框', () => {
  const panel = cssText.match(/\.po-panel\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(panel, /var\(--color-border\)/)
  assert.match(panel, /var\(--shadow-card\)/)
})

test('全局紫色强调色已替换(不再残留 #6558f5 / rgba(101,88,245))', () => {
  assert.doesNotMatch(cssText, /#6558f5/)
  assert.doesNotMatch(cssText, /101,\s*88,\s*245/)
})

test('图表使用统一 PO_CHART_THEME 主题常量', () => {
  assert.match(dashText, /const PO_CHART_THEME =/)
  assert.match(dashText, /PO_CHART_THEME\.grid/)
  assert.match(dashText, /PO_CHART_THEME\.axisTick/)
  assert.match(dashText, /PO_CHART_THEME\.tooltipStyle/)
})

test('情感 5 模态保留语义色序(正面绿→负面红)', () => {
  assert.match(dashText, /正面:\s*'#00b42a'/)
  assert.match(dashText, /负面:\s*'#f53f3f'/)
})

test('舆情总览页仍在 console shell 内渲染看板', () => {
  const html = renderToStaticMarkup(PublicOpinionOverviewPage())
  assert.match(html, /po-dashboard/)
  assert.match(html, /主导航/)
})
