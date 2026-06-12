from __future__ import annotations

import json
import os
import unittest
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError

from services.worker.shared.ai import (
    AIBatchSummaryResult,
    AIConfigurationError,
    AIProviderError,
    AIResponseError,
    generate_chinese_summaries_batch_with_trace,
    generate_chinese_summary_with_trace,
    load_ai_config,
)


class _FakeResponse:
    def __init__(self, payload: dict):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self) -> bytes:
        return json.dumps(self.payload).encode("utf-8")


class _FakeHTTPError(HTTPError):
    def __init__(self, status_code: int, payload: dict):
        super().__init__(
            url="https://example.com/v1/chat/completions",
            code=status_code,
            msg="error",
            hdrs=None,
            fp=BytesIO(json.dumps(payload).encode("utf-8")),
        )


class AIProviderTests(unittest.TestCase):
    def setUp(self) -> None:
        self.env_patcher = patch.dict(
            os.environ,
            {
                "XIAOYU_AI_PROVIDER": "openai",
                "XIAOYU_AI_MODEL": "qwen-plus",
                "XIAOYU_AI_BASE_URL": "https://example.com/v1",
                "XIAOYU_AI_TIMEOUT_SECONDS": "12",
                "XIAOYU_AI_MAX_RETRIES": "2",
                "XIAOYU_AI_RETRY_BASE_MS": "10",
                "XIAOYU_AI_API_KEY": "project-secret",
                "OPENAI_API_KEY": "test-secret",
            },
            clear=False,
        )
        self.env_patcher.start()

    def tearDown(self) -> None:
        self.env_patcher.stop()

    def test_loads_production_provider_configuration_without_exposing_secret(self) -> None:
        config = load_ai_config()

        self.assertEqual(config.provider, "openai")
        self.assertEqual(config.model, "qwen-plus")
        self.assertEqual(config.base_url, "https://example.com/v1")
        self.assertEqual(config.timeout_seconds, 12.0)
        self.assertEqual(config.max_retries, 2)
        self.assertEqual(config.retry_base_ms, 10)
        self.assertNotIn("project-secret", repr(config))

    def test_uses_extended_default_timeout_when_not_overridden(self) -> None:
        os.environ.pop("XIAOYU_AI_TIMEOUT_SECONDS")

        config = load_ai_config()

        self.assertEqual(config.timeout_seconds, 60.0)

    def test_prefers_project_scoped_api_key(self) -> None:
        config = load_ai_config()

        self.assertEqual(config.api_key, "project-secret")

    def test_uses_legacy_api_key_when_project_scoped_key_is_absent(self) -> None:
        os.environ.pop("XIAOYU_AI_API_KEY")

        config = load_ai_config()

        self.assertEqual(config.api_key, "test-secret")

    def test_missing_credentials_raise_configuration_error(self) -> None:
        os.environ.pop("XIAOYU_AI_API_KEY")
        os.environ.pop("OPENAI_API_KEY")

        with self.assertRaisesRegex(AIConfigurationError, "未配置可用的模型凭据"):
            generate_chinese_summary_with_trace("Foreign-language event")

    @patch("services.worker.shared.ai.urlopen")
    def test_normalizes_successful_provider_response(self, mocked_urlopen) -> None:
        mocked_urlopen.return_value = _FakeResponse(
            {
                "id": "resp-1",
                "choices": [{"message": {"content": "  北京 举行 机器人马拉松。  "}}],
            }
        )

        result = generate_chinese_summary_with_trace(
            "The second ever robot marathon took place in Beijing",
            trace_context={"taskId": "task-1", "attemptId": "attempt-1", "sheet": "DFY官方", "row": 2},
        )

        self.assertEqual(result.summary, "北京举行机器人马拉松。")
        self.assertEqual(result.trace["provider"], "openai")
        self.assertEqual(result.trace["model"], "qwen-plus")
        self.assertEqual(result.trace["status"], "succeeded")
        self.assertEqual(result.trace["providerResponseId"], "resp-1")
        self.assertEqual(result.trace["taskId"], "task-1")
        self.assertEqual(result.trace["row"], 2)
        self.assertEqual(result.trace["failureCategory"], None)
        self.assertIn("startedAt", result.trace)
        self.assertIn("finishedAt", result.trace)
        self.assertGreaterEqual(result.trace["durationMs"], 0)

    @patch("services.worker.shared.ai.urlopen")
    def test_unusable_provider_response_is_rejected(self, mocked_urlopen) -> None:
        mocked_urlopen.return_value = _FakeResponse({"choices": [{"message": {"content": "   "}}]})

        with self.assertRaisesRegex(AIResponseError, "未返回可用摘要"):
            generate_chinese_summary_with_trace("Foreign-language event")

    @patch("services.worker.shared.ai.urlopen")
    def test_transient_provider_failure_is_retriable(self, mocked_urlopen) -> None:
        mocked_urlopen.side_effect = TimeoutError("timed out")

        with self.assertRaises(AIProviderError) as context:
            generate_chinese_summary_with_trace("Foreign-language event")

        self.assertTrue(context.exception.retriable)
        self.assertEqual(context.exception.code, "ai_provider_unavailable")
        self.assertEqual(context.exception.trace["failureCategory"], "timeout")
        self.assertIn("durationMs", context.exception.trace)
        self.assertEqual(context.exception.trace["retryCount"], 2)
        self.assertEqual(len(context.exception.trace["retryHistory"]), 2)

    @patch("services.worker.shared.ai.urlopen")
    def test_rate_limit_errors_keep_actionable_provider_diagnostics(self, mocked_urlopen) -> None:
        mocked_urlopen.side_effect = _FakeHTTPError(
            429,
            {
                "code": "Throttling.RateQuota",
                "message": "Requests rate limit exceeded",
                "request_id": "req-429",
            },
        )

        with self.assertRaises(AIProviderError) as context:
            generate_chinese_summary_with_trace("Foreign-language event")

        self.assertEqual(context.exception.trace["failureCategory"], "rate_limited")
        self.assertEqual(context.exception.trace["httpStatus"], 429)
        self.assertEqual(context.exception.trace["providerCode"], "Throttling.RateQuota")
        self.assertEqual(context.exception.trace["providerRequestId"], "req-429")

    @patch("services.worker.shared.ai.sleep")
    @patch("services.worker.shared.ai.uniform", return_value=1.0)
    @patch("services.worker.shared.ai.urlopen")
    def test_timeout_can_succeed_after_automatic_retry(self, mocked_urlopen, _mocked_uniform, mocked_sleep) -> None:
        mocked_urlopen.side_effect = [
            TimeoutError("timed out"),
            _FakeResponse(
                {
                    "id": "resp-after-retry",
                    "choices": [{"message": {"content": "北京机器人马拉松顺利举行。"}}],
                }
            ),
        ]

        result = generate_chinese_summary_with_trace("Foreign-language event")

        self.assertEqual(result.summary, "北京机器人马拉松顺利举行。")
        self.assertEqual(result.trace["retryCount"], 1)
        self.assertEqual(len(result.trace["retryHistory"]), 1)
        self.assertEqual(result.trace["retryHistory"][0]["failureCategory"], "timeout")
        self.assertEqual(result.trace["retryHistory"][0]["nextDelayMs"], 10)
        mocked_sleep.assert_called_once_with(0.01)

    @patch("services.worker.shared.ai.urlopen")
    def test_batch_summary_returns_aligned_summaries(self, mocked_urlopen) -> None:
        mocked_urlopen.return_value = _FakeResponse(
            {
                "id": "batch-1",
                "choices": [
                    {
                        "message": {
                            "content": '{"summaries":["摘要一"," 摘要二  "]}',
                        }
                    }
                ],
            }
        )

        result = generate_chinese_summaries_batch_with_trace(
            ["first content", "second content"],
            trace_context={"taskId": "task-1", "sheet": "DFY官方", "batchStartRow": 2, "batchEndRow": 3},
        )

        self.assertIsInstance(result, AIBatchSummaryResult)
        self.assertEqual(result.summaries, ["摘要一", "摘要二"])
        self.assertEqual(result.trace["status"], "succeeded")
        self.assertEqual(result.trace["batchSize"], 2)
        self.assertEqual(result.trace["providerResponseId"], "batch-1")

    @patch("services.worker.shared.ai.urlopen")
    def test_batch_summary_rejects_misaligned_provider_payload(self, mocked_urlopen) -> None:
        mocked_urlopen.return_value = _FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": '{"summaries":["只有一条"]}',
                        }
                    }
                ]
            }
        )

        with self.assertRaisesRegex(AIResponseError, "批量摘要结果不可用"):
            generate_chinese_summaries_batch_with_trace(["first content", "second content"])


if __name__ == "__main__":
    unittest.main()
