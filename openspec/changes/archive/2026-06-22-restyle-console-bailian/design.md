## Context

控制台 shell([console-shell.jsx](../../../apps/web/components/console-shell.jsx) + globals.css)与舆情看板视觉为临时拼装:配色硬编码、无令牌。`:root` 现仅有几何变量(`--shell-topbar-height` 等)与基础字体/色。本次对齐**阿里云百炼(Model Studio)控制台**(阿里云/Ant 设计语言:亮色、克制、数据密集),`ui-ux-pro-max` 推荐风格为 **Data-Dense Dashboard**,采用之并覆盖其通用配色/字体为百炼实际令牌(Chinese-first)。

硬约束:**只改视觉**。`workbench-shell-ux` 的布局与滚动契约(`height/overflow/sticky`、持久导航、section flex 分布)必须原样保留;数据/路由/业务逻辑不动。

## Goals / Non-Goals

**Goals:**
- 建立应用级设计令牌,shell 与看板共享,呈现统一"百炼级"企业控制台观感。
- console-shell(topbar/sidebar/utility rail)+ 舆情看板视觉对齐百炼。
- 改动隔离在 `:root` 令牌 + 样式颜色/间距/字体/状态 + className + recharts 主题。

**Non-Goals:**
- 暗色模式;新数据模块;日期选择器;翻译/日报内容区重做;改动滚动/导航行为。

## Decisions

### 决策 1:应用级设计令牌(百炼/Aliyun 语言,扩展现有 `:root`)

在 globals.css `:root` 既有几何变量旁新增令牌,**全局共享**(shell + 看板 + 后续页面):

```css
:root {
  /* 主色 — 阿里云/Ant 蓝 */
  --color-primary: #1677ff; --color-primary-hover: #4096ff; --color-primary-active: #0958d9;
  --color-primary-bg: #e6f0ff;
  /* 中性 */
  --color-title: #1d2129; --color-text: #4e5969; --color-text-secondary: #86909c; --color-text-disabled: #c9cdd4;
  --color-bg-page: #f0f2f5; --color-bg-card: #ffffff; --color-bg-hover: #f2f3f5;
  --color-border: #e5e6eb; --color-divider: #ebedf1;
  /* 语义 */
  --color-success: #00b42a; --color-warning: #ff7d00; --color-danger: #f53f3f;
  /* 形 / 间距 / 阴影 */
  --radius: 8px; --radius-sm: 6px;
  --shadow-card: 0 1px 2px rgba(0,0,0,.04), 0 2px 8px rgba(0,0,0,.03);
  --shadow-hover: 0 4px 16px rgba(0,0,0,.08);
  --space: 16px;
  /* 字体 — Chinese-first,数字等宽 */
  --font-sans: -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
}
```

覆盖现有 `:root` 的 `font-family`(去 Inter 优先,Chinese-first)、`color`(→ `--color-text`)、`background`(→ `--color-bg-page`)。**为什么:** 令牌是百炼/Ant 体系的根,且 shell 与看板共享须全局;Fira/通用蓝不适合中文阿里云控制台。

### 决策 2:console-shell 对齐百炼(视觉,不动布局/滚动)

- **topbar**:白底、底部 1px `--color-border`、轻阴影;品牌字重提升;顶部导航项 hover/active 用 `--color-primary` + 浅底;操作区与用户 chip 规范化(chip 用浅灰底圆角)。高度仍 `--shell-topbar-height`。
- **sidebar**:`--color-bg-card` 或极浅灰;分组标题 `--color-text-secondary` 小字;导航项 hover `--color-bg-hover`、**选中态主色文字 + `--color-primary-bg` 底 + 左侧主色饰条**;可折叠子菜单 chevron 与缩进沿用,改令牌色。`overflow-y:auto` 局部滚动结构不动。
- **utility rail**:图标按钮令牌化 hover/focus。
- **严格保留**:`.console-shell` 的 grid/height/overflow、topbar sticky、sidebar 与 content 的局部滚动、section flex 分布。仅改颜色/间距/字体/状态类。

### 决策 3:舆情看板对齐百炼

同前一轮设计:KPI 磁贴(标签 + 大号 `tabular-nums` 数字 + 趋势小标 + 轻描边 SVG 图标 + hover 抬升)、卡片 chrome(标题栏 + `近 7 天` pill + 令牌边框/阴影/圆角)、`PO_CHART_THEME` 统一 recharts(主色 + 分类色板 `#1677FF #00B42A #FF7D00 #F53F3F #722ED1 #14C9C9` + 网格/轴/tooltip)、情感 5 模态语义色(正面 `#00B42A` → 负面 `#F53F3F`)。`.po-*` 颜色改引用全局令牌。

### 决策 4:状态、交互、响应式、无障碍

- 骨架令牌灰阶、同卡圆角/尺寸,无布局跳变;`prefers-reduced-motion` 关位移/shimmer。
- 空态描边图标 + 淡文案;错态 `--color-danger` + 重试可达。
- 可点 `cursor:pointer`;hover/focus 反馈;过渡 150–300ms;正文对比度 ≥ 4.5:1(标题/正文用 `--color-title`/`--color-text`)。
- 响应式:KPI 4→2→1 列(1024/768);看板图表网格 ≤1080 单列;shell 响应式不变(本次不引入 mobile shell)。

## Risks / Trade-offs

- **[shell 视觉改动误伤滚动契约]** → 只改颜色/间距/字体/状态类,**不碰** grid/height/overflow/sticky;依赖既有 `console-shell-scroll` 测试守护,改后必须仍通过。
- **[全局令牌影响其它页面观感]** → 这是预期收益(全站统一);但翻译/日报内容区可能出现新旧混搭,本次接受(内容区精修留后续),确保不破相、可读。
- **[字体栈改动]** → 用系统字体(PingFang SC/Microsoft YaHei 已在系统),不外链 webfont,零额外加载;移除 Inter 优先以中文优先。
- **[recharts 主题散落]** → 抽 `PO_CHART_THEME` 常量集中。

## Migration Plan

纯视觉增量,可直接上线。回滚 = 还原 `:root` 令牌与样式段、组件 className/主题 props。无数据/接口/路由/布局结构变更。落地顺序:① `:root` 令牌 → ② shell(topbar/sidebar/rail)→ ③ 看板(KPI/卡片/图表/状态)→ ④ 测试(含守护 shell 滚动测试)+ 人工 viewport 校验(1440/1024/768)。

## Open Questions

- 翻译/日报内容区是否本次精修(默认否,后续逐页)。
- KPI 趋势小标数据源:payload 暂无"环比"字段,v1 可省略或静态占位,待接口补充再启用。
