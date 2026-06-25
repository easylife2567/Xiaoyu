## 1. Mock 监测词与数据生成器

- [x] 1.1 新建 `apps/web/lib/public-opinion/daily-today/keywords.ts`,导出 `MOCK_KEYWORDS: KeywordMeta[]`,包含 6 条:`peking`、`belt-and-road`、`qian-xuesen`、`ai-safety`、`semiconductor-sanctions`、`carbon-neutrality`;每条含 `{ id, displayName, aliases: string[], languages: ('zh'|'en'|'ja'|'ru')[] }`
- [x] 1.2 扩展现有 Mock Payload Module(`apps/web/lib/public-opinion/mock-payload.ts` 或同名位置,参见 `82d73a2`):新增参数 `keyword: string` 与 `includeTranslation: boolean`
- [x] 1.3 当 `includeTranslation=true` 时,为 `body.language !== 'zh'` 的条目附 `translation: { zh: string }`;译文用确定性 Mock 生成(基于条目 id 取自固定语料表)
- [x] 1.4 输出条目按 `keyword.aliases` 在 body 中实际出现至少一次,以支持命中词高亮的真实匹配
- [x] 1.5 添加单元测试 `apps/web/tests/daily-today-mock-payload.test.js`:6 个监测词各自生成 24h payload,断言 items.length ∈ [50, 5000]、histogram.length===24、外文条目均含 translation.zh、命中词在 body 中实际存在

## 2. API 路由(三件套)

- [x] 2.1 新建 `apps/web/app/api/public-opinion/daily-today/route.ts`(GET):接受 `keyword`、`hours`(6|12|24,默认 24);调用 Mock 生成器,返回 `{ keyword, hours, generatedAt, histogram, platforms, items }`
- [x] 2.2 `platforms` 数组的 count SHALL 按当前 `items`(未做平台过滤)分组统计;color 沿用 v3 平台色板令牌
- [x] 2.3 新建 `apps/web/app/api/public-opinion/daily-today/count/route.ts`(GET):接受 `keyword`、`hours`、`since: ISO`;在 Mock 模式下用确定性公式生成增量数(如每 90s 增 8–20 条),返回 `{ newCount: number }`
- [x] 2.4 新建 `apps/web/app/api/public-opinion/daily-today/export/route.ts`(POST):接受 `{ keyword, hours, itemIds?: string[] }`;`itemIds` 为空数组或缺省 → 导出全部
- [x] 2.5 导出 CSV 列序固定:`id,platform,publishedAt,author_handle,author_display_name,body,translation_zh,sentiment,polarity,reposts,likes,replies,source_url,matched_keyword`;CSV 用流式 `Response`(`new Response(stream)`)
- [x] 2.6 三个路由均添加 `NEXT_PUBLIC_PUBLIC_OPINION_MOCK=true` 时返回 Mock,false 时返回 501 + `{ error: 'real-data-source-not-connected' }`(MVP 阶段始终 Mock)
- [x] 2.7 添加路由测试 `apps/web/tests/daily-today-api.test.js`:三个路由的正常返回 / 边界(0 条、5000 条上限、未知 keyword、非法 hours)

## 3. 页面骨架与组件文件

- [x] 3.1 新建 `apps/web/app/public-opinion/daily/today/page.jsx`(Server Component):接受 URL `?keyword=&hours=`,默认值 `keyword=peking&hours=24`;SSR 拉一次初始 payload 注入 client 入口
- [x] 3.2 新建 `apps/web/components/public-opinion-daily-today/daily-today-page.jsx`(Client Component):承载 state(`keyword, hours, platformFilter, polarityFilter, searchQuery, items, histogram, selectedIds, drawerOpenId, lastGeneratedAt, newCount`)与 effects(轮询 + visibilitychange)
- [x] 3.3 新建空壳:`daily-today-filter-bar.jsx`、`daily-today-histogram-strip.jsx`、`daily-today-feed.jsx`、`daily-today-feed-row.jsx`、`daily-today-drawer.jsx`、`daily-today-new-items-banner.jsx`;各导出默认组件
- [x] 3.4 验证 `apps/web/components/public-opinion-overview` 既有侧边栏数据源:「舆情速览 / 每日舆情」分组的三个子项(「正负面舆情」「每日舆情」「趋势与占比」)中,「每日舆情」当前应是占位页;本 change 将其路由从占位 slug 切换为 `/public-opinion/daily/today` 的真实内容,**不新增子项也不重排顺序**
- [x] 3.5 新增 CSS 文件 `apps/web/app/public-opinion/daily/today/daily-today.css`(或在 `globals.css` 注入 `--daily-today-*` 令牌);引入 row-height/aside-width/histogram-height/fresh-stripe 四个令牌
- [x] 3.6 验证页面在 `npm run dev` 下能渲染出"骨架"(尚无数据交互),`/public-opinion/daily/today?keyword=peking&hours=24` 可访问

## 4. 顶部筛选条 + 直方图(交互)

- [x] 4.1 `daily-today-filter-bar.jsx`:第 1 行渲染监测词下拉(`MOCK_KEYWORDS` 选项)、时间档 chip(6h/12h/24h)、手动刷新按钮、总条数;切换监测词或时间档 → 推 URL 查询参数 + 触发新 fetch
- [x] 4.2 第 2 行渲染平台 chip:多选 toggle,空选 = 全部,点击"全部" chip = 清空;每个 chip 后挂 facet count(facet = 除去自己以外其他过滤后的条数)
- [x] 4.3 第 3 行渲染搜索框(80ms debounce,匹配 `body|translation.zh|author.handle|author.displayName`,大小写无关)、「更多筛选 ▾」popover(MVP 只放情感三档多选)、「⬇ 导出 (M/N)」按钮
- [x] 4.4 `daily-today-histogram-strip.jsx`:24 根 div 渲染柱(高 = `count / max * 56px`,最小 2px),hover 显示 tooltip `HH:00–HH:00, N 条`;6h/12h 档下 tooltip 改 `HH:mm–HH:mm`
- [x] 4.5 直方图点击柱子:调用父组件传入的 `onScrollToBucket(bucketIndex)` 回调;父组件用 `react-virtual` 的 `scrollToIndex(firstItemIndexInBucket)`;当前视口锚定的柱子加 `data-active="true"` 高亮(滚动时通过 `visibleRange` 反推 bucket)
- [x] 4.6 facet counts 与 histogram 在同一个 `useMemo` 内一次性算出,避免双遍历;严格按 `[items, platformFilter, polarityFilter, searchQuery]` 依赖

## 5. 信息流与抽屉

- [x] 5.1 `daily-today-feed.jsx`:引入 `@tanstack/react-virtual`(`npm i @tanstack/react-virtual`);`useVirtualizer({ count: filteredItems.length, getScrollElement, estimateSize: () => 34, overscan: 8 })`
- [x] 5.2 `daily-today-feed-row.jsx`:渲染一行,从左到右 checkbox / 平台徽 / 时间 HH:mm / 作者句柄 / 单行截断 body(`text-overflow: ellipsis`) / 情感色点;命中词用 `<mark>` 包裹(基于 `keyword.aliases` 用 `indexOf` 拼接,**不用正则**)
- [x] 5.3 外文条目(`item.body` 语言非 zh)在 body 末尾加 `<sup>译</sup>` 角标;hover 整行 → 浅灰底色
- [x] 5.4 行点击(除 checkbox 区)→ 调用 `onOpenDrawer(item.id)` → 父组件 setState `drawerOpenId`
- [x] 5.5 checkbox 独立点击 → 切换 `selectedIds` Set 中的 id;不打开抽屉
- [x] 5.6 新条目标记:`item.isFresh === true` 时左侧 4px 短竖线(`background: var(--daily-today-fresh-stripe)`),组件 mount 后 5s 触发 `isFresh = false`(在父组件 setTimeout 控制)
- [x] 5.7 `daily-today-drawer.jsx`:固定 360px 宽,从右滑入(transform translateX,240ms ease-out);portal 到 `document.body`;ESC 关闭、点击遮罩关闭、按 ⤢ 切换全屏(占视口 80%)
- [x] 5.8 抽屉内容按 D5:平台/作者/时间/情感分/全文(命中词高亮)/译文(disabled 重新翻译按钮)/互动数/↗ 查看原文/✓ 加入勾选
- [x] 5.9 抽屉内"✓ 加入勾选"与列表 checkbox 双向同步(读写同一份 `selectedIds`)

## 6. 实时轮询与新数据横条

- [x] 6.1 `daily-today-page.jsx` 内 `useEffect` 启动 `/count` 轮询:`setInterval` 周期为 `process.env.NEXT_PUBLIC_DAILY_TODAY_POLL_MS || 90000`,fetch 时携带 `since=lastGeneratedAt`
- [x] 6.2 `newCount > 0` 时 set 到 state;`daily-today-new-items-banner.jsx` 顶部固定渲染 `↑ N 条新条目 [点击加载]`,N === 0 时隐藏
- [x] 6.3 点击横条 → fetch `/api/public-opinion/daily-today?keyword=&hours=&since=<lastGeneratedAt>`(扩展支持 since 增量,或重拉全量取最新前 N);新条目 unshift 到 items,设 `isFresh=true`;更新 `lastGeneratedAt`
- [x] 6.4 视口锁定:加载前记录 `scrollTop`,加载后 `scrollToOffset(prevScrollTop + insertedRowsHeight)`(用 `useLayoutEffect` 同步执行);防止虚拟滚动重新计算时跳到顶
- [x] 6.5 visibilitychange 监听:`hidden` → `clearInterval` 暂停轮询;`visible` → 立即 `/count` 一次并 `setInterval` 重启
- [x] 6.6 `/count` 连续 3 次失败 → toast "自动刷新已暂停,请手动刷新" + 停止 interval,直到用户点击页面顶部手动刷新按钮恢复
- [x] 6.7 手动刷新按钮 → 立即重拉全量 payload,重置 lastGeneratedAt 与失败计数

## 7. 导出 + 极端边界态

- [x] 7.1 导出按钮文案:`selectedIds.size === 0` → `⬇ 导出全部 (filteredItems.length)`;否则 `⬇ 导出 (selectedIds.size/filteredItems.length)`
- [x] 7.2 点击导出 → POST `/api/public-opinion/daily-today/export` body `{ keyword, hours, itemIds: Array.from(selectedIds) }`(空 set 不传 itemIds);浏览器下载 `daily-today-<keyword>-<yyyyMMdd-HHmm>.csv`
- [x] 7.3 0 条结果空态:filteredItems.length === 0 时,流区域显示 "当前筛选下没有条目" + 一键 [清空筛选] 按钮(重置 platform/polarity/search)
- [x] 7.4 5000+ 条上限:API 返回最多 5000 条;UI 顶部信息条提示 "结果超过 5000 条,仅显示最新 5000 条,建议收窄时间档或加平台过滤"(`payload.truncated === true` 时显示)
- [x] 7.5 拉取失败:filter-bar 区域显示 "数据加载失败 [重试]";保留上次成功的 items 不清空

## 8. 测试与守护

- [x] 8.1 新增 `apps/web/tests/public-opinion-daily-today.test.js`:
  - 页面组件源含 `<DailyTodayFilterBar` / `<DailyTodayHistogramStrip` / `<DailyTodayFeed` / `<DailyTodayDrawer` / `<DailyTodayNewItemsBanner` 五件套
  - 行组件源含 `[data-row-height]` 或 CSS 内 `--daily-today-row-height` 在 32–36px
  - 默认排序逻辑断言:`items.sort((a,b) => b.publishedAt.localeCompare(a.publishedAt))` 或等价表达式存在
  - 切监测词 / 时间档触发新 fetch(jsdom 模拟 fetch 调用次数)
  - 切平台 chip / 搜索 → fetch 调用次数不变(纯前端 filter)
  - 直方图点击触发 `scrollToIndex`(spy 调用次数)
  - 抽屉勾选按钮与列表 checkbox 双向同步(模拟点击两侧、断言同一 selectedIds)
  - 新数据横条:Mock `/count` 返回 17 → banner 显示 17;点击 banner → fetch 调用 + scrollOffset 补偿
  - tab 失焦:`document.visibilityState = 'hidden'` 期间清空 interval(spy clearInterval)
- [x] 8.2 Mock 守护测试:`daily-today-mock-payload.test.js` 与 `daily-today-api.test.js` 全绿
- [x] 8.3 既有守护测试不回归:
  - `public-opinion-control-room-v3.test.js`
  - `public-opinion-daily-polarity.test.js`(如存在)
  - `public-opinion-sticky-feed-v2.test.js`
  - `public-opinion-densify.test.js`
  - `public-opinion-bailian-restyle.test.js`
- [x] 8.4 `npm run build` 通过;SSR 友好(daily-today-page client component,page.jsx 是 server component 仅做 SSR 初始 fetch + 注入 props)
- [x] 8.5 1440 / 1280 / 1024 viewport 实测:
  - 1440:抽屉打开时主流区 ≥ 1000px,行能看完整
  - 1280:抽屉打开时主流区 ≥ 800px,可触发 ⤢ 全屏
  - 1024:依沿用 ConsoleShell 既有断点(本页 MVP 不专门适配,但不能崩)
- [x] 8.6 reduced-motion:抽屉滑入/横条淡入/新条目竖线淡出均跳过过渡(`@media (prefers-reduced-motion: reduce)`)
- [x] 8.7 `openspec validate add-public-opinion-daily-today-feed --strict`

## 9. 文档与归档

- [x] 9.1 在 `apps/web/lib/public-opinion/daily-today/README.md` 写 Mock 数据结构 + 监测词清单 + 译文来源
- [x] 9.2 主 README.md 「已实现功能」表格新增一行:`每日舆情 | 监测词驱动的 24h 原始信息流 + 虚拟滚动 + 抽屉 + CSV 导出 | 已完成`(待真实采集器接入后再升级文案)
- [x] 9.3 截图归档:1440 viewport 下三态(默认 / 抽屉打开 / 新数据横条)截图存 `docs/images/`,PR 描述引用
- [x] 9.4 commit message 范式:`feat(public-opinion): daily-today 「每日舆情」原始流总入口 — 监测词驱动 / 虚拟滚动 / 抽屉 / CSV 导出`
- [x] 9.5 PR 描述中说明本期 Mock 范围 + 下一期(真实采集器 / 按需翻译)的接入计划

## 10. 实现前先验

- [x] 10.1 验证现有 `Mock Payload Module` 的导出接口与扩展点;若与本提案假设不一致(参数名 / 文件路径),在 design.md 的 R 章节补一条 risk 并调整 tasks 1.x
- [x] 10.2 验证 `apps/web/components/public-opinion-overview` 侧边栏的定义位置与数据源结构;若导航数据通过 `nav-items.ts` 之类的统一来源 → 改它一个文件即可;若散落在 jsx 内 → tasks 3.4 单独立一行做"提炼到统一来源"
- [x] 10.3 验证 polarity 页 CSV 导出代码路径;若已通过 `apps/web/lib/public-opinion/csv` 共享 → 本期复用;若仍是 polarity 路由内联 → 本期先内联实现,后续提案统一抽取
- [x] 10.4 验证 `@tanstack/react-virtual` 是否已在 `package.json` 中;若是新增依赖,在 tasks 5.1 中明确 `npm i` 步骤
- [x] 10.5 验证 `NEXT_PUBLIC_PUBLIC_OPINION_MOCK` 这个环境变量是否已存在;若不在则沿用既有 Mock 开关(可能叫别的名字),tasks 2.6 同步调整
