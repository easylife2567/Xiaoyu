# Design — build-candidate-pool-real-collector

## R1. 为何"写 fixture 文件"而不是"写 Prisma 表"

候选池数据有三种可能的归宿:fixture 文件 / Prisma 表 / 两者并行。本 change 选 **仅 fixture 文件**,理由:

1. **零 web 侧改动复用率最高**。FixtureCandidatePoolProvider 已经做了校验、staleSourceDate 兜底、provider 缓存。采集器只要把文件放到 `.data/daily-report/fixtures/<slug>/<date>.json`,workbench 完全不感知背后是手工还是机器写的。
2. **fixture 兜底逻辑天然延续**。今日采集失败(全部 feed 超时)不是大事——staleSourceDate 兜底立刻生效,昨天的真实数据顶今天用,user 看到 banner,运维看到日志,这就是生产语义。如果上 DB,缺数据要单独设计 fallback,反而让 [stabilize-candidate-pool-fixture-supply](../archive/2026-06-17-2026-06-15-stabilize-candidate-pool-fixture-supply/) 已经做完的 7 条 Scenario 失效一次重做。
3. **审计 / 复现免成本**。fixture 文件能进 git diff、进 PR review、能 copy-paste,这是 DB 行难以企及的便利。等真到了"想查 30 天历史"那天,再开新 change 引入 `NewsCandidate` 表也不迟,届时采集器仍然是同一个 collect.py,只换写出口。
4. **schema 已经稳定**。candidate item 当前 7 个必填字段加 retrievalMetadata 已经覆盖采集需要的全部。`sourceType` 是唯一需要扩枚举的字段。

代价:fixture 文件会被 git 追(`.data/daily-report/fixtures/` 在 [.gitignore](../../../.gitignore) 里被显式 unignore)——也就是说,真实采集的内容会进版本库。这不是缺陷而是特性:**它让"今天的候选池长什么样"成为可 review 的事实**。运行时数据(task / draft / artifact)仍在 `.data/daily-report/runtime/`,被 .gitignore 排除,边界清晰。

## R2. sourceType 从"必为 fixture"放宽为枚举

[apps/web/lib/daily-report/candidate-pool/index.js:66-70](../../../apps/web/lib/daily-report/candidate-pool/index.js) 当前硬断言:

```js
if (candidate.sourceType !== 'fixture') {
  const error = new Error(...)
  error.code = 'candidate_pool_invalid'
  throw error
}
```

这是 [build-international-daily-report-runtime](../archive/2026-06-12-build-international-daily-report-runtime/) 时代的做法——那时只有手工 fixture 一种来源,断言越严越好。现在采集器入场,这个断言要么放宽、要么让采集器伪装成 `fixture`。

**选放宽**(白名单 `['fixture', 'rss']`)而不是伪装的理由:

- spec 反复强调"sourceType 用于审计 / 区分手工 fixture 与生产采集"。让采集出来的条目仍写 `fixture` 是对 spec 的违反。
- 白名单只多一行代码,改动范围与"动一行 if 条件"等价。
- 未来扩源(GDELT / NewsAPI / 爬虫)只要往枚举里追加值即可,不再二次改断言。
- 起草 / 导出消费方读 candidate 只用 `title / sourceName / sourceUrl / publishedAt / summary / retrievalMetadata`,**完全不读 sourceType**(已确认),所以放宽不会引发任何下游连锁改动。

风险:如果未来 sourceType 出现拼写漂移(写错成 `RSS` / `Rss`),白名单会拦下来,但不会拦"未在枚举中"的合法新值——这正好是我们要的 fail-fast 行为。

## R3. 首批 RSS 源清单的工程权衡

把"具体 feed URL"写进 spec 是过度规约,会让运维换源都要改 spec。本 change 的边界是:**spec 只规定"按 workflow 配一组 feed"**;具体 URL 进 [services/worker/daily_report/sources/<slug>.json](../../../services/worker/daily_report/) 配置文件,可被运维直接编辑、不触发 spec 升级。**配置用 JSON 不用 YAML**——避免引入 PyYAML,与现有 worker(stdlib + python-docx + openpyxl)依赖风格保持一致。

`international-daily-report` 首批拟接的源(全部公开 RSS、零密钥),按"中文母语优先 + 多视角覆盖"挑选:

**中文媒体(优先,起草直接可读)**

| 源 | feed | 视角 | 实测(2026-06-18)|
|---|---|---|---|
| 俄罗斯卫星通讯社中文 | `https://sputniknews.cn/export/rss2/archive/index.xml` | 俄罗斯官方视角,RSS 维护稳定 | ✅ 100 entries |
| 法广中文 RFI | `https://www.rfi.fr/cn/rss` | 法国视角,RFI 全语种站均提供 RSS | ✅ 30 entries |
| 纽约时报中文网 | `https://cn.nytimes.com/rss.html` | 美国视角,内容已是中文 | ✅ 20 entries |
| BBC 中文 | `https://www.bbc.com/zhongwen/simp/index.xml` | 英国视角 | ✅ 43 entries(HEAD 302 → 重定向后正常)|
| DW 中文 | `https://rss.dw.com/atom/rss-chi-all`(**注意 `chi` 而非 `zh`**) | 德国 / 欧陆视角 | ✅ 51 entries(Atom 格式)|

> 备注:
> - 联合早报《环球》RSS 已失效 / 下架,首批不接。
> - 法新社中文(AFP)是 wire service,几乎没有公开 RSS,本期不接,**留给后续以爬虫为核心的 change 处理**(详见 R8)。
> - DW 各语种 RSS 路径用 ISO-639-2 三字母代码(`chi`、`eng`),不是两字母 `zh`/`en`。

**英语媒体(补充,首期可在采集 → 起草之间手工概览,后续接入翻译模块再大量启用)**

| 源 | feed | 视角 | 实测(2026-06-18)|
|---|---|---|---|
| BBC World | `https://feeds.bbci.co.uk/news/world/rss.xml` | 英国 / 国际通用 | ✅ 32 entries |
| The Guardian World | `https://www.theguardian.com/world/rss` | 英国左 | ✅ 45 entries |
| Al Jazeera English | `https://www.aljazeera.com/xml/rss/all.xml` | 中东 / 全球南方 | ✅ 25 entries |
| Deutsche Welle English | `https://rss.dw.com/rdf/rss-en-all` | 欧陆 | ✅ 150 entries(RDF/Atom,字段是 `updated` 不是 `published`)|

Reuters / Bloomberg / FT / WSJ 不公开 RSS(2020 后下架或墙后),首期不接。

工程注意:
- **所有具体 URL 都是工程默认值,不是 spec 约束**——任务清单 2.2 在 PR 阶段逐一实测,不可达的删,可达的留。RSS 入口在主流媒体中改版频繁,**BBC 中文 / 纽约时报中文网两家在 PR 实测时存在较高被删风险**(分别因为近年改版、地区性可达性问题)。
- **首期至少保留 3 个稳定源**(由 tasks.md 2.2 兜底),其中至少 2 个是中文母语源——这是采集器一上线就能出"无需翻译就能进起草"内容的下限。**Sputnik / RFI 中文 / DW 中文** 是兜底人选(三家 RSS 维护历来稳定,可达性高于其他几家)。
- 起草环节(`generate_international_daily_report_with_trace`)目前对中英文都不挑——只把 6 条 candidate 的 title + summary 喂给模型生成中文段落。所以英语源进入 candidate pool 也能用,只是用户在工作台看到的是英文 title,需要心算翻译——这是首期可接受的体验。

## R4. 时效过滤的取舍

[news-candidate-pool spec](../../specs/news-candidate-pool/spec.md) 已有 "Candidate pools contain recent news",约束是"按 workflow 配置的窗口"。本 change 的实现:

- 默认窗口 24 小时(以采集时刻为锚点向前看)。
- 配置在 source JSON 顶层 `recencyHours: 24`,可按 workflow 改(国际日报 24h / 周报 168h)。
- pubDate 缺失的条目**直接丢弃**,而不是按"立即"算入。RSS 里 pubDate 缺失通常是不规范源,strict-by-default 比 lenient 安全。

## R5. 去重策略

`(canonicalUrl, titleFingerprint)` 复合键:

- canonicalUrl:strip query string + lowercase host + 去掉 `utm_*` 等跟踪参数。
- titleFingerprint:lowercase + strip 标点 + 取前 80 字符 hash —— 相似但不完全相同的 title 不算重(给一些容错,避免把同事件不同表述误并)。
- 命中即丢后到的(保 RSS 列表中先出现的源,等于隐含优先级)。

不做"跨日去重"——昨天采到的同 URL 今天再来,仍算今天的候选池一员;`staleSourceDate` 兜底语义本来就允许内容跨日复用,这里保持一致。

## R6. 单 feed 失败 / 全 feed 失败的语义

- 单 feed 超时 / HTTP 4xx / 解析错误:**警告日志 + 跳过该 feed,继续下一个**。这条线已经能从仅有的几个成功 feed 拼出当日 fixture。
- 全部 feed 都失败:不写 fixture 文件,worker 退出码 ≠ 0,stdout 输出 `{"ok": false, "code": "no_feeds_succeeded", "details": [...]}`。
  - **此时 web 侧的 staleSourceDate 兜底立即接管**——昨天的 fixture 被读出来,banner 提示运维。这是 fixture 兜底设计的全部价值兑现。
- 成功的 feed 拼出来不足"最低候选数"(配置默认 6 条):仍写文件,但 stdout 加 `warning: insufficient_candidates`。是否阻塞由调用方决定;首期不阻塞——少几条总比开天窗强。

## R7. 与 roll-fixture 的关系

[scripts/daily-report/roll-fixture.mjs](../../../scripts/daily-report/roll-fixture.mjs) 在本 change 之后**继续保留**,职责区分:

- `collect-pool` —— 真实数据,适合演示、生产。失败时会留空;由 staleSourceDate 兜底续命。
- `roll-fixture` —— 日期平移,适合 dev 离线环境(没网、没时间真采),仍能产出"今天看起来很新"的样本。

两者输出的文件 schema 完全一致,差别只在 candidate 的 `sourceType` 字段值(`fixture` vs `rss`)。文档里明确两个工具各自的使用场景,不强制统一。

## R8. 不在本期范围

- **调度**:cron / 启动钩子 / Next.js Route Handler 自动触发——后续 `schedule-daily-candidate-pool-prep` change。
- **Prisma 模型**:`NewsCandidate` / `CandidatePoolSnapshot` 表——后续"想要历史查询"时再开 change。
- **付费 API / 爬虫 / 反爬绕过**:本期纯 RSS。**法新社中文(AFP)等 wire service / 反爬严格的中文媒体源**(AFP 几乎无公开 RSS、Reuters / Bloomberg / FT 已 RSS 下架)留给后续独立 change(暂称 `extend-candidate-pool-collector-with-scraper` 或类似)处理——届时需要先评估各家 robots.txt / 商业条款,再决定接入路径(headless 浏览器 / 第三方授权 API / 内部 wire 客户身份)。本期 collect.py 的 `fetch_feed` 抽象保留扩展点:`source_config` 加一个 `kind: 'rss' | 'scraper'` 字段,但 first iteration 只实现 `rss`。
- **跨语言归一化**(把 ko / pt / id 文章翻译成中文标题供选)——属于"翻译模块"或新的"归一化"capability,不在候选池采集范围。R3 的源清单里中文媒体(联合早报 / Sputnik 中文 / RFI 中文 / 纽约时报中文网)已经覆盖了中文母语下限;英语源进入 candidate pool 时用户看到英文 title 是首期可接受的体验。真正大量接入德语 / 韩语 / 葡语等多语种源,等 candidate-pool 与 translation-task-runtime 之间的接口设计成熟后再开 change。
- **基于内容的语义聚类去重**(同事件多源合并为一条)——spec 早有"`Candidate pools reduce duplication`",但纯 RSS + 标题指纹只能做最粗的字面去重。语义聚类需要 embedding,等 LLM 调用进入候选池流程时再开 change。
