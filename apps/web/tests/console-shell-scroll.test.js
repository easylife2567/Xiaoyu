import { readFileSync } from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DAILY_REPORT_WORKBENCHES,
  FILE_PROCESSING_WORKBENCH,
} from '../src/workbenches.js'
import WorkbenchPage from '../app/workbenches/[slug]/page.jsx'

/**
 * Workbench shell 滚动架构测试 — 守护 workbench-shell-ux 契约的关键 CSS 规则
 *
 * 测试原则:
 *   - SSR 测试不能跑真实 CSS,改用"读 globals.css 文件 + 正则匹配关键规则"
 *   - 配合 SSR 测试断言关键 className 已应用到对的 element 上
 *   - 真实滚动行为 / 视觉表现由人工 viewport 测试验证(详见 design.md R5)
 */

const cssPath = path.resolve(import.meta.dirname, '../app/globals.css')
const cssText = readFileSync(cssPath, 'utf8')

function blockOf(selector) {
  // 取 selector 的所有 { ... } 声明块,拼起来(同一 selector 可在 css 中出现多次);
  // 同时 strip 掉 css 注释 /* ... */ 防止注释里的关键字干扰 doesNotMatch 断言
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'g')
  const blocks = []
  for (const m of cssText.matchAll(re)) {
    blocks.push(m[1].replace(/\/\*[\s\S]*?\*\//g, ''))
  }
  return blocks.join(' ').replace(/\s+/g, ' ').trim()
}

test('全局 :root 暴露 --shell-topbar-height 几何变量', () => {
  const root = blockOf(':root')
  assert.match(root, /--shell-topbar-height:\s*56px/)
  assert.match(root, /--shell-body-height:\s*calc\(100vh\s*-\s*var\(--shell-topbar-height\)\)/)
})

test('.console-shell 锁定 viewport 大小,不允许文档级滚动', () => {
  const shell = blockOf('.console-shell')
  // 不应再有 min-height 100vh(那是会让 shell 撑大、文档滚动的根因)
  assert.doesNotMatch(shell, /min-height:\s*100vh/)
  assert.match(shell, /height:\s*100vh/)
  assert.match(shell, /overflow:\s*hidden/)
  // grid-template-rows 用变量
  assert.match(shell, /grid-template-rows:\s*var\(--shell-topbar-height\)\s+minmax\(0,\s*1fr\)/)
})

test('.console-topbar 通过 sticky 始终在顶部可见', () => {
  const topbar = blockOf('.console-topbar')
  assert.match(topbar, /position:\s*-webkit-sticky/)
  assert.match(topbar, /position:\s*sticky/)
  assert.match(topbar, /top:\s*0/)
  assert.match(topbar, /z-index:\s*10/)
})

test('.console-sidebar 内部独立纵向滚动,不撑大父级', () => {
  const sidebar = blockOf('.console-sidebar')
  assert.doesNotMatch(sidebar, /min-height:\s*calc\(100vh/)
  assert.match(sidebar, /height:\s*100%/)
  assert.match(sidebar, /overflow-y:\s*auto/)
  assert.match(sidebar, /overflow-x:\s*hidden/)
})

test('.console-stage / .console-content 形成局部滚动容器', () => {
  const stage = blockOf('.console-stage')
  const content = blockOf('.console-content')
  assert.match(stage, /height:\s*100%/)
  assert.match(stage, /overflow:\s*hidden/)
  assert.match(content, /height:\s*100%/)
  assert.match(content, /overflow:\s*hidden/)
  // content 是 flex 列容器,工作台主体子元素可撑剩余空间
  assert.match(content, /display:\s*flex/)
  assert.match(content, /flex-direction:\s*column/)
})

test('.report-console 自身不滚动,工作区子列各自独立滚动', () => {
  const report = blockOf('.report-console')
  // .report-console 第一个匹配是基础 grid 设定,所以再取第二条匹配(包含 grid-template-columns)
  const reportSpec = cssText.match(/\.report-console\s*\{[^}]*grid-template-columns[^}]*\}/)
  assert.ok(reportSpec, 'report-console 必须显式定义 grid-template-columns')
  assert.match(reportSpec[0], /grid-template-rows:\s*auto\s+auto\s+auto\s+minmax\(0,\s*1fr\)/)
  // 双列各自局部滚动
  const main = blockOf('.report-main-column')
  const side = blockOf('.report-side-column')
  assert.match(main, /min-height:\s*0/)
  assert.match(main, /overflow-y:\s*auto/)
  assert.match(side, /min-height:\s*0/)
  assert.match(side, /overflow-y:\s*auto/)
})

test('.report-progress-bar 通过 sticky 锁在工作台顶部', () => {
  const bar = blockOf('.report-progress-bar')
  assert.match(bar, /position:\s*-webkit-sticky/)
  assert.match(bar, /position:\s*sticky/)
  assert.match(bar, /top:\s*0/)
  assert.match(bar, /z-index:\s*5/)
})

test('翻译工作台 .translation-layout 双列采用 flex 列容器(短内容自然展开,父级整体兜底滚动)', () => {
  // .workspace-grid 与 .report-console 共享基础 grid 设定,但 overflow 行为分开
  const workspaceGrid = cssText.match(/\.workspace-grid,\s*\.report-console\s*\{([^}]*)\}/)
  assert.ok(workspaceGrid, '.workspace-grid 与 .report-console 共享 root 高度规则')
  assert.match(workspaceGrid[1], /height:\s*100%/)
  // 公共块不再带 overflow:翻译工作台用 .workspace-grid 单独 overflow-y: auto,
  // 国际日报用 .report-console 单独 overflow: hidden(子列自滚),分开声明
  assert.doesNotMatch(workspaceGrid[1], /overflow:/)
  // 翻译工作台:整体兜底滚动
  const wgOnly = cssText.match(/\n\.workspace-grid\s*\{([^}]*)\}/)
  assert.ok(wgOnly, '.workspace-grid 必须单独声明 overflow-y: auto 兜底')
  assert.match(wgOnly[1], /overflow-y:\s*auto/)
  // .translation-layout 不能锁 grid-template-rows 为 1fr,否则 row 1 内容被裁剪;
  // 应让 grid-auto-rows 按内容(默认 auto)排列多 row 子元素
  const transLayout = blockOf('.translation-layout')
  assert.doesNotMatch(transLayout, /grid-template-rows:/)
  // translation-layout 内部 console-section 是 flex 列容器,但不嵌套 overflow
  const transSection = cssText.match(/\.translation-layout\s*>\s*\.console-section\s*\{([^}]*)\}/)
  assert.ok(transSection, '翻译工作台 console-section 必须配置为 flex 列')
  assert.match(transSection[1], /display:\s*flex/)
  assert.match(transSection[1], /flex-direction:\s*column/)
  assert.doesNotMatch(transSection[1], /overflow-y:\s*auto/)
})

test('.console-content > .workspace-grid 不被父级作用域强制 overflow:hidden(否则覆盖整体兜底滚动)', () => {
  // 回归守护:翻译工作台运行日志(处理中持续增长)若被父级 overflow:hidden 裁剪,
  // 会溢出到 viewport 下方且无法滚动。.console-content > .workspace-grid 的优先级(0,2,0)
  // 高于 .workspace-grid(0,1,0),一旦它声明 overflow:hidden 就会击穿兜底滚动。
  const wgScoped = [...cssText.matchAll(/\.console-content\s*>\s*\.workspace-grid\s*\{([^}]*)\}/g)]
    .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, ''))
    .join(' ')
  assert.doesNotMatch(wgScoped, /overflow:\s*hidden/)
  // 国际日报 report-console 仍需父级 overflow:hidden(子列各自局部滚动)
  const rcScoped = [...cssText.matchAll(/\.console-content\s*>\s*\.report-console\s*\{([^}]*)\}/g)]
    .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, ''))
    .join(' ')
  assert.match(rcScoped, /overflow:\s*hidden/)
})

test('国际日报主列短内容 section 不被 flex 压缩', () => {
  // 已选篮子:短内容,flex: 0 0 auto
  const selected = cssText.match(/\.report-main-column\s*>\s*\.selected-zone\s*\{([^}]*)\}/)
  assert.ok(selected, '.report-main-column > .selected-zone 必须显式声明 flex 权重')
  assert.match(selected[1], /flex:\s*0\s*0\s*auto/)
  // 产物交付(主列最后一个 console-section):短内容,flex: 0 0 auto
  const delivery = cssText.match(/\.report-main-column\s*>\s*\.console-section:last-child\s*\{([^}]*)\}/)
  assert.ok(delivery, '.report-main-column 最后 console-section(产物交付)必须显式声明 flex 权重')
  assert.match(delivery[1], /flex:\s*0\s*0\s*auto/)
})

test('国际日报草稿区占剩余空间且独立滚动', () => {
  // 草稿区:既不是已选篮子,也不是最后一个,flex: 1 1 0 + overflow-y: auto
  const draft = cssText.match(
    /\.report-main-column\s*>\s*\.console-section:not\(\.selected-zone\):not\(:last-child\)\s*\{([^}]*)\}/,
  )
  assert.ok(draft, '草稿 section(:not(.selected-zone):not(:last-child))必须显式声明 flex / overflow')
  assert.match(draft[1], /flex:\s*1\s*1\s*0/)
  assert.match(draft[1], /min-height:\s*0/)
  assert.match(draft[1], /overflow-y:\s*auto/)
})

test('国际日报候选池占满侧列且支持局部滚动', () => {
  const candidate = cssText.match(/\.report-side-column\s*>\s*\.candidate-zone\s*\{([^}]*)\}/)
  assert.ok(candidate, '.report-side-column > .candidate-zone 必须配置为 flex 占满侧列')
  assert.match(candidate[1], /flex:\s*1\s*1\s*0/)
  assert.match(candidate[1], /min-height:\s*0/)
})

test('翻译工作台短内容 section 不被压缩(upload-console / action-stack / console-subsection)', () => {
  const upload = cssText.match(/\.translation-layout\s+\.upload-console\s*\{([^}]*)\}/)
  assert.ok(upload, '.translation-layout .upload-console 必须显式声明不收缩')
  assert.match(upload[1], /flex:\s*0\s*0\s*auto/)
  // action-stack / button-row 共用规则
  const stack = cssText.match(/\.translation-layout\s+\.action-stack[\s\S]*?\{([^}]*)\}/)
  assert.ok(stack, '.translation-layout .action-stack 必须显式声明不收缩')
  assert.match(stack[1], /flex:\s*0\s*0\s*auto/)
  // console-subsection 默认按内容自然展开
  const sub = cssText.match(/\.translation-layout\s+\.console-subsection\s*\{([^}]*)\}/)
  assert.ok(sub, '.translation-layout .console-subsection 必须显式声明不收缩')
  assert.match(sub[1], /flex:\s*0\s*0\s*auto/)
})

test('翻译工作台 .workflow-status sticky 在工作台顶部', () => {
  const block = cssText.match(/\.console-content\s*>\s*\.workflow-status\s*\{([^}]*)\}/)
  assert.ok(block, '.workflow-status 必须配置为 sticky')
  assert.match(block[1], /position:\s*sticky/)
  assert.match(block[1], /top:\s*0/)
})

test('SSR 渲染:国际日报工作台保留所有关键 className', async () => {
  const workbench = DAILY_REPORT_WORKBENCHES[0]
  const html = renderToStaticMarkup(
    await WorkbenchPage({ params: { slug: workbench.slug } }),
  )
  for (const cls of [
    'console-shell',
    'console-topbar',
    'console-sidebar',
    'console-stage',
    'console-content',
    'report-console',
    'report-progress-bar',
    'report-main-column',
    'report-side-column',
    'console-section',
    'candidate-zone',
    'selected-zone',
  ]) {
    assert.match(html, new RegExp(`class=\"[^\"]*${cls}`), `应包含 className "${cls}"`)
  }
})

test('SSR 渲染:翻译工作台保留所有关键 className', async () => {
  const html = renderToStaticMarkup(
    await WorkbenchPage({ params: { slug: FILE_PROCESSING_WORKBENCH.slug } }),
  )
  for (const cls of [
    'console-shell',
    'console-topbar',
    'console-sidebar',
    'workspace-grid',
    'translation-layout',
    'workflow-status',
    'console-section',
  ]) {
    assert.match(html, new RegExp(`class=\"[^\"]*${cls}`), `应包含 className "${cls}"`)
  }
})
