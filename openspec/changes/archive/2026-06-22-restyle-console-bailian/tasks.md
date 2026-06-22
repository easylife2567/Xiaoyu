## 1. 应用级设计令牌

- [x] 1.1 在 [globals.css](../../../apps/web/app/globals.css) `:root` 新增设计令牌(主色 `#1677ff` 家族、中性阶、页面/卡片/hover 底、边框/分隔、语义色、圆角、阴影、间距、Chinese-first `--font-sans`),按 design 决策 1
- [x] 1.2 覆盖 `:root` 既有 `font-family`(Chinese-first,去 Inter 优先)、`color`→`--color-text`、`background`→`--color-bg-page`;保留 `--shell-*` 几何变量

## 2. console-shell 对齐百炼(视觉,不动布局/滚动)

- [x] 2.1 topbar:白底 + 底边框 + 轻阴影;品牌、顶部导航 hover/active(主色)、操作区与用户 chip 令牌化
- [x] 2.2 sidebar:分组标题、导航项 hover(`--color-bg-hover`);**选中态 = 主色文字 + `--color-primary-bg` 底 + 左侧主色饰条**;可折叠子菜单 chevron/缩进改令牌色
- [x] 2.3 utility rail 图标按钮 hover/focus 令牌化
- [x] 2.4 **核对未改动** `.console-shell` grid/height/overflow、topbar sticky、sidebar/content 局部滚动、section flex —— 仅改颜色/间距/字体/状态类

## 3. 舆情看板对齐百炼

- [x] 3.1 `.po-kpi-card`:标签 + 大号 `tabular-nums` 数字 + 轻描边 SVG 图标 + hover 抬升;引用令牌
- [x] 3.2 `.po-panel` / `.po-panel-head`:令牌边框/圆角/阴影、标题样式、`近 7 天` pill(`--color-primary-bg`)、hover 反馈
- [x] 3.3 抽 `PO_CHART_THEME` 常量(主色 + 分类色板 + 网格/轴/tooltip),各 recharts 图表引用;折线/填充/网格/轴/tooltip 统一
- [x] 3.4 情感 5 模态保留语义色序(正面绿→负面红);`.po-*` 颜色全部改引用全局令牌

## 4. 状态 / 交互 / 响应式

- [x] 4.1 骨架令牌灰阶、同卡圆角尺寸、无跳变;`prefers-reduced-motion` 关位移/shimmer
- [x] 4.2 空态(描边图标+淡文案)、错态(`--color-danger`+重试)统一
- [x] 4.3 可点 `cursor:pointer`、过渡 150–300ms、focus 可见;正文对比度 ≥ 4.5:1
- [x] 4.4 KPI 4→2→1 列(1024/768)、看板图表 ≤1080 单列;shell 局部滚动保持

## 5. 测试与验证

- [x] 5.1 结构测试:断言 shell 与看板令牌类名、`PO_CHART_THEME` 常量;沿用 SSR 范式
- [x] 5.2 **守护测试**:`console-shell-scroll` 与 `workbench-shell` 测试必须仍通过(证明滚动/导航契约未破)
- [x] 5.3 全量 `npm test` 无回归;数据层测试不变
- [x] 5.4 人工 viewport 校验(1440/1024/768):shell + 看板百炼观感、选中态、滚动持久、状态
- [x] 5.5 `openspec validate restyle-console-bailian --strict`
- [x] 5.6 自检:数据/路由/布局/滚动未改;非目标(暗色/新模块/日期选择器/工作台内容重做)未夹带
