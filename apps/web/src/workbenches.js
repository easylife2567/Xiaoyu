export const FILE_PROCESSING_WORKBENCH = {
  slug: 'translation-processing',
  kind: 'file-processing',
  title: '大翻译数据处理',
  subtitle: '批量生成中文摘要与分类',
  description: '上传原始 Excel，系统会承接稳定的批量处理流程。',
}

export const DAILY_REPORT_WORKBENCHES = [
  {
    slug: 'international-daily-report',
    kind: 'daily-report',
    title: '国际日报',
    subtitle: '从今日国际热点生成正式日报',
    description: '从候选新闻池中选择 6 条，后续将自动成稿并导出。',
    reportProfile: {
      focus: '综合国际热点',
      poolTitle: '今日候选池',
      poolDescription: '覆盖国际时政、经济、社会等当日热点。',
    },
  },
  {
    slug: 'international-hotspot-daily-report',
    kind: 'daily-report',
    title: '国际热点日报二处',
    subtitle: '聚焦 AI 与城市治理热点',
    description: '从主题候选池中选择新闻，后续将自动生成稿件与配图。',
    reportProfile: {
      focus: 'AI 与城市治理',
      poolTitle: '专题候选池',
      poolDescription: '聚焦 AI、数字政府与城市治理相关动态。',
    },
  },
]

export const WORKBENCHES = [FILE_PROCESSING_WORKBENCH, ...DAILY_REPORT_WORKBENCHES]

export function getWorkbenchBySlug(slug) {
  return WORKBENCHES.find((workbench) => workbench.slug === slug)
}
