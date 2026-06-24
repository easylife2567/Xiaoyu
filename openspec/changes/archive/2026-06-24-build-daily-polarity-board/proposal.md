## Why

「舆情速览 / 每日舆情 / 正负面舆情」(`/public-opinion/daily/polarity`)目前是 `add-public-opinion-overview-nav` 落地的占位页 — `<section className="console-section placeholder-state">功能建设中</section>`。

用户上一个项目里的「正负面舆情」承载着研究员的高频操作:在某段时间窗口内按情感倾向(正/中/负)和发布平台筛选舆情条目、把命中的条目批量下载为 XLSX。这是「日常舆情排查 → 形成研判材料」最短的一条路径,比舆情总览看板的图表更接近"成稿"。

把这条路径补齐后,「每日舆情」三个子条目的占位才真正只剩两个 — 也是 v3 control-room 之后第一次把"导航占位"转成"真实分析页"。

## What Changes

- **新增前端路由** `/public-opinion/daily/polarity`,从 placeholder 升级为分析页;`ConsoleShell` 外壳不变,正文呈现「概览 + 筛选 + 信息流」三段。
- **新增 BFF 路由** `GET /api/public-opinion/polarity`:并行调 `getSpanTimeMediaInfo`(信息流)与 `getModMediaNumberByTime`(分布)聚合 DTO;沿用 `createAsmxClient` 会话、未配置态、单 widget 降级范式。
- **新增 BFF 路由** `GET /api/public-opinion/polarity/export`:复用同一筛选参数,以 **CSV (UTF-8 BOM)** 流式返回当前筛选结果;失败回 `application/json { error }` 而非空文件。**不引入新的 XLSX 写入依赖** — CSV 在 Excel 中能直接打开,零依赖兼容。
- **复用 v3 视觉语言**:页面顶部 KPI 色块 + 占比横条沿用 `.po-rail` / `.po-tile`,中部 chip 筛选行沿用 `.po-band` 节奏,信息流表格沿用 5 模态情感色板与「行首 4px 色条」。
- **情感档位 3 档折叠**:页面交互层只暴露 `正面 / 中立 / 负面` 三档 chip,后端 DTO 同时返回 `sentiment5`(给行首色条 / hover)与 `sentiment3`(给 chip 过滤);折叠规则集中在归一化层,前端不重写。
- **新增 mock 分支**:`mock-payload.js` 旁挂派生 polarity mock,沿用 seeded LCG;`?mock=1` 在 dev 直通,生产看 `PUBLIC_OPINION_MOCK=1`。

## Capabilities

### Added Capabilities

- `public-opinion-daily-polarity`:面向研究员的「按情感档位 + 平台 + 时间窗筛选舆情条目并批量导出」的分析页能力 — 包括概览(3 档计数 + 占比横条)、筛选(平台 chip / 情感 chip / 时间段)、信息流(分页表格 + 行级勾选 + risk/keyword 标记)、导出(当前筛选范围 XLSX)。

### Modified Capabilities

- `public-opinion-overview`:「正负面舆情」从「功能建设中」占位升级为已交付真实能力的条目;导航与路由 slug 不变,仅页面正文从占位替换为分析页。

## Impact

- **新增** `apps/web/app/public-opinion/daily/polarity/page.jsx`:替换 placeholder,渲染 `<DailyPolarityBoard>` 组件
- **新增** `apps/web/components/public-opinion-polarity-board.jsx`:三段(KPI + 筛选 + 信息流表格)+ 行级勾选状态机 + 分页 + 导出触发
- **新增** `apps/web/src/public-opinion/polarity.js`:`buildPolarityContext` / `getPolaritySummary` / `getPolarityItems` / `foldSentiment5to3` / `aggregatePolarity`
- **新增** `apps/web/src/public-opinion/polarity-mock.js`(或挂在 `mock-payload.js`):seeded 派生 mock
- **新增** `apps/web/app/api/public-opinion/polarity/route.js`:聚合 + mock 分支 + `slice=summary` / `slice=items` 切片
- **新增** `apps/web/app/api/public-opinion/polarity/export/route.js`:CSV (UTF-8 BOM) 响应,零依赖
- **新增** `apps/web/tests/public-opinion-polarity.test.js`(BFF/折叠规则)、`apps/web/tests/public-opinion-polarity-board.test.js`(组件守护)
- **修改** `apps/web/app/globals.css`:追加 `.po-polarity-summary`(KPI 色块) / `.po-polarity-strip`(3 档堆叠占比条) / `.po-polarity-chips`(chip 行) / `.po-polarity-table`(表格 + 行首 4px 色条) / `.po-polarity-row[data-sentiment]`;复用 v3 token,不引入新色板
- **修改** `apps/web/src/public-opinion/config.js`(若需要):无;复用 `resolvePublicOpinionConfig`
- **不影响**:`public-opinion-dashboard`(总览)、`workbench-shell-ux`、其他工作台、Prisma、Python worker、`packages/contracts`

## Open Questions

- 是否在 BFF 侧做"全量(导出用)"与"分页(列表用)"的二级 API,还是导出路由内部用 `number=10000` 一次拉满?→ MVP 采用后者(legacy ASMX `getSpanTimeMediaInfo` 支持 `number` 大值);若实测响应慢,再分批 + cursor。决策记入 design.md D3。
- 自定义日期段最大跨度?legacy 接口对 `startDay / endDay` 没有硬上限,但 v3 已统一 7 天默认。→ 自定义允许任意,但 UI 提示「跨度超过 30 天可能较慢」,服务端不卡。
- XLSX 引擎选哪个?→ **不选,导出格式改为 CSV (UTF-8 BOM)**。仓库无现成 XLSX 写入工具(Web 层把 Excel 处理委托给 Python worker),引入 `exceljs` 等新依赖代价远高于场景需要;CSV 在 Excel 中双击即可正常显示中文。详见 design.md D3 与 R3.1。
