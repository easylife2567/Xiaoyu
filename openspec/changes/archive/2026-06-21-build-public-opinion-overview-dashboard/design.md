## Context

舆情数据来自既有 legacy .NET ASMX 服务(base path `/yuqing-Toolkits-New/jsonNew.asmx/`)。接口梳理(根目录 `NPOL_接口梳理_副本.xlsx`)给出了请求方法与参数,但**不含响应结构**——原始 `overView_function.js` 不在本仓库内。当前 web 应用栈为 Next 16 + React 19 + Prisma,**零图表库、零外部请求客户端**,既有数据流为 `'use client'` 组件 → `/api/*` Next 路由 → 后端。

`overView` 模块接口可覆盖总览看板所需维度。v1 取其中概况 / 情感 / 媒体三层共 8 个接口。鉴权为会话式(`login` → `ASP.NET_SessionId` + `token`,约 20 分钟过期),v1 采用服务端凭据 + 自动登录(见决策 4)。

## Goals / Non-Goals

**Goals:**

- 「舆情总览」页呈现真实数据看板:概况(今日/本周/当日信息量 + 今日vs昨日趋势)、情感(分布 + 趋势)、媒体(占比 + Top10)。
- 把「未知的 ASMX 响应结构」隔离到单一归一化层,使上游 UI 与 legacy 接口结构解耦。
- 单接口故障只降级对应组件,不影响整页;未配置凭据时优雅降级为「未配置」态。
- 确立后续舆情页面复用的接入范式。

**Non-Goals:**

- 其余 5 个舆情页面的真实接入(继续占位)。
- 预警 / 最新舆情信息流(总览第四层)、日期范围选择器。
- 看板数据落库 / 本地缓存(v1 直连 ASMX,不持久化)。
- 浏览器侧的用户级登录流(v1 用服务端单一服务账号自动登录)。

## Decisions

### 决策 1:四层架构,响应映射隔离到归一化层

```
浏览器(看板组件) ──fetch──▶ BFF 聚合路由 ──POST+token──▶ ASMX
        ▲                        │
        └──── 稳定 DTO ◀──── 归一化层 ◀──── ASMX client
```

- **ASMX client**(`src/public-opinion/asmx-client.js`,server-only):`postForm(endpoint, payload)`,拼 `PUBLIC_OPINION_API_BASE` + endpoint、注入 `token`、**以 `application/x-www-form-urlencoded` POST**(见下方探针结论:JSON content-type 会触发 .NET ScriptService 500)、解析 `{code,data,message}` 信封、超时(默认 10s)、非 2xx 抛错。全系统唯一直连 legacy 的位置。
- **归一化层**(`src/public-opinion/overview.js`,server-only):每个 widget 一个函数,调 client → 映射为稳定 DTO。**响应字段映射只存在于此层**。
- **BFF 聚合路由**(`app/api/public-opinion/overview/route.js`):`GET`,服务端 `Promise.allSettled` 并行调各归一化函数,合并为 `{ kpis, todayVsYesterday, sentimentDistribution, sentimentTrend, mediaShare, top10Media, errors }`,每块独立可空。
- **看板组件**(`components/public-opinion-overview-dashboard.jsx`,client):调 `/api/public-opinion/overview`,recharts 渲染,骨架屏 + 单组件空/错态。

**为什么:** 我们现在没有响应结构。把字段映射锁在一层,实现时先抓真实样例填该层,UI 零改动。**备选**:组件直连 ASMX——被否(token 泄露 + CORS + 字段耦合散落各处)。

**探针已确认的 legacy 接口事实(2026-06-20,base `https://mcc.cuc.edu.cn/yuqing-Toolkits-New/jsonNew.asmx/`):**
- **传输:** 必须 `application/x-www-form-urlencoded`;`application/json` 会被 .NET 拒为 `ScriptService` 500。参数以表单字段传(含 `token`)。
- **响应信封:** `{ "code": <int>, "data": <payload|"">, "message": "success|failure" }`;`code:2` = 失败。归一化层据此解信封。
- **参数类型:** `MinuteHourDayMonth` / `SpanNumber` 是 Int32(传 "hour" 报 `无法转换为 Int32`);日期为字符串(`YYYY-MM-DD` 语法被接受)。
- **租户解析:** 后端 `xiaobaiyang.jsonNew.getSiteName()`(jsonNew.asmx.cs:60)在多数数据接口前置执行,无法解析站点时抛 `ArgumentNullException: key`。该解析依赖**有效会话**,与 token 有效性强相关——见 Risks 与 Open Questions 的鉴权阻塞项。

### 决策 2:DTO 契约(上游稳定,下游可演进)

| 函数 | DTO | 来源接口(真实响应) |
|---|---|---|
| `getKpis()` | `{ todayCount, weekCount, todayInfoCount }` | getDayNumber(`.totalNumbe`) / getWeekNumber(`.totalNumbe`) / getOneDayAllInfoNumber(map 求和) |
| `getTodayVsYesterdayTrend()` | `{ points: [{ label, today, yesterday }] }` | getTrendByTodayAndYestoday(`.todayChartData` 为标签,`.eachMediaNumber` 为 `[["今天",…],["昨天",…]]`) |
| `getSentimentDistribution()` | `[{ label, count }]`(5 项) | getModMediaNumberByTime(`[[平台,n1..n5],…]`,按列求和) |
| `getSentimentTrend()` | `{ labels, series: [{ label, points }] }`(5 series) | getModTrendByTime(`.todayChartData` 标签,`.eachEmotionNumber` 为 5 组) |
| `getMediaShare()` | `[{ media, count }]` | getEachMediaNumber(`{平台: 数量}` map) |
| `getTopHotNews()` | `[{ platform, title, hotValue, emotion, pubTime, url }]` | getSpanTimeTop10MediaInfo(热门新闻条目数组) |
| `getTodayHourly()` | `{ total, points:[{label,count}] }` | getDayNumber(`.timeData`/`.dayNumber` 分时分桶) |
| `getMediaSentimentMatrix()` | `[{ media, total, 正面..负面 }]` | getModMediaNumberByTime(各平台 5 模态明细) |
| `getTodayPlatformShare()` | `[{ media, count }]` | getOneDayAllInfoNumber(今日各平台映射) |
| `getWarnings()` | `{ warningTotal, majorTotal, topWords:[{word,count}] }` | getYujing / getYujingZhongda |
| `getLatestNews()` | `[{ platform, title, keyword, risk, emotion, pubTime, url }]` | getSpanTimeMediaInfo(分页信息流) |

**情感为 5 模态**(已确认标签,固定顺序):`正面 / 偏正面 / 中立 / 偏负面 / 负面`,对应 `getModMediaNumberByTime` 各行的 n1..n5 与 `getModTrendByTime.eachEmotionNumber` 的 5 组。归一化层负责把这两处的数值数组映射到带标签的结构。`getSpanTimeTop10MediaInfo` 实为 **Top 热门新闻条目**(非媒体排行),看板组件呈现为热文榜(标题 + 平台 + 热度 + 情感)。时间参数由 BFF 按「今天」统一推算后传入。

### 决策 3:BFF 聚合 + 单组件降级(allSettled)

一个聚合路由而非 6 个路由:看板初次加载一次取齐;用 `Promise.allSettled`,失败的接口在 `errors[widget]` 记录原因、对应数据块为 `null`。

**为什么:** 看板是一次性整屏视图,单请求减少往返;allSettled 保证一个 legacy 接口抖动不白屏。**备选**:每组件独立路由——更碎、初载请求多,留待真有按需刷新需求时再拆。

### 决策 4:服务端凭据 + 自动登录会话(取代「env 静态 token」)

**探针确认原系统是会话式鉴权,非静态 token**:`login(userName, passWord)` 返回 `Set-Cookie: ASP.NET_SessionId` + 一个 `token`;数据接口须**同时**带该 session cookie 与 body `token`;ASP.NET 会话闲置约 20 分钟过期。因此静态 token/cookie 放 env 不可行(很快失效)。

改为:env 存**服务账号凭据**,BFF 自助登录并维护会话——
- 配置:`PUBLIC_OPINION_API_BASE`、`PUBLIC_OPINION_API_USERNAME`、`PUBLIC_OPINION_API_PASSWORD`(`.env.local`,经 `@next/env` 从仓库根加载;不进 git、不进浏览器)。
- ASMX client 持有模块级会话缓存 `{ cookie, token }`;`ensureSession()` 无缓存或失效时调 `login` 刷新;数据调用遇鉴权失败(`code:2` / `getSiteName` 空 key)时**自动重登一次再重试**。
- 缺任一凭据时 BFF 返回 `{ configured: false }`(HTTP 200),看板渲染「未配置」态,不崩。

**为什么:** 会话短命,只有服务端自动登录能让看板长期可用;凭据是真正需要保护的持久秘密,集中在服务端。**备选**:env 静态会话 cookie——被否(~20 分钟即废,需人工反复刷新)。**安全:** 单一服务账号、凭据仅服务端;非目标仍包含「浏览器侧用户登录流」。

### 决策 5:recharts 作为图表库

折线 / 环形饼 / 横向条形 + tooltip/legend 开箱即用。所有图表组件置于 `'use client'`,用 `ResponsiveContainer` 适配容器宽度。

**为什么:** 手搓折线+饼+tooltip 代码量大、易错;recharts 兼容 React 19。**代价:** 项目首个前端依赖——可接受,看板是图表密集场景。

## Risks / Trade-offs

- **[响应结构未知,字段映射靠猜]** → 实现第一步写一次性探针脚本打真实接口、把返回固化为 fixture,据此填归一化层;归一化是唯一需改处。归一化层单测以 fixture 为输入锁定映射。
- **[legacy 接口不稳定 / 超时]** → client 设超时;BFF 用 allSettled 单组件降级;看板单组件错态。
- **[token 过期(v1 不自动续期)]** → v1 明确非目标;过期表现为接口 401/错误 → 组件错态,提示需更新 token。续期(env 账号 + 自动 login)留后续 change。
- **[recharts 与 Next 16 SSR]** → 图表组件 `'use client'`,数据在 mount 后 fetch;SSR 仅渲染骨架,规避 SSR 图表尺寸问题。
- **[现有 nav 测试断言总览页“功能建设中”]** → 本次更新该断言为看板容器;其余 5 页占位断言保持。

## Migration Plan

纯增量。回滚 = 还原 `page.jsx` 占位 + 移除 ASMX/BFF/看板文件 + 移除 recharts 依赖,无数据迁移、无 schema 变更。落地顺序:① 探针拿真实响应 → ② client + 归一化层(+单测)→ ③ BFF 聚合路由(+测试)→ ④ 看板组件 + 接入 page(+结构测试)→ ⑤ env 文档与降级验证。

## Open Questions

- ~~ASMX base URL~~ → 已确认 `https://mcc.cuc.edu.cn/yuqing-Toolkits-New/jsonNew.asmx/`(见决策 4)。
- 仍需一个**有效的登录用户 token**(`localStorage.user.token`)才能跑探针;或提供登录凭据由探针先调 `login` 取 token。**[阻塞]** 2026-06-20 提供的 token 经 `checkToken` 返回 `data:{code:2}`(失败),数据接口统一 `code:2 failure` 或 `getSiteName()` 抛 ArgumentNull——判断为 token 已失效或鉴权需随附登录会话(ASP.NET 会话 cookie)。解阻塞最稳的方式:在已登录的浏览器里 DevTools → Network → 对任一 `overView` 真实请求「Copy as cURL」,据此还原确切的 headers / cookies / 表单字段。
- 各 `overView` 接口真实响应字段名(待探针/样例确定;归一化层据此定稿)。
- 情感模态(Mod)在 legacy 编码中的具体取值(如 1/2/3 或 正/负/中文案),映射到 `positive/neutral/negative` 的对应关系待样例确认。
- 趋势接口的时间粒度(`MinuteHourDayMonth`)与跨度(`SpanNumber`)对"今天"视图的最优取值——实现期据真实数据观感微调。
- BFF 服务端到 `mcc.cuc.edu.cn` 的网络可达性(运行环境是否能直连该校内/公网地址)需在探针步骤确认。
