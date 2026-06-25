# Design — add-public-opinion-daily-today-feed

## Context

「每日舆情」分组下既有的两页(`daily/trends` 控制台、`daily/polarity` 三档情感)分别承担"看势"和"看情"。它们的共同特征是:**聚合 + 分析**——把当天的舆情用 KPI、堆叠图、热力矩阵、情感分布等聚合视图呈现给研究员,帮助他们形成总体判断。

但研究员日常工作里仍缺一条入口:**"今天到底冒出来了哪些原始条目?"** ——一个不聚合、不分析、按时间倒序展开的全平台原始信息流。这正是用户提供的旧系统 v1.0「今日舆情」页要解决的问题,但旧实现在筛选、密度、跨语种、加载范式上都已经过时。

ui-ux-pro-max 的 **Data-Dense Dashboard** 与 **Real-Time Monitoring** 范式正好对症:前者支持"虚拟滚动 + 高密度行 + chip 多选 + 前端 filter 零延迟",后者支持"`↑ N 条新数据`横条 + tab 失焦暂停轮询 + 新条目视觉淡入"。本次设计把这两条范式合一,做出一个**研究员可以开一上午的"原始流总入口"**。

监测词与译文走 Mock,与既有 `Mock Payload Module`(`82d73a2`)对齐,本期不动真实采集器与 AI 翻译链路。真实数据接入是下一期的工程项。

## Goals / Non-Goals

### Goals

- **G1**:在 `/public-opinion/daily/today` 落地一页"原始流总入口",和 trends/polarity 形成三足鼎立(看势/看情/看料),侧边栏顺序:趋势看板 → 每日舆情 → 正负面舆情。
- **G2**:研究员在 1080p 屏一屏能看 25+ 条,扫流体感顺畅,**筛选/搜索零延迟**,**抽屉打开不打断扫的位置感**。
- **G3**:跨语种监测场景成立——外文条目抽屉内显示 Mock 中文译文,正文有"译"角标提示。
- **G4**:实时感与稳定感兼得——新数据通过顶部横条提示,**研究员主动决定何时灌入**,视口不被打断。
- **G5**:与 polarity 范式对齐——行级勾选 + CSV 导出 + 时间倒序 + 平台 chip 多选,迁移成本最小。
- **G6**:不破坏既有 v3 控制台范式、5 模态情感色板、Mock 开关、轮询行为、reduced-motion 守护。

### Non-Goals

- **不接真实采集器、不接真实 AI 翻译**——MVP 走 Mock,采集器接入与按需翻译缓存是下一期。
- **不做相似条 / 跨平台相似条 / 备注 / 星标 / 用户偏好持久化**——这些是 v2 议题。
- **不做 XLSX / 链接清单导出**——MVP 只给 CSV,与 polarity 对齐;多格式是 v2。
- **不做 WebSocket / SSE**——MVP 用 90s 轮询;Q8/Q11 阶段已显式拒绝。
- **不做排序切换**——本页定位是"流",流没有第二种排序方式;研究员要找"最负面/最热"走 polarity / trends。
- **不做移动端适配**——研究员桌面工作台,最低 1280px。
- **不引入暗色模式**——超出本次范围。

## Decisions

### D1 路由与命名

- **决定**:新增路由 `/public-opinion/daily/today`,页面标题「每日舆情」,侧边栏「每日舆情」分组下新增同名子项。
- **理由**:
  - `daily/today` 比 `daily/feed`/`daily/stream` 更贴中文心智(用户已选);
  - 与既有 `daily/trends`、`daily/polarity` 三个兄弟路由的命名节奏一致;
  - 与 README 中「今日舆情」的旧系统术语呼应,迁移用户零认知成本。

### D2 数据范围:监测词驱动 + 全量加载

- **决定**:每次进页对应**单个监测词 × 单个时间档**的全量条目,前端一次拉取最多 5000 条,虚拟滚动渲染;监测词切换或时间档切换 → 整页 loading + 重新拉取;平台 chip / 搜索 → 纯前端 filter,零延迟。
- **数据契约**:
  ```ts
  GET /api/public-opinion/daily-today?keyword=peking&hours=24
  → {
    keyword: 'peking',
    hours: 24,
    generatedAt: string,                 // ISO UTC
    histogram: number[24],               // 24 根柱的计数(6h/12h 档下按时间均分)
    platforms: Array<{ id, name, color, count }>,
    items: FeedItem[]                    // 全量,最多 5000
  }

  GET /api/public-opinion/daily-today/count?keyword=peking&hours=24&since=<ISO>
  → { newCount: number }

  POST /api/public-opinion/daily-today/export
    body: { keyword, hours, itemIds?: string[] }    // 空数组 = 全部
  → CSV stream
  ```
- **理由**:
  - "原始流总入口"的核心体验是"扫"——分页毁体验,无限滚动直方图跳转不准、勾选状态丢失;
  - 全量 ≤ 5000 条 gzip 后通常 200–400KB,首屏 < 1.5s 可达;
  - 切监测词是低频操作(一上午几次),整页 loading 可接受;切平台 chip / 输入搜索是高频操作,必须零延迟。

### D3 列表行:32–36px 极简单行 + 命中词高亮 + 译文角标

- **决定**:单行布局,从左到右依次为 checkbox、平台徽(14px)、`HH:mm` 时间、作者句柄、单行截断正文、情感色点(8px);命中监测词的字段做内联高亮(黄底);外文条目正文末尾追加小"译"角标提示。整行 hover 高亮(浅灰底色),点击行(除 checkbox)打开抽屉;checkbox 独立勾选不打开抽屉。
- **行高**:32–36px,1080p(900px 视口高度)能看 25 条;
- **情感色点**:与 polarity 一致 ● 红=负(< -0.3)/ ○ 灰=中 / ● 绿=正(> +0.3),hover 显示精确分数。
- **新条目标记**:从顶部横条点击灌入的条目,左侧 4px 彩色短竖线,5s 后淡出。
- **理由**:Q2 用户选「极简单行 + 点击展开」,Q9 抽屉里能看完整,本页只做"扫"的密度。

### D4 顶部:筛选条 + 迷你直方图(取代旧站环图+折线)

- **决定**:顶部固定一个**筛选条 + 直方图**复合区,自上而下三行:
  - **第 1 行**:监测词下拉(左) + 时间档 chip 三选一(中) + 手动刷新按钮 + 总条数(右);
  - **第 2 行**:平台 chip 多选(挂条数),溢出时横向滚动;
  - **第 3 行(组合)**:搜索框(左) + 「更多筛选 ▾」popover(中) + 「⬇ 导出 (M/N)」按钮(右);
  - **第 4 行**:迷你直方图(24 根柱,高 64px),hover tooltip,点击 scrollTo 对应桶起始条目并保留高亮锚点。
- **理由**:旧站环图+折线在"原始流"页是噪音(分析视图,与定位冲突);迷你直方图保留了"今天体量分布的瞬时锚点"和"时段跳转"两个真正服务于扫流的功能,不抢戏。
- **取舍**:旧站环图/折线被完全替换;研究员想看平台占比走 trends 页。

### D5 详情抽屉:M+S 1–9,360px 右滑

- **决定**:点击行从右侧滑入 360px 抽屉(240ms ease-out),包含:
  1. 平台徽 + 来源名 + 作者句柄(可跳)+ 显示名;
  2. 发布时间(`yyyy-MM-dd HH:mm:ss <原始时区>`);
  3. 情感分(具体数值 + 色点);
  4. 全文(无截断 + 命中监测词高亮);
  5. Mock 中文译文(仅外文条目;"重新翻译"按钮 disabled tooltip "下一期上线");
  6. 互动数(转发/点赞/评论);
  7. 「↗ 查看原文」(新窗口);
  8. 「✓ 加入勾选」按钮(与列表 checkbox 双向同步);
  9. 顶部 ✕ 关闭 + ⤢ 全屏切换按钮(应对 1280px 屏)。
- **理由**:Q9 用户选 M+S 1–9。抽屉是研究员判读单条的"工作面",不放分析(C10/C11)、不放工作流(C14/C15)——这些是 v2 议题。

### D6 加载范式:虚拟滚动 + 前端 filter + 新数据顶部横条

- **决定**:`@tanstack/react-virtual`,渲染当前视口 + 上下 8 行缓冲,DOM 总数恒定 ≤ 80;`platforms` chip / 搜索框走 `useMemo` filter,无 fetch;`/count` 接口 90s 心跳,新增 > 0 时顶部 banner:
  ```
  ↑ N 条新条目  [点击加载]
  ```
  点击后 fetch 全量增量并 unshift 到 items 数组,前 N 条加 `data-fresh="true"` 触发左侧竖线 + 5s 淡出动画;**视口位置保持不变**(`scrollOffset` 在加载前后差值补偿)。
- **tab 失焦**:`document.addEventListener('visibilitychange')`,`hidden` 时清空轮询定时器,`visible` 时立即调一次 `/count`;
- **连续 3 次失败**:`/count` 重试 3 次失败后弹一次 toast "自动刷新已暂停,请手动刷新",定时器停止直到用户手动刷新。
- **理由**:Q8/Q11 综合决策——虚拟滚动解决性能,前端 filter 解决体感,顶部横条 + 视口锁定解决"实时感不打断注意力"。

### D7 Mock 监测词与译文

- **决定**:扩展现有 `Mock Payload Module`(`apps/web/lib/.../mock-payload`,见 `82d73a2`),新增两参数:
  - `keyword: string` — 按监测词分桶生成条目,影响内容、命中词、情感倾向种子;
  - `includeTranslation: boolean` — true 时为非中文条目附 `translation: { zh: string }` 字段;
- **MVP 监测词清单**(`apps/web/lib/public-opinion/daily-today/keywords.ts`):
  1. `peking` — 跨语种命中(zh/en/ja/ru),示范跨语种聚合;
  2. `belt-and-road` — 中英双语;
  3. `qian-xuesen` — 主中文 + 少量英文;
  4. `ai-safety` — 主英文 + 少量中文;
  5. `semiconductor-sanctions` — 主英文 + 中日双语;
  6. `carbon-neutrality` — 主中文 + 多语零星;
- **理由**:Q6/Q10 用户选 Mock。把 Mock 集中在 `keywords.ts` + Mock Payload Module,真实采集器接入时只换数据源,UI/state 不动。

### D8 排序与筛选契约

- **决定**:
  - 排序:**固定按 `publishedAt` 倒序,不可切换**(Q12);
  - 平台 chip:多选 toggle,空选 = 全部,点"全部" chip = 清空选择;
  - 搜索:`String.includes` 匹配 `body | translation?.zh | author.handle | author.displayName`,大小写无关,**0 延迟前端过滤**;
  - 情感三档(更多筛选):多选,空选 = 全部;
  - **直方图总是按当前过滤后的 items 重新计算**(切平台 chip → 直方图柱高跟着变);
  - **`platforms` chip 计数也按"除去自己外的其他过滤"计算**(经典 facet 范式,避免选了 Twitter 后其他平台 chip 显示 0)。
- **理由**:Q4/Q12 用户选 chip + 前端 filter。facet 范式是体感的关键——研究员能从 chip 计数看到"如果再切到这个平台还有多少条",而不是"全是 0"。

### D9 导出范式与 polarity 对齐 + 译文列

- **决定**:`POST /api/public-opinion/daily-today/export` body 包含 `itemIds?`,空数组导出全部;CSV 列:
  ```
  id,platform,publishedAt,author_handle,author_display_name,
  body,translation_zh,sentiment,polarity,
  reposts,likes,replies,source_url,matched_keyword
  ```
  与 polarity 的列对齐(前面 9 列同名),新增 `translation_zh` 与 `matched_keyword` 两列在末尾。
- **按钮文案**:勾选 0 → `⬇ 导出全部 (N)`;勾选 ≥1 → `⬇ 导出 (M/N)`。
- **理由**:Q7 用户选 polarity 对齐;两列追加在末尾保证下游脚本/老师的 Excel 工作流不受字段顺序变化影响。

### D10 视觉令牌与 v3 范式对齐

- 沿用 v3 控制台令牌(`--po-pad: 10px`、`--po-gap: 10px`、`--po-panel-radius: 8px`、`--po-title-size: 12px`);
- 新增令牌:
  - `--daily-today-row-height: 34px`(行高);
  - `--daily-today-aside-width: 360px`(抽屉宽度);
  - `--daily-today-histogram-height: 64px`(直方图高度);
  - `--daily-today-fresh-stripe: var(--color-primary)`(新条目左侧短竖线色);
- 5 模态情感色板 + 5 平台徽色板沿用既有变量,**不引入新色板**。

## Risks

- **R1**(中):虚拟滚动 + 大量行打开抽屉时,如果抽屉 portal 渲染在文档流外但 z-index 与某些 sticky 元素冲突——尤其与 v3 已有的 KPI rail 共存时;**缓解**:抽屉 portal 挂到 `document.body`,z-index 用既有 `--z-drawer` 令牌,1280px 实测时优先检查。
- **R2**(中):前端 filter 在 5000 条 + 多重过滤(平台 + 情感 + 搜索)同时启用时若实现不当,每次 keystroke 都全量重算 `histogram + facet counts` 会卡顿;**缓解**:搜索框输入做 80ms debounce,`useMemo` 严格按依赖切片,`histogram + facet counts` 与 filter 结果同一次 reduce 算出,避免双遍历。
- **R3**(中):新数据横条点击灌入后保持视口位置,涉及虚拟滚动 `scrollOffset` 补偿,如果实现不严会导致"视口稍微跳一下"破坏体感;**缓解**:`react-virtual` 的 `measureElement` + `scrollToOffset(prevOffset + newItemsHeight)` 在 effect 里同步执行,tasks 6.x 单独验证此场景。
- **R4**(中):Mock 监测词跨语种条目的"命中词高亮"在 unicode 边界(日文长音、中文标点)上正则匹配易错;**缓解**:用 `String.prototype.indexOf` 而非正则,匹配段落用 `<mark>` 包裹,命中词 list 来自 `keyword.aliases: string[]`(`['Peking', 'ペキン', 'Пекин', '北京']`)。
- **R5**(低):90s 轮询 + 多标签页同时打开同一监测词时,会产生 N 倍 `/count` QPS;**缓解**:MVP 阶段无视(Mock 阶段 / count 接口零成本);接入真实数据时考虑 BFF 端 5s 内的查询去重缓存。
- **R6**(低):导出大于 5000 条不可能(D2 已上限),但研究员可能勾选 4999 条全部导出导致 CSV ~3MB;**缓解**:CSV stream(`Response` body 流式),浏览器下载即时开始,不会撑爆服务端内存。

## Migration Plan

1. **Phase 1 — Mock 与 API 路由**:实现 `keywords.ts`、扩展 `Mock Payload Module`(参数 `keyword` / `includeTranslation`),搭出三个 `/api/public-opinion/daily-today/*` 路由,只返回 Mock 数据;不接 UI 时通过 curl/Postman 验证。
2. **Phase 2 — 静态 UI**:新建 `daily-today-page.jsx` + 五件套组件,接入 API,实现非交互的渲染(显示监测词 / chip / 直方图 / 行 / 抽屉);此阶段不做轮询、不做导出。
3. **Phase 3 — 交互**:加上 chip 多选、搜索、直方图点击 scrollTo、抽屉行级勾选双向同步、虚拟滚动;关键体验跑完一遍。
4. **Phase 4 — 实时与导出**:90s 轮询、新数据横条、视口锁定、tab 失焦暂停、导出 CSV;此阶段所有 v3 守护测试 + 新增守护测试必须全绿。
5. **Phase 5 — 侧边栏与文档**:`public-opinion-overview` 导航新增子项,README 与 `repository-structure.md` 同步,截图归档到 PR 描述。
6. **下一期(不在本 change 范围)**:真实采集器与 BFF 接入、按需 AI 翻译 + 缓存、可能升级 SSE/WebSocket。
