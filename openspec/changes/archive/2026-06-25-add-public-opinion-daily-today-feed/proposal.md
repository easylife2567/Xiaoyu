## Why

「每日舆情」侧边栏分组已有两个页面分别承担「看势(`/public-opinion/daily/trends`)」与「看情(`/public-opinion/daily/polarity`)」,但研究员仍缺一个「**看料**」入口——一个去聚合、去分析、按时间倒序铺出"今天到底冒出来了哪些原始条目"的全平台信息流。

旧系统(参见用户提供的 v1.0「今日舆情」截图)在这条路径上有四处明显不足:

1. **筛选弱**:只能选 6/12/24h 三档时间,平台筛选要从环图上点(隐式、不可组合),关键词搜索缺位;
2. **图表抢戏**:环图 + 折线在"原始流"页占顶部 1/3,但研究员真正想看的列表被挤到下方;
3. **密度低**:每条占 5–6 行,24h 全量翻页才能看完,违背"扫料"初衷;
4. **跨语种判读缺失**:监测词常跨语种命中(`#Peking / #ペキン / #Пекин`),但抽屉/译文都没有,研究员要看懂一条外文必须新窗口跳 Google 翻译。

本提案在 `/public-opinion/daily/today` 新建一页「每日舆情」原始流总入口,定位与既有两页明确互补:trends 看势、polarity 看情、today 看料。视觉与交互对齐既有 v3 控制台范式(densified tokens、ruled section、KPI rail 心智),并复用 polarity 的"行级勾选 + CSV 导出"肌肉记忆。

MVP 阶段监测词与译文走 Mock,与已有的 `Mock Payload Module`(`82d73a2`)对齐,不触动真实采集器与 AI 翻译链路。

## What Changes

- **新增路由** `/public-opinion/daily/today`,顶层语义 = 「监测词驱动的 24h 原始信息流」;「舆情速览 / 每日舆情」分组下已存在的「每日舆情」占位条目(见 `public-opinion-overview` 既有 spec)SHALL 升级为本路由的真实内容,**导航结构不变**——仍为「正负面舆情 → 每日舆情 → 趋势与占比」三子项。
- **顶部固定区**:监测词下拉(Mock 5–6 个,含跨语种命中) + 时间档 chip(6h/12h/24h) + 平台多选 chip(每个 chip 后挂当前过滤下的条数) + 关键词搜索框 + 「更多筛选 ▾」(MVP 只放情感三档) + 「⬇ 导出」按钮 + 手动刷新按钮 + 总条数。
- **顶部迷你直方图**:24 根固定柱,高度 60–80px,hover 显示 `HH:00–HH:00, N 条` tooltip,**点击柱子流跳到对应时段起始条目且高亮当前柱锚点**;6h/12h 档下每根柱代表 15min/30min。
- **中部信息流**:虚拟滚动(`@tanstack/react-virtual`),**一次性加载全量(最多 5000 条)**,前端 filter/search 零延迟;行高 32–36px,单行布局:`checkbox + 平台徽 + 时间 HH:mm + 作者句柄 + 单行截断正文(命中词内联高亮 + 外文加"译"角标) + 情感色点(● 红/○ 灰/● 绿,阈值与 polarity 一致 -0.3/+0.3)`;**默认按发布时间倒序、不提供其他排序**;点击行(非 checkbox)打开右侧抽屉。
- **右侧抽屉** `FeedItemDrawer`(360px,可全屏):全文 + 元数据 + 命中词高亮 + 跳原文 + Mock 译文 + 互动数 + 抽屉内勾选(与列表 checkbox 双向同步)。
- **新数据轮询**:`/api/public-opinion/daily-today/count` 90s 心跳,新增 > 0 时顶部出现 `↑ N 条新条目 [点击加载]` 横条;点击后新条目灌入流顶,**视口不跳**,前 N 条左侧短彩竖线 5s 后淡出;**tab 失焦暂停轮询,focus 回来立即拉一次**;轮询连续 3 次失败弹一次"自动刷新已暂停"提示。
- **导出**:CSV,复用 polarity 同款导出范式,字段列与 polarity 对齐 + 译文列;勾选 0 条时按钮显示 `导出全部 (N)`,否则显示 `导出 (M/N)`。
- **Mock 监测词数据**:扩展现有 Mock Payload Module,新增参数 `keyword`(按词分桶)、`includeTranslation`(外文条目附 `translation.zh`);初始 5–6 个监测词,至少一个跨语种(覆盖 zh/en/ja/ru)。

## Capabilities

### Added Capabilities

- **`public-opinion-daily-today`**:监测词驱动的全平台 24h 原始信息流视图;承担「看料」职责,与 `public-opinion-dashboard`(看势)、`public-opinion-daily-polarity`(看情)在「每日舆情」分组下形成三足鼎立。

### Modified Capabilities

- **`public-opinion-overview`**:既有「舆情速览 / 每日舆情 / 每日舆情」占位条目 SHALL 升级为指向 `/public-opinion/daily/today` 的真实内容页;**导航结构、路由 slug、占位契约范畴 SHALL 保持不变**(仅是占位 → 真实内容的状态切换,与现有 spec 第三条 Requirement 中"占位页路由在后续填充真实内容时保持不变"的约定一致)。

## Impact

- **新增页面** `apps/web/app/public-opinion/daily/today/page.jsx`(MVP 形态:Server Component 拉初始数据 + Client Component 接管交互)。
- **新增 API 路由**:
  - `apps/web/app/api/public-opinion/daily-today/route.ts` — `GET ?keyword=&hours=` 返回全量 payload(`histogram + platforms + items`)。
  - `apps/web/app/api/public-opinion/daily-today/count/route.ts` — `GET ?keyword=&hours=&since=` 返回 `{ newCount }`。
  - `apps/web/app/api/public-opinion/daily-today/export/route.ts` — `POST { keyword, hours, itemIds? }` 流式返回 CSV。
- **新增组件**(`apps/web/components/public-opinion-daily-today/`):
  - `daily-today-page.jsx` — 客户端入口,承载状态与 effects。
  - `daily-today-filter-bar.jsx` — 监测词 + 时间档 + 平台 chip + 搜索 + 更多筛选 + 导出按钮。
  - `daily-today-histogram-strip.jsx` — 24 根柱 + hover tooltip + 点击 scrollTo。
  - `daily-today-feed.jsx` — 虚拟滚动容器(`@tanstack/react-virtual`)。
  - `daily-today-feed-row.jsx` — 单行渲染。
  - `daily-today-drawer.jsx` — 右侧抽屉。
  - `daily-today-new-items-banner.jsx` — 顶部 `↑ N 条新条目` 横条。
- **新增 lib**(`apps/web/lib/public-opinion/daily-today/`):
  - `mock-payload.ts` — 调用现有 Mock Payload Module + 监测词分桶 + 译文预填。
  - `keywords.ts` — Mock 监测词清单(5–6 个,含跨语种命中元数据)。
  - `csv-export.ts` — 复用 polarity 导出范式,扩展译文列。
- **新增依赖**:`@tanstack/react-virtual`(虚拟滚动);其余沿用既有栈。
- **新增守护测试** `apps/web/tests/public-opinion-daily-today.test.js`:
  - 组件结构断言(filter-bar/histogram-strip/feed/drawer/banner 五件套均存在);
  - 默认排序为时间倒序;
  - 行高 32–36px 范围内;
  - 监测词切换触发全量重载;
  - 虚拟滚动只挂当前视口 + 缓冲行(DOM 节点数 < 80);
  - 平台 chip / 搜索框为前端 filter(切换后无 fetch);
  - 直方图点击调用 `scrollToIndex` 并保留高亮锚点;
  - 抽屉勾选与列表 checkbox 双向同步;
  - 新数据横条:Mock 增量出现时 banner 出现且点击灌入流顶不跳视口;
  - tab 失焦暂停轮询(`document.visibilityState = "hidden"` 期间不 fetch)。
- **不影响**:
  - `public-opinion-dashboard`、`public-opinion-daily-polarity` 页面与契约;
  - 真实采集器、AI 翻译、BFF 接入;
  - 既有 v3 控制台范式与 5 模态情感色板;
  - 国际日报、大翻译数据处理链路;
  - 暗色模式(超出本次范围)。

## Open Questions

- **监测词切换是否走 URL 查询参数?**(`?keyword=peking`)→ 建议是,刷新可保留状态,且支持分享深链;tasks 1.x 落实。
- **直方图 hover tooltip 在 6h 档下显示`HH:mm–HH:mm 15min` 还是`HH:mm–HH:mm` 即可?**→ 建议后者(避免冗余),tasks 4.x 实测。
- **「更多筛选」是抽屉还是 popover?**→ MVP 阶段只放情感三档,用 popover 即可;字段增多再升抽屉。
- **5000 条上限触达时的具体文案?**→ "当前监测词在所选时间档下条目超过 5000,仅显示最新 5000 条;建议收窄时间档或加平台过滤";最终文案在 tasks 7.x 定稿。
- **轮询心跳 90s 是否暴露为 env 常量?**→ 建议是,`NEXT_PUBLIC_DAILY_TODAY_POLL_MS=90000`,便于演示与排错;tasks 6.x 落实。
- **CSV 列与 polarity 完全对齐 + 额外加译文列,字段名是 `translation_zh` 还是 `body_zh`?**→ 建议 `translation_zh`(语义明确,polarity 无此列时为空),tasks 5.x 定。
