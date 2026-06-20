import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { WORKBENCHES } from '../src/workbenches.js'
import HomePage from '../app/page.jsx'
import ArtifactsPage from '../app/artifacts/page.jsx'
import SettingsPage from '../app/settings/page.jsx'

test('工作台总览三张推荐卡片各自链接到对应工作台', () => {
  const html = renderToStaticMarkup(HomePage())
  // 卡片本身必须是链接(class=recommendation-card 的元素带 href),点击即跳转;
  // 不能仅靠侧边栏导航 — 所以断言 recommendation-card 元素上带 workbench href
  for (const workbench of WORKBENCHES) {
    assert.match(
      html,
      new RegExp(`recommendation-card[^>]*href="/workbenches/${workbench.slug}"`),
      `推荐卡片应直接链接到 /workbenches/${workbench.slug}`,
    )
  }
})

test('侧边栏管理分组链接到真实模板页(不再是 #)', () => {
  const html = renderToStaticMarkup(HomePage())
  assert.match(html, /href="\/artifacts"/)
  assert.match(html, /href="\/settings"/)
  assert.doesNotMatch(html, /href="#"/)
})

test('产物归档模板页在 console shell 内渲染', () => {
  const html = renderToStaticMarkup(ArtifactsPage())
  assert.match(html, /产物归档/)
  assert.match(html, /主导航/)
  assert.match(html, /小舆工作台/)
})

test('权限管理模板页在 console shell 内渲染', () => {
  const html = renderToStaticMarkup(SettingsPage())
  assert.match(html, /权限管理/)
  assert.match(html, /主导航/)
  assert.match(html, /小舆工作台/)
})
