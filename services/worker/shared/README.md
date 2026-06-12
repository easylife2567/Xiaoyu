# Shared AI provider runtime

`大翻译数据处理` 通过 `services/worker/shared/ai.py` 调用共享 AI 层。真实模型调用只允许在 worker 侧配置，前端不接收、也不暴露任何密钥。

本地开发时，统一从仓库根目录读取运行时配置：

- `.env.example`：可提交的模板
- `.env.local`：真实本地值，不提交

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `XIAOYU_AI_PROVIDER` | No | Provider mode. Defaults to `openai`; tests may use `stub` or `fail`. |
| `XIAOYU_AI_MODEL` | Yes for real calls | Model name used by the OpenAI-compatible endpoint. |
| `XIAOYU_AI_BASE_URL` | No | OpenAI-compatible API base URL. Defaults to `https://api.openai.com/v1`. |
| `XIAOYU_AI_TIMEOUT_SECONDS` | No | Request timeout in seconds. Defaults to `60`. |
| `XIAOYU_AI_MAX_RETRIES` | No | Maximum automatic retries for recoverable AI failures. Defaults to `2`. |
| `XIAOYU_AI_RETRY_BASE_MS` | No | Base backoff interval in milliseconds for automatic retries. Defaults to `1500`. |
| `XIAOYU_AI_BATCH_SIZE` | No | Number of workbook rows grouped into one AI batch call. Defaults to `20`. |
| `XIAOYU_AI_MAX_CONCURRENCY` | No | Maximum row-level AI concurrency used by the translation worker. Defaults to `6`. |
| `XIAOYU_AI_BATCH_FALLBACK_ENABLED` | No | Whether failed batches downgrade to finer-grained row execution. Defaults to `true`. |
| `XIAOYU_AI_API_KEY` | Yes for real calls | Preferred server-side provider credential. Never place this value in code, browser payloads, screenshots, or committed files. |
| `OPENAI_API_KEY` | Legacy fallback only | Backward-compatible credential fallback during migration. |

## Local setup example

```env
XIAOYU_AI_PROVIDER=openai
XIAOYU_AI_MODEL=qwen3.6-plus
XIAOYU_AI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
XIAOYU_AI_TIMEOUT_SECONDS=60
XIAOYU_AI_MAX_RETRIES=2
XIAOYU_AI_RETRY_BASE_MS=1500
XIAOYU_AI_BATCH_SIZE=20
XIAOYU_AI_MAX_CONCURRENCY=6
XIAOYU_AI_BATCH_FALLBACK_ENABLED=true
XIAOYU_AI_API_KEY=set-this-in-.env.local-or-your-secret-manager
```

Copy `.env.example` to the repository-root `.env.local`, replace the secret locally, then start the app. The web runtime loads the root env file and worker processes inherit those values.

## Safety notes

- Keep real credentials in `.env.local`, environment variables, or a secret manager only.
- Rotate any key that has been pasted into chat, logs, screenshots, or commits.
- Use `stub` mode for deterministic local tests and `fail` mode for recoverable-failure tests.
