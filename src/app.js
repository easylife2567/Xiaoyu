import {
  getWorkbenchByRoute,
  renderDailyReportWorkbench,
  renderHomePage,
  renderTranslationWorkbench,
  renderWorkbenchFrame,
} from './workbenches.js'

function getCurrentRoute() {
  return window.location.hash.replace(/^#/, '') || '/'
}

function renderRoute() {
  const route = getCurrentRoute()
  const root = document.querySelector('#app')

  if (route === '/') {
    root.innerHTML = renderHomePage()
    return
  }

  const workbench = getWorkbenchByRoute(route)

  if (!workbench) {
    root.innerHTML = renderWorkbenchFrame({
      title: '未找到工作台',
      subtitle: '请返回首页重新选择',
      description: '当前路径没有对应的工作台。',
      body: '<section class="empty-state">该工作台尚不存在。</section>',
    })
    return
  }

  if (workbench.kind === 'file-processing') {
    root.innerHTML = renderTranslationWorkbench()
    return
  }

  root.innerHTML = renderDailyReportWorkbench(workbench)
}

window.addEventListener('hashchange', renderRoute)
window.addEventListener('DOMContentLoaded', renderRoute)
