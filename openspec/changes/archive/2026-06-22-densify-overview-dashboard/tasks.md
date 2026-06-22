## 1. 依赖与 d3 抽象

- [x] 1.1 `npm --workspace apps/web i d3-scale d3-scale-chromatic d3-shape d3-array d3-interpolate`(按需子包,不装整个 d3)
- [x] 1.2 新增 `apps/web/src/public-opinion/d3-utils.js`:导出 `blueScale(maxValue)`、`donutArcPath({value, total, size})`、`useCountUp(target, ms)` hook;集中 d3 使用面,React 接管渲染

## 2. 12 列栅格 + KPI 紧凑条

- [x] 2.1 [globals.css](../../../apps/web/app/globals.css) 新增 `.po-grid-12`(12 列,gap=var(--space))+ `[data-span]` 属性选择器驱动各模块占列;响应式断点(>1280 / 1080–1280 / ≤1080)
- [x] 2.2 重做 `.po-kpi-card` 为水平紧凑条(左图标 + 右上大号数字 + 右下小标签),高度 ~56px;一行 3 张 KPI 占 span 12
- [x] 2.3 KPI 数字用 `useCountUp` 入场动画(0 → target,~800ms easeOutCubic);`prefers-reduced-motion` 下瞬时显示
- [x] 2.4 [public-opinion-overview-dashboard.jsx](../../../apps/web/components/public-opinion-overview-dashboard.jsx) 外层 `.po-grid` 改 `.po-grid-12`,各 panel 加 `data-span`

## 3. 情感分布 5 小环并排(d3 自定义)

- [x] 3.1 新增 `MiniDonut` 组件:用 `d3-shape.arc` 绘 SVG 路径(54×54,corner/pad 自定义);弧 + 中央 `useCountUp` 数值
- [x] 3.2 替换 PieChart 情感分布;5 环横向排列,使用 5 模态语义色;`stroke-dasharray` 弧线绘制动画 ~600ms
- [x] 3.3 ≤1080 改 2×3 网格,环本身不缩

## 4. 双 chip 排行 + 内嵌 mini bar

- [x] 4.1 归一化层 `getMediaShare` 派生 `share`(% 占比);`getTopHotNews` 派生 `share` — 纯派生不改后端
- [x] 4.2 新增 `.po-rank-row` 样式:序号 + 名称 + 主 chip(主色浅底 + 主色文字 + 内嵌宽度=share% 的 mini bar)+ 次 chip(中性深底 + 白文字)
- [x] 4.3 媒体来源占比 / Top 热文 模块改用排行行;每行 4 列 span

## 5. 真热力矩阵(d3 蓝单色阶)

- [x] 5.1 新增 `.po-heatmap`:CSS Grid 行 = 平台、列 = 5 模态;格背景用 `blueScale` 生成的颜色,字色随 opacity 自适应
- [x] 5.2 替换原媒体×情感堆叠条;wide 跨整行;格 hover 放大 + 描边 + tooltip,Tab 可达
- [x] 5.3 本周趋势 / 今日分时趋势 加 recharts `<ReferenceLine y=avg>` + 标注 `Avg N`

## 6. 信息流密度提升

- [x] 6.1 `.po-feed` 行高、字号、meta 行间距按参考图密度调小;风险 tag 不变
- [x] 6.2 max-height 适配 12 列栅格,跨整行

## 7. 入场与无障碍

- [x] 7.1 卡片 stagger fade-in + translateY,统一 `transition` 与 `@media (prefers-reduced-motion: reduce)` 降级
- [x] 7.2 所有交互元素 `cursor:pointer`、focus-visible 可见、对比度 ≥ 4.5:1

## 8. 测试与验证

- [x] 8.1 守护测试:`.po-grid-12` / `.po-kpi-compact` / `MiniDonut`×5 / `.po-heatmap` / `ReferenceLine` / d3-utils export 全部存在;`PO_CHART_THEME` 仍引用令牌
- [x] 8.2 全量 `npm test` 无回归;`npm run build` 通过(d3 子包 SSR 友好,无 window 依赖)
- [x] 8.3 人工 viewport 校验(1440 / 1280 / 1080 / 768):密度提升、单屏前 6 模块、塌列正确、动画顺畅
- [x] 8.4 `openspec validate densify-overview-dashboard --strict`
- [x] 8.5 自检:数据/接入/BFF/shell/模块构成未改;非目标(暗色/新模块/日期选择器)未夹带
