export const WORKBENCHES = [
  {
    route: '/translation',
    kind: 'file-processing',
    title: '大翻译数据处理',
    subtitle: '批量生成中文摘要与分类',
    description: '上传原始 Excel，系统会在后续能力接入后完成稳定的批量处理。',
  },
  {
    route: '/international-daily',
    kind: 'daily-report',
    title: '国际日报',
    subtitle: '从今日国际热点生成正式日报',
    description: '从候选新闻池中选择 6 条，后续将自动成稿并导出。',
  },
  {
    route: '/hotspot-daily',
    kind: 'daily-report',
    title: '国际热点日报二处',
    subtitle: '聚焦 AI 与城市治理热点',
    description: '从主题候选池中选择新闻，后续将自动生成稿件与配图。',
  },
]

export function getWorkbenchByRoute(route) {
  return WORKBENCHES.find((workbench) => workbench.route === route)
}

export function renderHomePage() {
  const cards = WORKBENCHES.map(
    (workbench) => `
      <a class="workbench-card" href="#${workbench.route}">
        <span class="workbench-kind">${workbench.kind === 'file-processing' ? '文件处理' : '日报生产'}</span>
        <h2>${workbench.title}</h2>
        <p class="subtitle">${workbench.subtitle}</p>
        <p>${workbench.description}</p>
      </a>
    `,
  ).join('')

  return `
    <main class="page home-page">
      <section class="hero">
        <p class="eyebrow">小舆工作台</p>
        <h1>今天要处理什么？</h1>
        <p>选择对应工作台，开始你今天的任务。</p>
      </section>
      <section class="workbench-grid">
        ${cards}
      </section>
    </main>
  `
}

export function renderWorkbenchFrame({ title, subtitle, description, body }) {
  return `
    <main class="page workbench-page">
      <a class="back-link" href="#/">← 返回工作台首页</a>
      <header class="workbench-header">
        <p class="eyebrow">工作台</p>
        <h1>${title}</h1>
        <p class="subtitle">${subtitle}</p>
        <p>${description}</p>
      </header>
      <section class="status-panel">
        <span class="status-label">当前状态</span>
        <strong>尚未开始</strong>
      </section>
      ${body}
    </main>
  `
}

export function renderTranslationWorkbench() {
  const body = `
    <section class="panel-grid">
      <article class="panel">
        <p class="eyebrow">输入</p>
        <h2>上传原始 Excel</h2>
        <p>仅支持 Excel 文件。后续系统会在这里识别并处理原始数据。</p>
        <label class="upload-box">
          <span>拖拽文件到这里，或点击选择文件</span>
          <input type="file" accept=".xlsx,.xls" />
        </label>
      </article>
      <article class="panel">
        <p class="eyebrow">输入识别</p>
        <h2>等待文件上传</h2>
        <p>上传后将在这里展示系统已识别的文件信息。</p>
      </article>
      <article class="panel">
        <p class="eyebrow">任务状态</p>
        <h2>尚未开始</h2>
        <p>真实处理能力尚未接入，后续将在这里展示进度。</p>
        <button class="primary-button" type="button" disabled>开始处理</button>
      </article>
      <article class="panel">
        <p class="eyebrow">结果交付</p>
        <h2>等待处理完成</h2>
        <p>处理完成后，结果文件会出现在这里。</p>
      </article>
    </section>
  `

  return renderWorkbenchFrame({
    title: '大翻译数据处理',
    subtitle: '批量生成中文摘要与分类',
    description: '上传一份原始 Excel，系统会承接后续稳定的批量处理流程。',
    body,
  })
}

export function renderDailyReportWorkbench({ title, subtitle, description }) {
  const body = `
    <section class="report-layout">
      <article class="panel report-panel">
        <p class="eyebrow">候选池</p>
        <h2>等待每日候选池接入</h2>
        <p>后续将在这里展示当天可供选择的新闻候选。</p>
      </article>
      <article class="panel report-panel">
        <p class="eyebrow">已选篮子</p>
        <h2>尚未选择新闻</h2>
        <p>用户后续会在这里查看已选题目与顺序。</p>
      </article>
      <article class="panel report-panel">
        <p class="eyebrow">正文草稿</p>
        <h2>等待生成</h2>
        <p>选择完成后，系统会在这里承接后续的轻量编辑流程。</p>
      </article>
      <article class="panel report-panel">
        <p class="eyebrow">导出</p>
        <h2>尚未生成产物</h2>
        <p>导出能力接入后，成品文件会从这里交付。</p>
      </article>
    </section>
  `

  return renderWorkbenchFrame({
    title,
    subtitle,
    description,
    body,
  })
}
