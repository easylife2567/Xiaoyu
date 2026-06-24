# public-opinion-daily-polarity Specification

## Purpose
TBD - created by archiving change build-daily-polarity-board. Update Purpose after archive.
## Requirements
### Requirement: 「正负面舆情」页提供按情感档位与平台筛选的分析能力

系统 SHALL 在 `/public-opinion/daily/polarity` 提供「正负面舆情」分析页,不再呈现「功能建设中」占位。页面 SHALL 在 `ConsoleShell` 内渲染,正文 SHALL 由三段构成:**概览段**(3 档情感 KPI 色块 + 堆叠占比横条)、**筛选段**(平台 chip 行 + 情感 chip 行)、**信息流段**(分页表格 + 行级勾选)。情感档位 SHALL 在用户交互层折叠为 3 档(`正面 / 中立 / 负面`),原始 5 档语义 SHALL 仅在行首 4px 色条与悬停 tooltip 中保留。**视觉语言 SHALL 与「舆情总览」v3 control-room 同源** — 复用 `.po-rail` / `.po-band` / `.po-tile` 节奏与既有 5 模态情感色板,不引入新色板与新外框样式。

#### Scenario: 用户首次打开「正负面舆情」页

- **WHEN** 用户从 sidebar 点击「舆情速览 / 每日舆情 / 正负面舆情」
- **THEN** 系统 SHALL 导航到 `/public-opinion/daily/polarity`
- **AND** 页面 SHALL 在 `ConsoleShell` 内渲染,sidebar 中该条目 SHALL 高亮,父分组「每日舆情」SHALL 处于展开
- **AND** 正文 SHALL 呈现「概览 + 筛选 + 信息流」三段而非「功能建设中」占位
- **AND** 数据窗口 SHALL 默认为「7 天」,日期段控件 SHALL 处于「7 天」档

#### Scenario: 用户切换情感 chip

- **WHEN** 用户点击「负面」chip
- **THEN** 信息流段 SHALL 仅展示 `sentiment3 === '负面'` 的条目(由 `偏负面 ∪ 负面` 折叠而来)
- **AND** 概览段三色块 KPI SHALL 同步刷新为当前筛选范围下的计数
- **AND** 分页 SHALL 重置到第 1 页
- **AND** chip 自身 SHALL 标记为 `aria-pressed="true"`

#### Scenario: 用户切换平台 chip

- **WHEN** 用户点击平台 chip「Twitter」
- **THEN** 信息流段 SHALL 仅展示 `platform === 'Twitter'` 的条目
- **AND** 平台 chip 行 SHALL 实现单选语义(同一时刻只有一个 chip + 「全部」)
- **AND** 概览段计数 SHALL 同步刷新

#### Scenario: 用户切换日期段

- **WHEN** 用户切换日期段到「自定义」
- **THEN** 系统 SHALL 弹出 `<input type="date">` × 2 让用户选择起止
- **AND** 提交后请求 SHALL 带 `start=&end=` 参数
- **AND** 跨度超过 30 天时 UI SHALL 给出「较慢」提示但 NOT 阻止提交

### Requirement: 「正负面舆情」页支持行级勾选与当前筛选范围 CSV 导出

系统 SHALL 在信息流段为每一行提供 checkbox,以及表头「全选(本页)」开关。**「下载全部」按钮 SHALL 按当前筛选(情感 + 平台 + 时间窗)等价条件导出 CSV**;当存在勾选行时,SHALL 切换为「导出勾选 N 条」语义,仅导出选中条目。导出文件 SHALL 为 UTF-8 编码并以 BOM (`\\uFEFF`) 起首以让 Excel 默认正常解析中文,包含表头「平台 / 情感 / 风险 / 标题 / 关键词 / 发布时间 / 链接」,文件名 SHALL 形如 `正负面舆情_<start>_<end>.csv`。失败 SHALL 回 `application/json { error }` 而非空 csv,前端 SHALL 据此弹错提示。**实施约束**:不引入新的 XLSX 写入依赖;CSV 由后端就地拼写(`Content-Type: text/csv; charset=utf-8`)。

#### Scenario: 用户在当前筛选下点击「下载全部」

- **WHEN** 当前筛选为「负面 + Twitter + 最近 7 天」,无任何行被勾选,用户点击「下载全部」
- **THEN** 浏览器 SHALL 发起 `GET /api/public-opinion/polarity/export?sentiment3=负面&platform=Twitter&start=...&end=...`
- **AND** 响应 SHALL 包含 `Content-Disposition: attachment; filename*=UTF-8''<encoded>.csv`
- **AND** 响应 `Content-Type` SHALL 为 `text/csv; charset=utf-8`
- **AND** 响应 body SHALL 以 `\\uFEFF` 起首
- **AND** 下载文件 SHALL 仅包含同筛选条件下的条目(等价于列表里实际看到的全部条目,跨页)

#### Scenario: 用户勾选若干行后点击「下载全部」

- **WHEN** 当前筛选下,用户勾选了 3 条,点击「下载全部」
- **THEN** 系统 SHALL 切到「导出勾选 N 条」语义,请求带 `?ids=...`
- **AND** 下载文件 SHALL 仅包含被勾选的条目,顺序与列表一致

#### Scenario: 导出请求在未配置态下被拒

- **WHEN** ASMX 环境变量未配置,用户点击「下载全部」
- **THEN** 路由 SHALL 返回 HTTP 503 + `Content-Type: application/json` + `{ error: 'unconfigured' }`
- **AND** 前端 SHALL 提示「未配置舆情接口」,NOT 触发文件下载

### Requirement: 情感档位的 5 → 3 折叠规则集中在归一化层

系统 SHALL 将 5 档情感(`正面 / 偏正面 / 中立 / 偏负面 / 负面`)向 3 档(`正面 / 中立 / 负面`)的折叠规则集中实现于服务端归一化层(`apps/web/src/public-opinion/polarity.js`)。前端组件 SHALL NOT 重写折叠规则,SHALL 仅消费 BFF 返回的 `sentiment3` 字段用于过滤与计数,消费 `sentiment5` 字段用于行首色条与悬停明细。折叠映射 SHALL 为:`正面 ∪ 偏正面 → 正面`、`中立 → 中立`、`负面 ∪ 偏负面 → 负面`。未知或缺失值 SHALL 兜底为「中立」。

#### Scenario: 归一化层导出确定性折叠函数

- **WHEN** 单元测试调用 `foldSentiment5to3('偏正面')`
- **THEN** 函数 SHALL 返回字符串 `'正面'`
- **AND** `foldSentiment5to3('偏负面')` SHALL 返回 `'负面'`
- **AND** `foldSentiment5to3(null)` 或 `foldSentiment5to3('unknown')` SHALL 返回 `'中立'`

#### Scenario: BFF 在每条记录上同时给出 sentiment5 与 sentiment3

- **WHEN** `/api/public-opinion/polarity` 返回信息流条目
- **THEN** 每条 SHALL 同时含 `sentiment5`(原始 5 档之一)与 `sentiment3`(折叠后 3 档之一)
- **AND** 同一条目的 `sentiment3` SHALL 与 `foldSentiment5to3(sentiment5)` 输出一致

#### Scenario: 前端组件不重写折叠

- **WHEN** 前端组件源文件被检查
- **THEN** SHALL NOT 出现「将 `偏正面` 映射到 `正面`」的本地条件分支
- **AND** chip 过滤与 KPI 计数 SHALL 仅基于 BFF 返回的 `sentiment3`

### Requirement: 概览段呈现 3 档计数色块与堆叠占比横条

系统 SHALL 在「正负面舆情」页顶部概览段呈现 3 个 KPI 色块(`正面 / 中立 / 负面`)与一条 8px 高的堆叠占比横条。色块 SHALL 标注当前筛选范围下的条目数与占比百分比;占比横条 SHALL 按 3 档比例分段填充,**hover SHALL 在条上方浮出 5 档明细 tooltip**(`正面 / 偏正面 / 中立 / 偏负面 / 负面` 各自计数,从 `sentiment5` 字段聚合)。色板 SHALL 复用既有 5 模态情感色板(正面绿、中立灰、负面红);3 档色 SHALL 与 5 档色中的 `正面 / 中立 / 负面` 完全一致。

#### Scenario: 概览段在数据加载完成后渲染

- **WHEN** 页面数据加载完成
- **THEN** 概览段 SHALL 渲染 3 个 KPI 色块,各自显示该档计数与占比百分比
- **AND** 占比横条 SHALL 按计数比例分段,色与 KPI 色块一致

#### Scenario: 用户悬停在占比横条上

- **WHEN** 用户鼠标悬停在 `.po-polarity-strip` 上
- **THEN** 上方 SHALL 浮出 tooltip,列出 `正面 / 偏正面 / 中立 / 偏负面 / 负面` 5 档各自计数
- **AND** `prefers-reduced-motion: reduce` 偏好下,tooltip 浮出 SHALL 无过渡动画

#### Scenario: 数据加载中或失败时的概览段

- **WHEN** 概览段数据加载中
- **THEN** SHALL 呈现骨架占位(3 块矩形 + 一条横条),NOT 空白或布局跳变
- **WHEN** 概览段数据加载失败
- **THEN** 概览段 SHALL 呈现错态文字,信息流段 SHALL 仍正常渲染(降级独立)

### Requirement: 信息流表格每行带 5 档情感色条与可选风险/关键词标记

系统 SHALL 在信息流段渲染表格,每行 SHALL 在最左侧呈现 4px 宽的情感色条,色 SHALL 取自原始 `sentiment5` 字段(5 档色板)。每行 SHALL 同时呈现 3 档情感徽章(文字 `正面 / 中立 / 负面`)以满足色盲可达性。当条目 `risk === true` 时 SHALL 在标题前点亮风险标(⚠ 红 dot);当 `keyword` 非空时 SHALL 在时间列前以 `#关键词` 样式呈现。标题 SHALL 为可点击链接(`<a target="_blank">`),其后 SHALL 附「阅读原文」字样链接到原始 URL。

#### Scenario: 一条 `偏负面` 且带风险的舆情渲染

- **WHEN** 表格渲染一条 `sentiment5: '偏负面', risk: true, keyword: '召回'` 的条目
- **THEN** 行首 4px 色条 SHALL 为偏负面色(`EMOTION_COLORS['偏负面']`)
- **AND** 该行 SHALL 含一个 3 档徽章文字「负面」
- **AND** 标题左侧 SHALL 出现 ⚠ 风险 dot
- **AND** 时间列前 SHALL 出现 `#召回` 关键词标
- **AND** `data-sentiment="偏负面"` SHALL 落在行元素上(用于 CSS 选择器)

#### Scenario: 一条 `中立` 且无风险无关键词的舆情渲染

- **WHEN** 表格渲染一条 `sentiment5: '中立', risk: false, keyword: ''` 的条目
- **THEN** 行首色条 SHALL 为中立灰
- **AND** 该行 SHALL 含一个 3 档徽章文字「中立」
- **AND** 该行 SHALL NOT 渲染 ⚠ 风险 dot
- **AND** 该行 SHALL NOT 渲染关键词标

### Requirement: 信息流表格按 10 条/页分页,支持页码翻页

系统 SHALL 在信息流段以 10 条/页分页,底部分页器 SHALL 呈现「共 N 条,当前第 a-b 条」与前/后翻页按钮。BFF SHALL 支持 `page` 与 `pageSize` 参数,SHALL 返回 `pagination: { page, pageSize, total }`。翻页 SHALL 仅刷新 items(`?slice=items`)而 NOT 重算 summary 与 platforms,以避免顶部数据闪烁。

#### Scenario: 用户翻到第 2 页

- **WHEN** 用户点击「下一页」
- **THEN** 请求 SHALL 为 `?slice=items&page=2&pageSize=10&<其他过滤>`
- **AND** 概览段 KPI 与平台 chip 数量徽章 SHALL NOT 因翻页而刷新
- **AND** 表格行 SHALL 渲染第 11-20 条
- **AND** 分页器 SHALL 显示「共 N 条,当前第 11-20 条」

#### Scenario: 用户切换筛选后回到第 1 页

- **WHEN** 用户在第 3 页时切换情感 chip
- **THEN** 系统 SHALL 重置 `page=1` 并请求完整 payload(含 summary + items)
- **AND** 分页器 SHALL 重置到「第 1-10 条」

