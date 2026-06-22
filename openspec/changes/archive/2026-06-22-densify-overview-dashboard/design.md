## Context

[restyle-console-bailian](../archive/) 已统一全局令牌与 shell 视觉,但舆情看板呈现仍是"粗栅格 + 大磁贴 + 单大饼图"。参考用户提供 HR Attrition 看板,密度提升靠**信息惯用语**而非更多数据:紧凑 KPI 条 / 微环并排 / 双 chip 排行 / 真热力矩阵 / 均值线 / 卡片流。本次只动呈现,不动数据/模块/shell。

## Goals / Non-Goals

**Goals:**
- 1440×900 屏单屏可见前 6–7 模块(从当前 4–5),后续少量下滑;
- 视觉沿用百炼蓝主色 + 5 模态语义色,不引入新色;
- 数据接入/归一化/BFF/shell/滚动契约零改动。

**Non-Goals:**
- 暗色模式;新数据;日期选择器;OpenSpec capability 边界变更。

## Decisions

### 决策 1:12 列栅格替换粗 2 列

新增 `.po-grid-12`:`grid-template-columns: repeat(12, 1fr); gap: var(--space)`。每模块用 `style={{ gridColumn: 'span N' }}`(或 `--span` CSS 变量)指定占列。提议布局(1440 宽):

| 模块 | span | 行 |
|---|---|---|
| KPI 紧凑条 ×3(合一容器) | 12 | 1 |
| 本周趋势(直方图+均值线) | 6 | 2 |
| 情感分布 5 小环并排 | 6 | 2 |
| 今日分时趋势(直方图+均值线) | 6 | 3 |
| 今日平台分布 Top 7 横条 | 6 | 3 |
| 媒体来源占比(双 chip 排行 Top 7) | 4 | 4 |
| Top 热文(双 chip 排行 Top 10) | 4 | 4 |
| 预警概览(量卡 + 高频词) | 4 | 4 |
| 媒体×情感矩阵(真热力图,跨整行) | 12 | 5 |
| 最新舆情信息流(卡片流,跨整行) | 12 | 6 |

≤1080:全部塌成 span 12(单列)。`.po-dashboard` 继续局部滚动;模块更密,下滑距离显著缩短。

### 决策 2:KPI 紧凑条(参考图 OVERVIEW 同款)

```
[图标]  16.1%   |   [图标]  237   |   [图标]  1,233
        ATTRITION RATE      TOTAL ATTRITION    CURRENT EMPLOYEES
```

`.po-kpi-card` 改为水平布局:左侧 28×28 描边图标(主色)、右侧上行大号数字(1.6rem,`tabular-nums`)、下行极小灰标签(0.72rem,uppercase 处理可选)。高度从 88 → 56px。

### 决策 3:情感 5 小环并排(替换大饼)

新组件 `MiniDonut`:54×54 SVG 环,每环对应一模态 = 一段弧 + 中央空心;上方放该模态计数(粗体),下方放模态名(灰)。5 环横向排成一行,占 panel 内部。语义色不变。

### 决策 4:双 chip 排行(参考图 Job Role / Education 同款)

`.po-rank-row`:`[序号 #1] [媒体名 ……] [橙 chip 100] [灰 chip 320]`(我们配色:橙→`--color-primary-bg` 蓝浅底 + 主色文字;灰→中性深底 + 白文字)。两 chip 分别表示**主指标**(本周量)与**次指标**(总量或对比)。当前数据层只有单指标 → v1 双 chip 显示同源单指标的两种呈现(占比 % + 绝对值),归一化层增加 `share`/`absolute` 两字段(纯派生,不改后端)。

### 决策 5:真热力矩阵(替换堆叠条)

`.po-heatmap`:CSS Grid,行 = 平台,列 = 5 情感模态。每格 `background-color: rgba(22,119,255, opacity)`,opacity = `count / max`(平台行内归一化)。格内显示数字,字色随 opacity 切换(深底白字、浅底深字)。表头标签固定 5 模态名。可读性强、密度高。

### 决策 6:趋势均值线

recharts `LineChart` 加 `<ReferenceLine y={avg} strokeDasharray="4 4" stroke="#86909c"><Label value="Avg N" /></ReferenceLine>`。`avg` 在组件内由 points 计算。

### 决策 7:CSS 变量驱动 span

避免每个 panel JSX 硬编码 `style`,在 className 上挂 `data-span="6"`,CSS 用属性选择器:`.po-grid-12 > [data-span="6"] { grid-column: span 6 }`,1080↓ 全部覆盖为 span 12。便于响应式与回退。

## Risks / Trade-offs

- **[12 列栅格在 1024–1080 之间转折时不自然]** → 设两断点:>1280 跑 12 列、1080–1280 把次要模块降到 span 12、≤1080 全单列。
- **[5 小环并排在窄宽度溢出]** → ≤1080 改 2×3 网格,小环本身不缩。
- **[双 chip "两值"需新字段]** → 仅在归一化层派生 `share`/`absolute`,数据 fetch 不动;后端零改动。
- **[热力图色阶用蓝色单色阶 vs 情感语义色阶]** → 默认蓝单色阶(决策 5);若用户后续要求语义色阶,改一行 `hsl/rgb` 即可。

## Migration Plan

纯视觉重构,回滚 = 还原组件呈现 + globals CSS 新增段。零数据/路由/接口/shell 改动。落地:① 12 列栅格 + KPI 紧凑条 → ② 5 小环 + 双 chip 排行 → ③ 真热力矩阵 + 均值线 → ④ 卡片流密度 → ⑤ 守护测试(令牌仍引用、热力图存在、5 小环数 = 5)+ 全量回归 + build。

## Open Questions(已敲定)

- ✅ **热力矩阵色阶**:蓝单色阶(`#1677ff` α 渐变,经 d3-scale 平滑)。
- ✅ **双 chip 次指标**:占比 %(归一化层派生 `share`,不改后端)。
- ✅ **加 d3.js 做更深层自定义**:解锁 recharts 做不到的细粒度控制(见决策 8)。

## 决策 8:引入 d3 子包做高级可视化与微交互

按需引入 d3 子包(不引整个 d3,控 bundle):
- `d3-scale` + `d3-scale-chromatic`(`scaleSequential` + `interpolateBlues`):热力图色阶平滑
- `d3-shape`(`arc`):MiniDonut 自定义 SVG 弧,精确控制 cornerRadius / padAngle
- `d3-array`(`max`/`extent`):热力图归一化
- `d3-interpolate`(`interpolateNumber`):KPI 与 MiniDonut 中央数值滚动动画(CountUp)

**炫酷效果清单**(全部受 `prefers-reduced-motion` 守护,降级为瞬时):

1. **KPI 数字滚动入场**(0 → target,~800ms,easeOutCubic)
2. **MiniDonut 弧线绘制动画**(stroke-dasharray 渐显,~600ms)+ 中央数字同步滚动
3. **直方图 bar 从底部 grow**(transform scaleY,stagger 30ms)
4. **趋势折线 path 描边动画**(stroke-dashoffset)
5. **热力图格子 hover:轻微放大(scale 1.05)+ 描边 + tooltip;键盘 Tab 可达**
6. **排行行主 chip 内嵌 mini bar**(用宽度可视化 share %,信息密度再上一层)
7. **卡片进入 stagger fade-in + 微抬升**(opacity 0→1, translateY 6→0)

为什么 d3 而非更多 recharts:热力图与 MiniDonut 在 recharts 里别扭(都要 hack);d3-shape 直接画 SVG 一行搞定,且 transition 与 hover 可控。

**严守边界**:d3 只用于"画 + 算色阶 + 数值插值",**不引 d3-selection 直接操作 DOM**(违反 React 心智)。所有 d3 输出回流到 JSX/SVG,React 接管渲染与事件。
