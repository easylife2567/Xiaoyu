## MODIFIED Requirements

### Requirement: 每个舆情导航条目落到稳定路由的占位页

系统 SHALL 为「舆情速览」模块的每一个导航条目(舆情总览及全部子条目)提供一个真实可达的路由。点击任一条目 SHALL 导航到对应页面而非产生 404,且页面 SHALL 在控制台 shell(`ConsoleShell`)内渲染。**已交付真实能力的条目 SHALL 呈现真实内容**(舆情总览呈现「控制台分区」形态的数据看板;**「正负面舆情」呈现按情感档位与平台筛选的分析页**);尚未交付真实能力的条目 SHALL 展示该页面标题、说明与「功能建设中」空状态。条目的路由与导航 slug SHALL 在真实能力交付前后保持不变——交付仅替换页面正文,导航结构不变。

#### Scenario: 用户点击尚未交付的舆情导航条目

- **WHEN** 用户点击一个尚未接入真实能力的条目(如「每日舆情」「趋势与占比」「今日情感分析」)
- **THEN** 系统 SHALL 导航到该条目对应的稳定路由
- **AND** 页面 SHALL 在控制台 shell 内渲染,保留 sidebar 与 topbar
- **AND** 当前条目 SHALL 在 sidebar 中高亮,其所属子分组 SHALL 处于展开状态
- **AND** 正文 SHALL 展示该页面的标题、说明与「功能建设中」占位内容

#### Scenario: 用户打开已交付真实能力的舆情总览

- **WHEN** 用户点击「舆情总览」
- **THEN** 系统 SHALL 导航到 `/public-opinion` 并在控制台 shell 内渲染
- **AND** 正文 SHALL 呈现舆情总览数据看板而非「功能建设中」占位
- **AND** 看板 SHALL 以「控制台分区」形态呈现(KPI rail + 态势/结构/热点 三个 band + 右侧 sticky 信息流)
- **AND** sidebar 中「舆情总览」条目 SHALL 高亮

#### Scenario: 用户打开已交付真实能力的「正负面舆情」

- **WHEN** 用户点击「舆情速览 / 每日舆情 / 正负面舆情」
- **THEN** 系统 SHALL 导航到 `/public-opinion/daily/polarity` 并在控制台 shell 内渲染
- **AND** 正文 SHALL 呈现「概览 + 筛选 + 信息流」三段分析页而非「功能建设中」占位
- **AND** 视觉语言 SHALL 与「舆情总览」v3 control-room 同源(复用 `.po-rail` / `.po-band` 节奏与 5 模态情感色板)
- **AND** sidebar 中「正负面舆情」条目 SHALL 高亮,父分组「每日舆情」SHALL 处于展开

#### Scenario: 占位页路由在后续填充真实内容时保持不变

- **WHEN** 后续 change 为某条目填充真实分析内容
- **THEN** 该条目的路由与导航 slug SHALL 保持与本 capability 约定一致
- **AND** 仅页面正文从占位空状态替换为真实内容,导航结构不变
