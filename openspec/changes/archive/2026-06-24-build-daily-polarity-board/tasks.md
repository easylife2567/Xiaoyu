## 1. 归一化层 polarity.js

- [x] 1.1 新建 `apps/web/src/public-opinion/polarity.js`,导出常量 `SENTIMENT3_LABELS = ['正面','中立','负面']` 与映射函数 `foldSentiment5to3(label5)`(`正面|偏正面 → 正面`、`中立 → 中立`、`负面|偏负面 → 负面`、其他 → `中立`)
- [x] 1.2 复用 `overview.js` 的 `buildOverviewContext`,新增 `buildPolarityContext({ start, end })`:`start`/`end` 缺省时默认 7 天窗口;返回 `{ startDay, endDay, startTime, endTime }`
- [x] 1.3 新增 `getPolaritySummary(client, ctx)`:调 `getModMediaNumberByTime` 取 5 模态计数 → 折叠为 `{ positive, neutral, negative, total }` 与 `sentiment5: { 正面, 偏正面, 中立, 偏负面, 负面 }`(后者给堆叠占比条 hover 用)
- [x] 1.4 新增 `getPolarityItems(client, ctx, { page, pageSize })`:调 `getSpanTimeMediaInfo({ startDay, endDay, page, number: pageSize })`;映射为 `{ platform, title, keyword, risk, sentiment5, sentiment3, pubTime, url }`;不强行截 30 条上限(由调用方决定)
- [x] 1.5 新增 `getPolarityPlatforms(summary, items)`:把 items 中出现的 platform 与 summary 合并得 `[{ key, count }]`,降序;若 summary 不含 platform breakdown,以 items 内频次作为退化估计
- [x] 1.6 新增 `aggregatePolarity(client, { sentiment3, platform, page, pageSize, range })`:Promise.allSettled 并行 `summary` + `items`,任一失败置 null + 记 errors;**`sentiment3`/`platform` 过滤在归一化层做**(过滤 items 后再算 pagination.total,以保证「N 条」与列表一致)
- [x] 1.7 暴露 `enrichItemsWithSentiment3(items)` 工具:把 `getLatestNews` 已有的 `sentiment` 字段或原始 `emotionValue` 一并落到 `sentiment5`/`sentiment3`,确保两字段在所有路径下都存在
- [x] 1.8 单元测试 `apps/web/tests/public-opinion-polarity.test.js`:
  - `foldSentiment5to3` 5 → 3 全分支覆盖 + null/unknown 兜底
  - `getPolaritySummary` 用 mock client 返回 `getModMediaNumberByTime` 二维数组 → 验证 summary 3 档加和正确
  - `aggregatePolarity` 单 widget 失败时其余仍返回 + errors 标记
  - 过滤组合:仅 `sentiment3=正面` / 仅 `platform=Twitter` / 二者同时 → items 与 total 同步过滤

## 2. BFF 路由 /api/public-opinion/polarity

- [x] 2.1 新建 `apps/web/app/api/public-opinion/polarity/route.js`,`export const dynamic = 'force-dynamic'`
- [x] 2.2 未配置态分支(`!isPublicOpinionConfigured()`)→ `Response.json({ configured: false })`
- [x] 2.3 mock 分支(dev 看 `?mock=1`,prod 看 `PUBLIC_OPINION_MOCK=1`)→ 动态 import `polarity-mock.js`,按 URL 参数过滤后返回
- [x] 2.4 真实分支:解析 `sentiment3` / `platform` / `start` / `end` / `page`(默认 1)/ `pageSize`(默认 10,上限 100)→ 调 `aggregatePolarity` → `Response.json(payload)`
- [x] 2.5 `?slice=summary` 或 `?slice=items` 切片支持:仅返回所需子树,跳过另一半的请求(性能优化,UI 翻页用)
- [x] 2.6 服务端日志:聚合失败时 console.error 详情,response 仅暴露 `errors[key]: message`,与 overview 路由对齐

## 3. mock 数据

- [x] 3.1 新建 `apps/web/src/public-opinion/polarity-mock.js`(或挂在 `mock-payload.js`)
- [x] 3.2 `buildPolarityMock({ pageSize = 10, page = 1, sentiment3, platform, range })`:
  - 用 `mock-payload.js` 同一 `seededRandom(42)` seed 派生 50 条候选(覆盖 5 档 × 多平台 × risk 4 条 × keyword 1/3)
  - 应用 `sentiment3` / `platform` 过滤 → 切片分页
  - 计算 summary 3 档计数(基于过滤前总池,与"按当前筛选过滤后再计数"二者中**选过滤后**:KPI = "当前筛选下的条数")
  - 计算 platforms[]:从总池统计,数量徽章随筛选刷新
- [x] 3.3 `buildPolarityExportMock(filters)`:返回全量(50 条上限)用于导出路由的 mock 路径

## 4. 导出路由 /api/public-opinion/polarity/export

- [x] 4.1 新建 `apps/web/app/api/public-opinion/polarity/export/route.js`
- [x] 4.2 复用 `aggregatePolarity` 但 `pageSize=10000`(单次拉满);未配置态返回 503 + JSON `{ error: 'unconfigured' }`
- [x] 4.3 CSV 拼写就地实现 — **不引入新依赖**(MVP 上限 ≈ 1 万条,CSV 在 Excel 中能直接打开)
- [x] 4.4 表头(中文):`平台 / 情感 / 风险 / 标题 / 关键词 / 发布时间 / 链接`
- [x] 4.5 响应 `Content-Type: text/csv; charset=utf-8`、`Content-Disposition: attachment; filename*=UTF-8''<encoded>.csv`、body 以 `﻿` BOM 起首
- [x] 4.6 失败回 JSON `{ error }`(`Content-Type: application/json`)而非空文件,前端能识别并弹错
- [x] 4.7 `?ids=` 支持:用于"勾选 + 下载所选"路径;为空时走"当前筛选全量"

## 5. 前端组件 DailyPolarityBoard

- [x] 5.1 新建 `apps/web/components/public-opinion-polarity-board.jsx`,'use client'
- [x] 5.2 顶层状态:`range`(默认 7d)、`sentiment3 = '全部'`、`platform = '全部'`、`page = 1`、`selectedIds = Set()`、`payload`、`isLoading`、`error`
- [x] 5.3 `useEffect` 监听四元组(range, sentiment3, platform, page)→ 请求 `/api/public-opinion/polarity?...`;chip 切换重置 page=1
- [x] 5.4 渲染顺序:
  - `<PolarityHeader>`:日期段切换 + 「下载全部」按钮 + 自定义日期 popover
  - `<PolaritySummary>`:3 KPI 色块(`.po-polarity-summary`)+ 8px 堆叠占比横条(`.po-polarity-strip`)
  - `<PolarityFilters>`:平台 chip 行 + 情感 chip 行(`.po-polarity-chips`)
  - `<PolarityTable>`:工具条 + 表体 + 分页器
- [x] 5.5 `<PolarityTable>`:
  - 工具条:`☐ 全选(本页)` + 刷新按钮 + 计数,与 v2 feed 表头同 padding/字号
  - 行 = 一个 `<div class="po-polarity-row" data-sentiment={sentiment5}>`,**行首 4px 色条**通过 `::before` + `background: var(--emotion-color)` 实现(色映射用 `EMOTION_COLORS` 同 JS 常量)
  - 单元格顺序:checkbox → 平台徽标+名 → 情感徽章(3 档) → risk dot(条件) → 标题(`<a target="_blank">` 含「阅读原文」) → 关键词(`#xxx`,条件) → 时间右对齐
  - hover 整行高亮(`--color-bg-hover`),不位移
- [x] 5.6 `<PolarityHeader>` 的「下载全部」:用 `<a download href="/api/public-opinion/polarity/export?...">` 实现,带当前筛选参数;有选中行时切到 `?ids=...`
- [x] 5.7 错误态 / 未配置态 / 空态:沿用 `.po-tile-state` / `.placeholder-state` 既有类
- [x] 5.8 a11y:chip 用 `<button aria-pressed>`,checkbox 用原生 `<input type="checkbox">` + 可见 focus ring

## 6. 页面路由

- [x] 6.1 修改 `apps/web/app/public-opinion/daily/polarity/page.jsx`:
  - 保留 `ConsoleShell` 外壳(`activeSlug="po-daily-polarity"`、`eyebrow="舆情速览 · 每日舆情"`、`title="正负面舆情"`)
  - `description` 改为「按情感档位与平台筛选当日 / 7 天 / 自定义时间窗内的舆情条目,可批量导出」
  - 正文从 `<section className="console-section placeholder-state">` 换成 `<DailyPolarityBoard />`
- [x] 6.2 保证 sidebar 高亮与 `po-daily` 子分组展开行为不变(由 console-shell 现有逻辑承接,无需改 console-shell)

## 7. 样式 globals.css

- [x] 7.1 追加 `.po-polarity-shell`:与 `.po-dashboard` 同 overflow 行为(`overflow-y: auto; min-height: 100%`),padding 与 v3 一致
- [x] 7.2 追加 `.po-polarity-summary`:`display: grid; grid-template-columns: repeat(3, 1fr) minmax(120px, auto); gap: var(--po-gap);` — 三色块 + 占比条同行
- [x] 7.3 追加 `.po-polarity-kpi[data-tone]`:`tone="pos" → 主色绿、tone="neu" → 灰、tone="neg" → 红`,边框 1px hairline + 内部 `数字 + 占比 + 小标签` 三层
- [x] 7.4 追加 `.po-polarity-strip`:`height: 8px; border-radius: 4px;` 内部三个色块按比例 flex,hover 触发上方 popover(`.po-polarity-strip-popover` 显示 5 档明细)
- [x] 7.5 追加 `.po-polarity-chips`:`.po-polarity-chip`(扩展 chip 样式:圆角 16px、低饱和填充、数量徽章浅圆)、`.po-polarity-chip.is-active`、键盘 focus ring
- [x] 7.6 追加 `.po-polarity-table`:无外框、行间距 0、行 hover 浅灰
- [x] 7.7 追加 `.po-polarity-row`:`display: grid; grid-template-columns: 24px 140px 72px 16px 1fr 200px 120px;` + `position: relative;`;`::before` 渲染 4px 色条 — `background: var(--row-emotion-color)`(JSX 内 inline style 注入 var)
- [x] 7.8 追加 `.po-polarity-row.is-selected`:高亮浅蓝;`.po-polarity-row[data-risk="true"]` 行首色条加深
- [x] 7.9 追加 `.po-polarity-pager`:左侧计数 + 右侧前后按钮,与 v3 视觉一致
- [x] 7.10 reduced-motion:`.po-polarity-strip`、chip 切换、行 hover 的 transition 全部 `none`

## 8. 测试与守护

- [x] 8.1 新建 `apps/web/tests/public-opinion-polarity.test.js`(归一化层,任务 1.8 已列)
- [x] 8.2 新建 `apps/web/tests/public-opinion-polarity-route.test.js`:
  - `configured: false` 未配置态
  - mock 分支返回 mock 数据
  - `slice=summary` / `slice=items` 切片只返回对应子树
  - 过滤参数串联:`sentiment3=正面&platform=Twitter` 时,返回 items 全部满足
- [x] 8.3 新建 `apps/web/tests/public-opinion-polarity-board.test.js`(组件守护):
  - 源文件含 `DailyPolarityBoard` / `<PolaritySummary` / `<PolarityFilters` / `<PolarityTable`
  - 源文件含 `aria-pressed` chip + `<input type="checkbox"` 行级勾选
  - 源文件含 `data-sentiment` 在行上(用于行首色条)
  - 源文件含 `/api/public-opinion/polarity/export` 字符串(下载入口)
- [x] 8.4 新建 `apps/web/tests/public-opinion-polarity-export.test.js`:
  - 未配置返回 JSON 503
  - mock 分支返回带 `Content-Disposition: attachment` 与 `text/csv` 的 body,body 以 BOM 起首
  - `?ids=` 子集导出条数正确
- [x] 8.5 v3 守护不回归:`public-opinion-control-room-v3.test.js` 与 v1/v2 守护测试继续通过(本 change 不改总览)
- [x] 8.6 `npm test` 在 worktree 内通过;`npm run build` 在 worktree 内通过(SSR 友好,DailyPolarityBoard 全是 React + no window)
- [x] 8.7 `npx openspec validate build-daily-polarity-board --strict`

## 9. 实测与验收

- [x] 9.1 1440 / 1280 viewport 实测:
  - 顶部概览三色块 + 占比条单屏可见,不溢出
  - chip 行不换行(典型平台数 ≤ 7)
  - 表格 10 行 + 分页器单屏可见
- [x] 9.2 mock 分支(`?mock=1`)在无凭据环境跑通筛选 → 表格 → 导出三条链路
- [x] 9.3 真实接口 smoke:配置 env 后,实际打开页面 + 切换情感 + 切换平台 + 翻页 + 自定义日期 + 下载,全部成功
- [x] 9.4 截图归档到 PR(改造前 placeholder + 改造后实页)
- [x] 9.5 与用户旧系统截图对比:覆盖率 ≥ 用户旧系统功能(筛选 + 表格 + 勾选 + 下载),且视觉与本系统 v3 control-room 一致

## 10. 实现前先验

- [x] 10.1 验证 `.po-dashboard` overflow 规则是否专属总览(若专属则新增 `.po-polarity-shell`);否则复用
- [x] 10.2 ~~验证 `apps/web/lib` 现有 XLSX 工具是否可复用~~ **已决议**:导出改 CSV (UTF-8 BOM),无需 XLSX 依赖,见 design.md D3
- [x] 10.3 验证 `createAsmxClient` 在 30s 超时下能否承载 `number=10000` — 失败则 D3 走分批
- [x] 10.4 在 worktree 创建初始 placeholder 提交,降低 main 影响面(若用 `using-git-worktrees` skill,等待 user 触发)
