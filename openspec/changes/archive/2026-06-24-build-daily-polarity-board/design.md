# Design — build-daily-polarity-board

## Context

`add-public-opinion-overview-nav` 给「舆情速览」六个子条目都铺了稳定路由 + 占位页;`build-public-opinion-overview-dashboard` 把首条「舆情总览」从占位升级到真实看板;`restyle-overview-control-room-v3` 把那张看板从「11 张白卡」打磨成「KPI rail + 3 个 band + sticky feed」的控制室形态。

但「正负面舆情」(`/public-opinion/daily/polarity`)仍是 placeholder。这次 change 把它做成"研究员真正动手的页面" — 不是看板,而是工作面板:筛(情感/平台/时间)、看(分页表格)、勾(行级 checkbox)、导(XLSX)。

页面信息架构参照用户上一个项目的「白杨舆情系统 / 正负面舆情」截图,同时所有视觉 token 必须与 v3 control-room 一脉相承。

## Goals / Non-Goals

### Goals

- G1:把 placeholder 替换为可用的分析页 — 筛选、表格、分页、勾选、导出一条龙可用。
- G2:视觉语言与 v3 control-room 同源 — `.po-rail` / `.po-tile` / 5 模态情感色板 / 行首 4px 色条 / chip 视觉,**禁止引入新色板与新外框样式**。
- G3:情感档位"前 3 后 5"统一管理 — 折叠规则集中在归一化层,前端只消费 `sentiment3`(过滤)与 `sentiment5`(色条/hover),避免散落 if 分支。
- G4:BFF 单 widget 降级范式延续 — `summary` / `items` 任一失败只置空该块并记 `errors`,其他块照常返回。
- G5:导出体验"所见即所得" — 「下载全部」按当前 chip + 时间窗 + 平台过滤的等价条件导出,而非永远全量。

### Non-Goals

- 不动 BFF 鉴权 / 会话 / 未配置态 / mock 总开关。
- 不动「舆情速览」导航与子路由占位契约(由 `public-opinion-overview` capability 守护)。
- 不引入连续情感分(0.48 / -0.5 类) — 后端没有该字段,前端禁止造分。
- 不引入新 chart 库;表格用原生 HTML + CSS,不需要 recharts。
- 不引入「按平台双轨情感分析」「关键词云」等总览页已有的能力;polarity 页专注"条目层"。
- 不引入暗色模式。
- 不引入 server-side pagination 之外的"无限滚动" / "下拉加载",维持分页器以匹配用户期望。

## Decisions

### D1 筛选模型:3 档 chip + 多平台 chip + 日期段三档

- **决定**:页面顶部从上到下三段:概览 → 筛选 → 信息流。筛选分两行:
  - 第 1 行(平台):`全部·N / <平台 1>·N / <平台 2>·N / …`,chip 平铺,数量徽章来自 BFF `platforms[]`。点击切换"单选"(全部 ∪ 单平台),不是多选 — 与用户截图一致,降低决策成本。
  - 第 2 行(情感):`全部 / 正面 / 中立 / 负面`,3 个 chip + 1 个全部。
  - 日期段控件挂在页头右侧(与「下载全部」一行),3 档:`今日` / `7 天` / `自定义`。自定义弹出原生 `<input type="date">` × 2,提交后请求带 `start=&end=`。
- **理由**:5 档折叠为 3 档是用户在前一轮问答里明确选择的;平台多选会和 chip 数量徽章产生"勾掉一项徽章就要全部重算"的视觉抖动,单选更稳;日期 3 档与「舆情总览」7 天默认对齐。

### D2 情感档位"前 3 后 5"

- **决定**:归一化层 `polarity.js` 暴露纯函数 `foldSentiment5to3(label5)`,映射规则:
  - `正面 ∪ 偏正面` → `正面`
  - `中立` → `中立`
  - `负面 ∪ 偏负面` → `负面`
- DTO 中每条记录同时携带 `sentiment5`(原始 5 档,给行首色条与 hover tooltip)与 `sentiment3`(折叠,给 chip 过滤与 KPI 计数)。
- `summary` 字段直接给 3 档:`{ positive, neutral, negative, total }`(由 5 档加和得出),不再让前端二次折叠。
- **理由**:折叠规则只能有一处实现 — 放在前端会和测试断言耦合到 React 组件;放在 BFF 让单元测试简单 + 守护一致。前端只查 `sentiment3` 决定显隐,查 `sentiment5` 决定色条颜色。

### D3 BFF 数据流:1 个聚合路由 + 1 个导出路由

- **决定**:
  - `GET /api/public-opinion/polarity?sentiment3=&platform=&start=&end=&page=&pageSize=`:返回 `{ configured, range, summary, platforms, items, pagination, errors }`,默认 `pageSize=10`,与用户截图一致。`slice=summary` / `slice=items` 切片用于"只刷新计数"或"只刷新列表"。
  - `GET /api/public-opinion/polarity/export?<同上,不含 page/pageSize>`:服务端用 `number=10000` 单次拉满 + CSV (UTF-8 BOM) 响应(`Content-Disposition: attachment`)。失败回 `application/json { error }` 而非空文件。
- **理由**:legacy `getSpanTimeMediaInfo` 已支持 `page/number`,直接映射 `page/pageSize` 最省心;导出走单独路由,避免聚合路由判断 `Accept` 的耦合。导出格式选 **CSV** 而非 XLSX — 仓库无现成 XLSX 写入工具(`apps/web/lib` 大翻译/日报把 Excel 处理委托给 Python worker,Web 层只搬路径),引入 XLSX 写入需要新依赖或牵 Python worker,代价远高于场景需要;CSV (UTF-8 BOM) 在 Excel 中双击可直接打开中文,零依赖。导出"一次拉满"是 MVP 取舍 — 真出现万条+导出再分批,代价是延后改造,不是改 DTO。

### D4 视觉:复用 v3 三件套,绝不再造卡片

- **决定**:
  - **概览区** = `.po-rail` 的子集形态:3 个 KPI 色块(正/中/负,带计数 + 占比)+ 1 个堆叠占比横条(高 8px,绿/灰/红;hover 在条上方浮出 5 档明细)。
  - **筛选区** = 一个 `.po-band data-band="filter"`,内部 `.po-polarity-chips` 两行 chip。
  - **信息流区** = 一个 `.po-band data-band="feed"`,内部一个 `.po-polarity-table`:
    - 表头工具条:`☐ 全选` / `↻ 刷新` / `⇅ 排序` ……… 右侧 `下载全部` / `共 N 条,第 a-b 条`。
    - 行:`☐` + `平台徽标 + 平台名` + `情感徽章(3 档)` + `⚠ risk dot`(条件) + `标题(含「阅读原文」)` + `#关键词`(条件) + `时间`(右对齐)。
    - **行首左侧 4px 色条**:用 5 档原色(`EMOTION_COLORS` 映射),信息密度比顶部 chip 更高,这是用户旧系统每条带情感分的现代替代。
    - 分页器:左侧 `共 N 条,第 a-b 条`,右侧前/后翻页按钮。
- **不允许**:画新外框、引入卡片阴影、行首加图标头像、用渐变填充作背景。

### D5 mock 与 fixture

- **决定**:`mock-payload.js` 加一个 `buildPolarityMock(range)`,从同一池 `SAMPLE_TITLES` × `MEDIAS` × 5 档采样;`risk` 散布在 4 条,关键词 1/3 占比 — 沿用现有 mock 风格。`?mock=1` 在 dev 直通,prod 看 env;导出路由独立 mock(导出"全量",至少 60 条)。
- **理由**:演示场景下没有 ASMX 也能跑通整条筛选 → 表格 → 导出链路,与既有 mock 设施一致。

### D6 a11y / reduced-motion

- chip 与行 checkbox 用原生 button/input,`role` 与 `aria-pressed` 标注;键盘 Tab + Space 可达。
- 行首 4px 色条对色盲不友好 → 同时输出 3 档情感徽章文字(`正面 / 中立 / 负面`),色与字双通道。
- `prefers-reduced-motion` 偏好下:chip 切换不做 transition,堆叠占比条数据更新不做 morph 动画。

## Risks

- **R1 ASMX `getSpanTimeMediaInfo` 自定义日期段性能未知** — 跨度 ≥ 30 天可能慢 5-10s。**Mitigation**:UI 提示 + 给请求超时 30s(`asmx-client.js` 的 `timeoutMs` option 已支持),超时回错态;不做 client-side 限制。
- **R2 prevention of UI flicker on chip toggle** — chip 切换会触发 `summary` 与 `items` 两次请求,KPI 与表格数据短时不一致。**Mitigation**:把两者合并成单次聚合请求,`slice=` 只在用户翻页时启用;chip 切换永远走聚合。
- **R3 导出大小** — 1 万条 CSV ≈ 1-3MB,Node 拼接字符串可承载;若后续突破 5 万条考虑流式或 XLSX 分批。**Mitigation**:导出路由用 `aggregatePolarity` 的 `pageSize=10000` 一次拉满。
- **R4 ConsoleShell 的 `.po-dashboard` overflow:auto 是否同样适用于 polarity 页** — 总览页 `.po-dashboard` 是滚动容器,polarity 页若复用同 class 可省 CSS;若不复用要单独定义 `.po-polarity` 容器并复制 overflow 规则。**Mitigation**:实现前先查 `.po-dashboard` 是否被 v3 写死成"总览专属",若是则新增 `.po-polarity-shell`(同行为)。

## Migration Plan

- 一次性切换(占位 → 真实页),路由不变 — 零迁移成本。
- 守护测试包含「无 BFF / 未配置」分支,保证 ASMX env 缺失时页面回 v3 同款「未配置」态。

## Open Questions

- 是否要在表格里加"原始情感(5 档)" tooltip?当前方案:行首 4px 色条 + 鼠标悬停行,在第一格附近浮出小 tooltip 显示 `偏正面 / 偏负面`。**待 7.x 实测后定**,默认开。
- 「下载全部」名字是否要随 chip 改成「下载当前筛选 N 条」?**先按截图保留原文「下载全部」**,但 hover tooltip 写明"按当前筛选导出";若用户验收说看不懂,再改文案。
