## Why

小舆已经明确了三类首批工作流：大翻译数据处理、国际日报、国际热点日报二处。当前这些工作仍分散在脚本、文件夹和 Codex 操作中，用户缺少一个统一、直观的入口来找到对应工作台、完成当日操作并查看结果。

在继续建设真实处理能力之前，需要先建立第一版工作台壳层：让用户一打开系统就能识别自己要进入的工作台，同时让不同类型的工作流在界面上呈现出符合其本质的操作方式，而不是被强行压成同一种交互。

## What Changes

- 新增 v1 工作台首页，首屏展示三个业务入口：大翻译数据处理、国际日报、国际热点日报二处。
- 新增两类可复用工作台骨架：
  - 文件处理型工作台骨架，用于“大翻译数据处理”这类“上传原始文件 → 自动处理 → 下载结果”的流程。
  - 日报生产型工作台骨架，用于“国际日报”“国际热点日报二处”这类“候选池 → 选题 → 成稿 → 导出”的流程。
- 为“大翻译数据处理”提供明确的单文件上传入口、任务状态区域和结果区域。
- 为两个日报类工作台提供候选池、已选篮子、草稿区和导出区的结构化占位，不要求用户上传手工准备的选题文件。
- 新增基础任务创建与状态展示交互，使后续真实处理能力能够挂接到统一的工作台体验中。
- 保持首版业务逻辑克制：本 change 只建设工作台壳层与界面结构，不实现联网采集、候选池生成、AI 成稿、文档导出、本地同步或真实批处理执行。

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `workflow-run`: expose the initial user-facing workbench entry points, differentiated workbench structures, and visible task states.
- `file-ingestion`: expose the concrete upload experience for file-processing workbenches without forcing upload-oriented UI onto report workbenches.

## Impact

- Affects the initial product information architecture, routing, layout system, and shared workbench UI components.
- Establishes two foundational UI patterns that later changes can extend independently: file-processing workbenches and daily-report workbenches.
- Aligns the product shell with the latest approved workflow model, avoiding future rework caused by treating report workbenches as upload-first flows.
- No external integrations, background jobs, document-processing pipelines, or AI providers are introduced in this change.
