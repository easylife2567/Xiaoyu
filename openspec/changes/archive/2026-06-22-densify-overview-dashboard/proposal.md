## Why

舆情总览看板信息密度仍偏低 —— 10 个模块靠两列粗栅格 + 下滑承载,单屏只能看到 4–5 个模块,缺乏"控制台一眼概览"的力量感。参考用户提供的 HR Attrition 看板,密度极高、单屏全显,关键在于一组具体的"信息惯用语":紧凑 KPI 条、小环 + 标签、双 chip 双值排行、真热力矩阵、直方图均值线、卡片流。

本次借鉴这些惯用语**重构舆情总览的栅格与模块呈现**,沿用 [restyle-console-bailian](../archive/) 已落地的百炼色板与令牌(蓝主色 + 5 模态语义色),不动数据接入、模块构成、shell 与 OpenSpec 已固化的视觉/滚动契约。

## What Changes

- **栅格升级**:从 2 列粗栅格 → **12 列自由组合**(参考图同款),每模块按内容占合理列数;1440 屏单屏可见前 6–7 模块,后续少量下滑。
- **KPI 卡紧凑化**:大磁贴(min-height ~88px,3 行)→ 横向紧凑条(左小图标 + 大号数字 + 极小标签,~52px 高),3 张并排只占顶栏一条。
- **情感分布:5 小环并排**:废弃单大环形饼 → 5 个微环 + 数字标签(对应 5 模态),保留语义色序(正面绿→负面红)。
- **Top 排行新惯用语**:`Top 热文` 与 `媒体来源占比` 改为"序号 + 名称 + 双 chip(主指标 + 次指标)"列表(参考图 Job Role / Education 同款);双 chip 颜色用百炼主色浅底 + 中性深底以区分高亮/底数。
- **媒体×情感矩阵改真热力图**:堆叠条 → 行(平台)× 列(5 模态)的色块网格,格内数字 + 背景深浅按值,深色块自然标极值(参考图 Survey Score 同款)。
- **趋势加均值线**:`本周趋势` 与 `今日分时趋势` 加 `Avg N` 横虚线,直观指认极值天/时。
- **最新舆情卡片流密度提升**:行间距、字号、meta 行密度仿照参考图 Recent Attrition 卡。
- 仍**只动视觉/呈现**:数据接入、归一化、BFF、模块构成、shell、滚动契约**完全不动**。

## Capabilities

### Modified Capabilities

- `public-opinion-dashboard`:看板视觉模块惯用语扩展 —— 紧凑 KPI 条、小环 + 数字并排、双 chip 排行、真热力矩阵、均值线趋势、密度化卡片流。沿用既有令牌与情感语义色。

## Impact

- 影响 [apps/web/components/public-opinion-overview-dashboard.jsx](../../../apps/web/components/public-opinion-overview-dashboard.jsx):重构 KPI 卡 + 情感分布 + Top 排行 + 媒体×情感矩阵 + 趋势(均值线)+ 信息流 的呈现;不动 fetch / 状态 / 模块构成。
- 影响 [apps/web/app/globals.css](../../../apps/web/app/globals.css):新增 `.po-grid-12`(12 列)、`.po-kpi-compact`、`.po-mini-donut`、`.po-rank-row`、`.po-heatmap` 等样式段;复用既有 `--color-*` 令牌。
- 更新 [apps/web/tests/public-opinion-bailian-restyle.test.js](../../../apps/web/tests/) 或新增 densify 守护测试(矩阵改真热力、KPI 紧凑、5 小环、12 列栅格)。
- **不影响**:数据层、BFF、鉴权、shell、其它页面、模块构成。
- **非目标**:暗色模式;新数据维度;日期选择器;再加新接口模块。

## Open Questions

- 矩阵深浅色阶用蓝色单色阶 vs 情感语义色阶?默认**蓝色单色阶**(可读性优、不与情感色冲突;格内数字本身已暗示量级),情感语义色仅用于"情感分布 5 小环"。如要语义色阶请告知。
