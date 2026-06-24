# Design — restyle-overview-control-room-v3

## Context

线上 v2「sticky feed」让信息流常驻右侧后,看板从「上下滚动」变成「左分析 + 右流」。但截图(2026-06-24)显示新的视觉问题:右侧 sticky `top: 84px` 让 feed 在视口里从中段起步,KPI rail 自身又只占左半幅,顶部出现一整条 ≥ 200px 的空白带;`预警概览` panel 数据稀疏(0/0),却与一个"幽灵卡片"并排占满 8 列;11 个图表面板的等权外框让"哪些重要"信息丢失。

ui-ux-pro-max 推荐的两条范式正好对症:**Data-Dense Dashboard** 主张 `--card-padding: 12px`、`grid-gap: 8px`、`font-size: 12-14px`、`compact card design`;**Real-Time Monitoring** 主张 status badge / live indicator / 区分关键告警。本次把这两条范式合一,把"卡片网格"重构为"控制台分区"(banded sections + ruled hairlines + KPI rail with alert badge)。

## Goals / Non-Goals

### Goals

- G1:消灭顶部留白——KPI rail 与 aside feed 在视口顶端对齐,无 200px 真空带。
- G2:消灭"预警旁的空位"——`预警概览` 收为 KPI rail 末端徽标,空出来的 4 列由「媒体来源占比」迁入,让该行自然铺满。
- G3:降低卡片审美疲劳——中部分析区从「11 张白卡」改为「3 个 band(态势/结构/热点)+ 无边框 tile」,视觉重量回到数据本身。
- G4:不破坏 v1/v2 已落地的密度化、sticky feed、mock、30s 轮询、5 模态情感色板、d3 子包契约、reduced-motion 守护。

### Non-Goals

- 不动 BFF、归一化、降级、未配置态。
- 不动「舆情速览」导航与子路由占位契约(由 `public-opinion-overview` capability 守护)。
- 不引入新依赖(echarts / framer-motion 等)。
- 不引入暗色模式(超出本次范围)。

## Decisions

### D1 顶栏:KPI rail 取代 KpiBar + 预警 Panel

- **决定**:新增 `.po-rail`,内部 5 槽 grid(3 KPI tile + 1 mini-trend + 1 alert badge),横向占满 12 列(`grid-column: 1 / -1`),高度 ~64px(略高于 v2 KpiBar 的 ~52px,但取代了一整张预警 panel,净瘦身)。
- **alert badge 状态**:
  - `total === 0 && major === 0` → 静默 dot(`#86909c`,8px),tooltip "当前无预警"。
  - `major > 0` → 红底 `#f53f3f` 圆角矩形,显示 `重大 N`。
  - `total > 0 && major === 0` → 主色边框徽标,显示 `预警 N`。
- **点击 badge**:就地展开/折叠 `.po-alert-popover`(沿用 `.po-wordcloud` 渲染 topWords);ESC 关闭;`role="dialog"` + `aria-modal="false"`。
- **理由**:把"低频但要常驻可见的告警"用徽标常驻,远比一张"0/0 空 panel"信息密度高;同时把预警空 panel 让出的 4 列让给"媒体来源占比",一举两得。

### D2 中部:Band 取代 Panel 外框

- **决定**:新增 `.po-band`,渲染规则:
  - `::before` 一行小写灰标签(`color: var(--color-text-secondary)`, `font-size: 10.5px`, `letter-spacing: 0.06em`, `text-transform: uppercase` 仅对 latin),如 `态势 · trend` / `结构 · composition` / `热点 · hot spots`。
  - 顶部 1px hairline(`border-top: 1px solid var(--color-divider)`),与 band 标签同一行,标签覆盖在 hairline 上(像章节分隔)。
  - 内部 `.po-band-grid` 是 12 列子栅格,`gap: var(--po-gap)`。
- **band 内容(初始)**:
  - **态势 band**:`情感×时间趋势 (span 8)` + `今日分时×媒体 (span 12)` —— 第一行 8+4 留白(留 4 槽给 mini-trend?),第二行 12 全宽。**取舍**:第一行 4 槽留白会再现"半空"。修正方案:首行 `情感×时间趋势` 改 `span 12`,`今日分时×媒体` 第二行 `span 12`,两图同宽。
  - **结构 band**:`媒体×情感矩阵 (span 6)` + `媒体×情感百分比 (span 6)` 等高并排;`情感分布 (span 12)` 第二行全宽。
  - **热点 band**:`媒体来源占比 (span 4)` + `Top 热门信息 (span 4)` + `今日平台分布 (span 4)`,三栏对齐填满。
- **`.po-tile`**:band 内每个图表的容器,**无边框无外阴影**,只有 `padding: 10px 12px` + 内部 `.po-tile-head`(小标题 12px + 副标 10.5px 同一行),hover 时 `background: var(--color-bg-hover)`(`#f5f7fa` 同色但更浅版本)+ 8px 圆角的内层 highlight,**不偏移位置**(避免对齐抖动)。
- **理由**:band 是"语义分组",hairline 是"低噪声分隔",tile hover 是"指针反馈"——三者合起来既维持了高密度又保留了可读层级。

### D3 aside:`top` 与 rail 顶对齐

- **决定**:把 `.po-overview-aside { top: 84px }` 改为 `top: 0`,因 `.po-dashboard` 已是滚动容器(`overflow-y: auto`,见 tasks 9.1 验证),sticky 的参考是滚动容器内部坐标,`top: 0` 即对齐 rail 顶。
- **rail 与 feed 顶部对齐机制**:`.po-overview-aside` 第一个子元素是 feed 卡;feed 卡顶部 padding 12px 与 KPI rail 内部 padding 12px 对齐,视觉基线一致。
- **风险**:若上层 `ConsoleShell` topbar 是 `position: fixed`,可能会盖到 rail 顶部;需在 9.1 用 1440 viewport 实测;如有遮挡则把 rail `padding-top` 加到 56px,把 aside `top` 同步设为 `0`(rail 与 feed 都被 topbar 盖住 0,因为它们在 .po-dashboard 滚动容器内,topbar 之外)。

### D4 字号与节奏

- 面板标题 `--po-title-size: 13px → 12px`
- 副标题 `--po-subtitle-size: 11px → 10.5px`
- 卡间隙 `--po-gap: 12px → 10px`
- 内边距 `--po-pad: 12px → 10px`
- 圆角 `--po-panel-radius: 10px → 8px`(tile)

### D5 渐进式兼容

- 保留 v2 类 `.po-panel` / `.po-panel-head` / `.po-kpi-bar` / `.po-kpi-tile` 的 CSS 规则不删除,只让 `.po-band` / `.po-tile` 拥有更高优先级或仅在 `.po-dashboard[data-v="3"]` 作用域生效(避免破坏现有快照测试)。
- 组件层 props 不变:`Panel({ title, subtitle, span, error, empty, children })` 仍可被 `Band` 内的子组件渲染,只是 `Panel` 内部模板切换成 `.po-tile` 结构。

## Risks

- **R1**(高):`.po-overview-aside` sticky 在 `.po-dashboard` 滚动容器内 `top: 0` 时,旧浏览器(Safari 14)对 sticky 滚动容器嵌套支持差。**缓解**:已知 v2 sticky 在生产已工作 → 同容器同机制,仅改 top 值。
- **R2**(中):去除 `.po-panel` 外框后,如果 band hairline 没有渲染或 contrast 不足,看板会显得"散架"。**缓解**:hairline 用 `--color-divider`(已在百炼令牌中,1px 实线,对比 ≥ 1.5:1);并在 tile 之间保留 `var(--po-gap)` 留白维持节奏。
- **R3**(中):预警徽标点击展开关键词云,popover 定位需与 rail 末端对齐且不溢出 viewport;`>1440` 时空间充裕、`<1280` 时 aside 已塌入下方,rail 仍在顶部,popover 向下展开即可。
- **R4**(低):测试快照若依赖旧类名 `.po-panel`,需调整为按内容查询。**缓解**:守护测试用类名 + 文本组合断言,而非快照。

## Migration Plan

1. CSS 新规则与组件 props 同时落,旧 `.po-panel` 类继续存在但仅出现在 loading 骨架(允许它「未来彻底删除」)。
2. 守护测试同时校验「无独立预警 panel」「band 三段存在」「aside top:0」「sentiment-feed-v2 行为完整」。
3. 验收:1440×900 viewport 下首屏可视模块 ≥ 9(KPI rail 算 1 + alert badge + 态势两图 + 结构 3 图 + 热点 3 列首行 + feed 顶部 6 条 ≈ 9~10)。

## Alternatives Considered

- **A1 全 Bento(整页一张大网格)**:信息层级再次扁平,反而比卡片网格更难扫读;放弃。
- **A2 Glassmorphism / HUD 风**:不匹配企业控制台审美,且 ui-ux-pro-max 标注其 a11y 风险;放弃。
- **A3 Drill-Down 分层(主页只看 KPI + 一图,点击下钻)**:跨页跳转成本高,丢「一眼看完」体感;放弃。
- **A4 仅删边框不动结构**:解决审美疲劳但不解决空位与留白;放弃(无法满足 G1/G2)。
