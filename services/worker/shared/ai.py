"""Shared AI provider layer for worker-side generation."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from random import uniform
from time import perf_counter, sleep
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


SUMMARY_SYSTEM_PROMPT = "你是舆情研究助理。请把输入内容改写为简洁、准确的中文一句话摘要。"
BATCH_SUMMARY_SYSTEM_PROMPT = (
    "你是舆情研究助理。请针对多条输入内容分别生成简洁、准确的中文一句话摘要。"
    "必须严格返回 JSON 对象，格式为 {\"summaries\": [\"...\", \"...\"]}，数组长度必须与输入条数完全一致，不要输出任何额外解释。"
)
SUPPORTED_PROVIDERS = {"openai", "stub", "fail"}
DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_TIMEOUT_SECONDS = 60.0
DEFAULT_MAX_RETRIES = 2
DEFAULT_RETRY_BASE_MS = 1500
RECOVERABLE_FAILURE_CATEGORIES = {"timeout", "rate_limited", "provider_error"}


@dataclass(frozen=True)
class AIConfig:
    provider: str
    model: str | None
    base_url: str
    timeout_seconds: float
    max_retries: int
    retry_base_ms: int
    api_key: str | None = field(repr=False)


@dataclass(frozen=True)
class AISummaryResult:
    summary: str
    trace: dict[str, object]


@dataclass(frozen=True)
class AIBatchSummaryResult:
    summaries: list[str]
    trace: dict[str, object]


class AIProcessingError(RuntimeError):
    code: str
    retriable: bool
    trace: dict[str, object]

    def __init__(self, message: str, *, code: str, retriable: bool, trace: dict[str, object] | None = None):
        super().__init__(message)
        self.code = code
        self.retriable = retriable
        self.trace = trace or {}


class AIConfigurationError(AIProcessingError):
    def __init__(self, message: str, *, trace: dict[str, object] | None = None):
        super().__init__(message, code="ai_configuration_error", retriable=False, trace=trace)


class AIProviderError(AIProcessingError):
    def __init__(self, message: str, *, trace: dict[str, object] | None = None):
        super().__init__(message, code="ai_provider_unavailable", retriable=True, trace=trace)


class AIResponseError(AIProcessingError):
    def __init__(self, message: str, *, trace: dict[str, object] | None = None):
        super().__init__(message, code="ai_response_invalid", retriable=True, trace=trace)


def load_ai_config() -> AIConfig:
    provider = os.getenv("XIAOYU_AI_PROVIDER", "openai").strip().lower()
    if provider not in SUPPORTED_PROVIDERS:
        raise AIConfigurationError("AI 摘要生成失败：当前 provider 配置不受支持。")

    raw_timeout = os.getenv("XIAOYU_AI_TIMEOUT_SECONDS", str(DEFAULT_TIMEOUT_SECONDS)).strip()
    try:
        timeout_seconds = float(raw_timeout)
    except ValueError as error:
        raise AIConfigurationError("AI 摘要生成失败：调用超时配置无效。") from error

    if timeout_seconds <= 0:
        raise AIConfigurationError("AI 摘要生成失败：调用超时配置必须大于 0。")

    raw_max_retries = os.getenv("XIAOYU_AI_MAX_RETRIES", str(DEFAULT_MAX_RETRIES)).strip()
    try:
        max_retries = int(raw_max_retries)
    except ValueError as error:
        raise AIConfigurationError("AI 摘要生成失败：自动重试次数配置无效。") from error

    if max_retries < 0:
        raise AIConfigurationError("AI 摘要生成失败：自动重试次数不能小于 0。")

    raw_retry_base_ms = os.getenv("XIAOYU_AI_RETRY_BASE_MS", str(DEFAULT_RETRY_BASE_MS)).strip()
    try:
        retry_base_ms = int(raw_retry_base_ms)
    except ValueError as error:
        raise AIConfigurationError("AI 摘要生成失败：重试间隔配置无效。") from error

    if retry_base_ms < 0:
        raise AIConfigurationError("AI 摘要生成失败：重试间隔不能小于 0。")

    return AIConfig(
        provider=provider,
        model=os.getenv("XIAOYU_AI_MODEL"),
        base_url=os.getenv("XIAOYU_AI_BASE_URL", DEFAULT_BASE_URL).rstrip("/"),
        timeout_seconds=timeout_seconds,
        max_retries=max_retries,
        retry_base_ms=retry_base_ms,
        api_key=os.getenv("XIAOYU_AI_API_KEY") or os.getenv("OPENAI_API_KEY"),
    )


def _base_trace(config: AIConfig, trace_context: dict[str, object] | None, **extra: object) -> dict[str, object]:
    return {
        **(trace_context or {}),
        "provider": config.provider,
        "model": config.model,
        **extra,
    }


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _timed_trace(
    config: AIConfig,
    trace_context: dict[str, object] | None,
    *,
    started_at: str,
    started_clock: float,
    **extra: object,
) -> dict[str, object]:
    return _base_trace(
        config,
        trace_context,
        startedAt=started_at,
        finishedAt=_utc_now(),
        durationMs=max(0, round((perf_counter() - started_clock) * 1000)),
        **extra,
    )


def _normalize_summary(
    raw_content: object,
    config: AIConfig,
    trace_context: dict[str, object] | None,
    *,
    started_at: str,
    started_clock: float,
) -> str:
    if not isinstance(raw_content, str):
        raise AIResponseError(
            "AI 摘要生成失败：模型未返回可用摘要。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        )

    normalized = re.sub(r"\s+", " ", raw_content).strip()
    normalized = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", normalized)
    if not normalized:
        raise AIResponseError(
            "AI 摘要生成失败：模型未返回可用摘要。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        )
    return normalized


def _stub_summary(text: str) -> str:
    lowered = text.lower()
    if "taiwan" in lowered or "台湾" in text:
        return "内容涉及台湾议题"
    if any(term in lowered for term in ("wage arrears", "unpaid wages")) or any(
        term in text for term in ("欠薪", "讨薪", "拖欠工资")
    ):
        return "内容涉及欠薪讨薪"
    if "robot marathon" in lowered:
        return "北京举行机器人马拉松"
    return "该条内容涉及外文事件报道"


def _stub_batch_summaries(texts: list[str]) -> list[str]:
    return [_stub_summary(text) for text in texts]


def _extract_response_content(payload: dict[str, object], *, error_message: str, config: AIConfig, trace_context: dict[str, object] | None, started_at: str, started_clock: float) -> object:
    try:
        return payload["choices"][0]["message"]["content"]  # pyright: ignore[reportAny]
    except (KeyError, IndexError, TypeError) as error:
        raise AIResponseError(
            error_message,
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        ) from error


def _strip_code_fences(raw_content: str) -> str:
    normalized = raw_content.strip()
    if normalized.startswith("```"):
        lines = normalized.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        normalized = "\n".join(lines).strip()
    return normalized


def _parse_json_content(
    raw_content: object,
    *,
    error_message: str,
    config: AIConfig,
    trace_context: dict[str, object] | None,
    started_at: str,
    started_clock: float,
) -> object:
    if not isinstance(raw_content, str):
        raise AIResponseError(
            error_message,
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        )

    try:
        return json.loads(_strip_code_fences(raw_content))
    except json.JSONDecodeError as error:
        raise AIResponseError(
            error_message,
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        ) from error


def _normalize_batch_summaries(
    raw_content: object,
    expected_count: int,
    config: AIConfig,
    trace_context: dict[str, object] | None,
    *,
    started_at: str,
    started_clock: float,
) -> list[str]:
    payload = _parse_json_content(
        raw_content,
        error_message="AI 批量摘要结果不可用。",
        config=config,
        trace_context=trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )

    summaries = payload.get("summaries") if isinstance(payload, dict) else None
    if not isinstance(summaries, list) or len(summaries) != expected_count:
        raise AIResponseError(
            "AI 批量摘要结果不可用。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        )

    normalized = [
        _normalize_summary(
            item,
            config,
            trace_context,
            started_at=started_at,
            started_clock=started_clock,
        )
        for item in summaries
    ]
    if len(normalized) != expected_count:
        raise AIResponseError(
            "AI 批量摘要结果不可用。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        )
    return normalized


def _parse_http_error(error: HTTPError) -> dict[str, object]:
    try:
        if getattr(error, "fp", None) and hasattr(error.fp, "seek"):
            error.fp.seek(0)
        payload = json.loads(error.read().decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError, OSError):
        payload = {}

    provider_code = payload.get("code") if isinstance(payload, dict) else None
    request_id = None
    if isinstance(payload, dict):
        request_id = payload.get("request_id") or payload.get("requestId")
    return {
        "httpStatus": error.code,
        "providerCode": provider_code,
        "providerRequestId": request_id,
    }


def _with_attempt_context(
    trace_context: dict[str, object] | None,
    *,
    attempt_number: int,
    max_retries: int,
) -> dict[str, object]:
    return {
        **(trace_context or {}),
        "attemptNumber": attempt_number,
        "maxRetries": max_retries,
    }


def _calculate_retry_delay_ms(base_ms: int, retry_attempt: int) -> int:
    if base_ms == 0:
        return 0
    return max(0, round(base_ms * (2 ** (retry_attempt - 1)) * uniform(0.8, 1.2)))


def _finalize_trace(trace: dict[str, object], retry_history: list[dict[str, object]], max_retries: int) -> dict[str, object]:
    return {
        **trace,
        "retryCount": len(retry_history),
        "retryHistory": retry_history,
        "maxRetries": max_retries,
    }


def _should_retry(error: AIProcessingError, *, attempt_number: int, max_retries: int) -> bool:
    if attempt_number > max_retries:
        return False
    category = error.trace.get("failureCategory")
    return error.retriable and category in RECOVERABLE_FAILURE_CATEGORIES


def _invoke_openai_compatible_provider_once(
    text: str,
    config: AIConfig,
    trace_context: dict[str, object] | None,
) -> AISummaryResult:
    started_at = _utc_now()
    started_clock = perf_counter()
    if not config.api_key:
        raise AIConfigurationError(
            "AI 摘要生成失败：未配置可用的模型凭据。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_configuration_error",
                failureCategory="configuration_error",
            ),
        )
    if not config.model:
        raise AIConfigurationError(
            "AI 摘要生成失败：未配置可用的模型名称。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_configuration_error",
                failureCategory="configuration_error",
            ),
        )

    body = json.dumps(
        {
            "model": config.model,
            "messages": [
                {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": text},
            ],
            "temperature": 0.2,
        }
    ).encode("utf-8")
    request = Request(
        f"{config.base_url}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=config.timeout_seconds) as response:  # pyright: ignore[reportAny]
            response_text: str = response.read().decode("utf-8")  # pyright: ignore[reportAny]
            payload = json.loads(response_text)  # pyright: ignore[reportAny]
    except TimeoutError as error:
        raise AIProviderError(
            "AI 摘要生成失败：模型调用超时，请稍后重试。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory="timeout",
            ),
        ) from error
    except HTTPError as error:
        diagnostics = _parse_http_error(error)
        failure_category = "rate_limited" if error.code == 429 else "provider_error"
        message = (
            "AI 摘要生成失败：模型触发限流，请稍后重试。"
            if failure_category == "rate_limited"
            else "AI 摘要生成失败：模型服务暂时不可用，请稍后重试。"
        )
        raise AIProviderError(
            message,
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory=failure_category,
                **diagnostics,
            ),
        ) from error
    except (URLError, OSError) as error:
        raise AIProviderError(
            "AI 摘要生成失败：模型服务暂时不可用，请稍后重试。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory="provider_error",
            ),
        ) from error
    except json.JSONDecodeError as error:
        raise AIResponseError(
            "AI 摘要生成失败：模型返回结果无法解析。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        ) from error

    content = _extract_response_content(
        payload,
        error_message="AI 摘要生成失败：模型未返回可用摘要。",
        config=config,
        trace_context=trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )

    summary = _normalize_summary(  # pyright: ignore[reportAny]
        content,
        config,
        trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )
    return AISummaryResult(
        summary=summary,
        trace=_timed_trace(
            config,
            trace_context,
            started_at=started_at,
            started_clock=started_clock,
            status="succeeded",
            failureCategory=None,
            providerResponseId=payload.get("id"),  # pyright: ignore[reportAny]
        ),
    )


def _invoke_openai_compatible_provider(text: str, config: AIConfig, trace_context: dict[str, object] | None) -> AISummaryResult:
    retry_history: list[dict[str, object]] = []

    for attempt_number in range(1, config.max_retries + 2):
        attempt_context = _with_attempt_context(
            trace_context,
            attempt_number=attempt_number,
            max_retries=config.max_retries,
        )
        try:
            result = _invoke_openai_compatible_provider_once(text, config, attempt_context)
            return AISummaryResult(
                summary=result.summary,
                trace=_finalize_trace(result.trace, retry_history, config.max_retries),
            )
        except AIProcessingError as error:
            if not _should_retry(error, attempt_number=attempt_number, max_retries=config.max_retries):
                error.trace = _finalize_trace(error.trace, retry_history, config.max_retries)
                raise

            retry_attempt = len(retry_history) + 1
            next_delay_ms = _calculate_retry_delay_ms(config.retry_base_ms, retry_attempt)
            retry_history.append(
                {
                    "retryAttempt": retry_attempt,
                    "attemptNumber": attempt_number,
                    "failureCategory": error.trace.get("failureCategory"),
                    "durationMs": error.trace.get("durationMs"),
                    "finishedAt": error.trace.get("finishedAt"),
                    "nextDelayMs": next_delay_ms,
                }
            )
            sleep(next_delay_ms / 1000)

    raise RuntimeError("unreachable")


def _build_batch_prompt(texts: list[str]) -> str:
    rows = [{"index": index + 1, "content": text} for index, text in enumerate(texts)]
    return (
        "请按输入顺序返回每条内容的中文一句话摘要。"
        "只返回 JSON 对象，格式必须为 {\"summaries\": [\"...\", \"...\"]}。\n"
        f"{json.dumps(rows, ensure_ascii=False)}"
    )


def _invoke_openai_compatible_batch_once(
    texts: list[str],
    config: AIConfig,
    trace_context: dict[str, object] | None,
) -> AIBatchSummaryResult:
    started_at = _utc_now()
    started_clock = perf_counter()
    if not config.api_key:
        raise AIConfigurationError(
            "AI 摘要生成失败：未配置可用的模型凭据。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_configuration_error",
                failureCategory="configuration_error",
            ),
        )
    if not config.model:
        raise AIConfigurationError(
            "AI 摘要生成失败：未配置可用的模型名称。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_configuration_error",
                failureCategory="configuration_error",
            ),
        )

    body = json.dumps(
        {
            "model": config.model,
            "messages": [
                {"role": "system", "content": BATCH_SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": _build_batch_prompt(texts)},
            ],
            "temperature": 0.2,
        }
    ).encode("utf-8")
    request = Request(
        f"{config.base_url}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=config.timeout_seconds) as response:  # pyright: ignore[reportAny]
            response_text: str = response.read().decode("utf-8")  # pyright: ignore[reportAny]
            payload = json.loads(response_text)  # pyright: ignore[reportAny]
    except TimeoutError as error:
        raise AIProviderError(
            "AI 摘要生成失败：模型调用超时，请稍后重试。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory="timeout",
                batchSize=len(texts),
            ),
        ) from error
    except HTTPError as error:
        diagnostics = _parse_http_error(error)
        failure_category = "rate_limited" if error.code == 429 else "provider_error"
        message = (
            "AI 摘要生成失败：模型触发限流，请稍后重试。"
            if failure_category == "rate_limited"
            else "AI 摘要生成失败：模型服务暂时不可用，请稍后重试。"
        )
        raise AIProviderError(
            message,
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory=failure_category,
                batchSize=len(texts),
                **diagnostics,
            ),
        ) from error
    except (URLError, OSError) as error:
        raise AIProviderError(
            "AI 摘要生成失败：模型服务暂时不可用，请稍后重试。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory="provider_error",
                batchSize=len(texts),
            ),
        ) from error
    except json.JSONDecodeError as error:
        raise AIResponseError(
            "AI 批量摘要结果不可用。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
                batchSize=len(texts),
            ),
        ) from error

    content = _extract_response_content(
        payload,
        error_message="AI 批量摘要结果不可用。",
        config=config,
        trace_context=trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )
    summaries = _normalize_batch_summaries(
        content,
        len(texts),
        config,
        trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )
    return AIBatchSummaryResult(
        summaries=summaries,
        trace=_timed_trace(
            config,
            trace_context,
            started_at=started_at,
            started_clock=started_clock,
            status="succeeded",
            failureCategory=None,
            providerResponseId=payload.get("id"),  # pyright: ignore[reportAny]
            batchSize=len(texts),
        ),
    )


def _invoke_openai_compatible_batch(
    texts: list[str],
    config: AIConfig,
    trace_context: dict[str, object] | None,
) -> AIBatchSummaryResult:
    retry_history: list[dict[str, object]] = []

    for attempt_number in range(1, config.max_retries + 2):
        attempt_context = _with_attempt_context(
            trace_context,
            attempt_number=attempt_number,
            max_retries=config.max_retries,
        )
        try:
            result = _invoke_openai_compatible_batch_once(texts, config, attempt_context)
            return AIBatchSummaryResult(
                summaries=result.summaries,
                trace=_finalize_trace(result.trace, retry_history, config.max_retries),
            )
        except AIProcessingError as error:
            if not _should_retry(error, attempt_number=attempt_number, max_retries=config.max_retries):
                error.trace = _finalize_trace(error.trace, retry_history, config.max_retries)
                raise

            retry_attempt = len(retry_history) + 1
            next_delay_ms = _calculate_retry_delay_ms(config.retry_base_ms, retry_attempt)
            retry_history.append(
                {
                    "retryAttempt": retry_attempt,
                    "attemptNumber": attempt_number,
                    "failureCategory": error.trace.get("failureCategory"),
                    "durationMs": error.trace.get("durationMs"),
                    "finishedAt": error.trace.get("finishedAt"),
                    "nextDelayMs": next_delay_ms,
                }
            )
            sleep(next_delay_ms / 1000)

    raise RuntimeError("unreachable")


def generate_chinese_summary_with_trace(
    text: str,
    *,
    trace_context: dict[str, object] | None = None,
) -> AISummaryResult:
    config = load_ai_config()

    if config.provider == "fail":
        started_at = _utc_now()
        started_clock = perf_counter()
        raise AIProviderError(
            "AI 摘要生成失败，请稍后重试。",
            trace=_finalize_trace(
                _timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="failed",
                    failureCode="ai_provider_unavailable",
                    failureCategory="provider_error",
                ),
                [],
                config.max_retries,
            ),
        )

    if config.provider == "stub":
        started_at = _utc_now()
        started_clock = perf_counter()
        return AISummaryResult(
            summary=_stub_summary(text),
            trace=_finalize_trace(
                _timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="succeeded",
                    failureCategory=None,
                ),
                [],
                config.max_retries,
            ),
        )

    return _invoke_openai_compatible_provider(text, config, trace_context)


def generate_chinese_summaries_batch_with_trace(
    texts: list[str],
    *,
    trace_context: dict[str, object] | None = None,
) -> AIBatchSummaryResult:
    config = load_ai_config()

    if config.provider == "fail":
        started_at = _utc_now()
        started_clock = perf_counter()
        raise AIProviderError(
            "AI 摘要生成失败，请稍后重试。",
            trace=_finalize_trace(
                _timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="failed",
                    failureCode="ai_provider_unavailable",
                    failureCategory="provider_error",
                    batchSize=len(texts),
                ),
                [],
                config.max_retries,
            ),
        )

    if config.provider == "stub":
        started_at = _utc_now()
        started_clock = perf_counter()
        return AIBatchSummaryResult(
            summaries=_stub_batch_summaries(texts),
            trace=_finalize_trace(
                _timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="succeeded",
                    failureCategory=None,
                    batchSize=len(texts),
                ),
                [],
                config.max_retries,
            ),
        )

    return _invoke_openai_compatible_batch(texts, config, trace_context)


def generate_chinese_summary(text: str) -> str:
    return generate_chinese_summary_with_trace(text).summary


# ─── Daily Report drafting ──────────────────────────────────────────────────

DAILY_REPORT_SYSTEM_PROMPT = (
    "你是舆情研究助理，负责撰写《国际日报》。请严格参照以下句式撰写每条正文："
    "“X月X日，据XXX报道，XXXXX。”正文必须以日期开头，紧接“据[来源]报道”，"
    "后接新闻事实与影响判断；语言应简洁、准确、客观，整体风格应贴近正式日报模板。"
    "不要在 body 中添加“一、二、三、”或“1.”等编号，编号由导出模板层统一添加。"
    "必须严格返回 JSON 对象，格式为 "
    "{\"sections\": [{\"index\": <int>, \"title\": <string>, \"body\": <string>}]}，"
    "数组长度必须等于输入条数，index 从 1 开始递增，不要输出任何额外解释。"
)


@dataclass(frozen=True)
class AIDailyReportResult:
    sections: list[dict[str, object]]
    trace: dict[str, object]


def _format_chinese_month_day(value: object) -> str:
    if isinstance(value, str) and len(value) >= 10:
        try:
            month = int(value[5:7])
            day = int(value[8:10])
            return f"{month}月{day}日"
        except ValueError:
            pass
    return "近日"


def _stub_daily_report_sections(selections: list[dict[str, object]]) -> list[dict[str, object]]:
    sections = []
    for index, selection in enumerate(selections, start=1):
        title = selection.get("title") or f"国际要闻 #{index}"
        source = selection.get("sourceName") or "相关媒体"
        summary = selection.get("summary") or "该事件引发外界关注。"
        date_text = _format_chinese_month_day(selection.get("publishedAt"))
        sections.append(
            {
                "index": index,
                "title": title,
                "body": f"{date_text}，据{source}报道，{summary}",
            }
        )
    return sections


def _build_daily_report_user_prompt(selections: list[dict[str, object]]) -> str:
    payload = [
        {
            "index": index + 1,
            "title": selection.get("title"),
            "sourceName": selection.get("sourceName"),
            "sourceUrl": selection.get("sourceUrl"),
            "publishedAt": selection.get("publishedAt"),
            "summary": selection.get("summary"),
        }
        for index, selection in enumerate(selections)
    ]
    return (
        "请按输入顺序撰写每条新闻的正式日报正文。每条 body 必须严格使用："
        "“X月X日，据XXX报道，XXXXX。”这种句式；X月X日优先使用 publishedAt，"
        "XXX 优先使用 sourceName；不要给 body 添加序号；每段建议 80-140 个中文字符，"
        "确保 6 条合计能放入一页 Word 模板。只返回 JSON 对象，格式必须为 "
        "{\"sections\": [{\"index\": <int>, \"title\": <string>, \"body\": <string>}]}。\n"
        f"{json.dumps(payload, ensure_ascii=False)}"
    )


def _normalize_daily_report_sections(
    raw_content: object,
    expected_count: int,
    config: AIConfig,
    trace_context: dict[str, object] | None,
    *,
    started_at: str,
    started_clock: float,
) -> list[dict[str, object]]:
    payload = _parse_json_content(
        raw_content,
        error_message="AI 起草结果不可用。",
        config=config,
        trace_context=trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )

    sections = payload.get("sections") if isinstance(payload, dict) else None
    if not isinstance(sections, list) or len(sections) != expected_count:
        raise AIResponseError(
            "AI 起草结果数量不匹配。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
            ),
        )

    normalized = []
    for index, section in enumerate(sections, start=1):
        if not isinstance(section, dict):
            raise AIResponseError(
                "AI 起草结果格式不合法。",
                trace=_timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="failed",
                    failureCode="ai_response_invalid",
                    failureCategory="invalid_response",
                ),
            )

        title = section.get("title")
        body = section.get("body")
        if not isinstance(title, str) or not title.strip() or not isinstance(body, str) or not body.strip():
            raise AIResponseError(
                "AI 起草结果缺少标题或正文。",
                trace=_timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="failed",
                    failureCode="ai_response_invalid",
                    failureCategory="invalid_response",
                ),
            )

        normalized.append({"index": index, "title": title.strip(), "body": body.strip()})

    return normalized


def _invoke_daily_report_provider_once(
    selections: list[dict[str, object]],
    config: AIConfig,
    trace_context: dict[str, object] | None,
) -> AIDailyReportResult:
    started_at = _utc_now()
    started_clock = perf_counter()
    if not config.api_key:
        raise AIConfigurationError(
            "AI 起草失败：未配置可用的模型凭据。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_configuration_error",
                failureCategory="configuration_error",
            ),
        )
    if not config.model:
        raise AIConfigurationError(
            "AI 起草失败：未配置可用的模型名称。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_configuration_error",
                failureCategory="configuration_error",
            ),
        )

    body = json.dumps(
        {
            "model": config.model,
            "messages": [
                {"role": "system", "content": DAILY_REPORT_SYSTEM_PROMPT},
                {"role": "user", "content": _build_daily_report_user_prompt(selections)},
            ],
            "temperature": 0.3,
        }
    ).encode("utf-8")
    request = Request(
        f"{config.base_url}/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=config.timeout_seconds) as response:
            response_text: str = response.read().decode("utf-8")
            payload = json.loads(response_text)
    except TimeoutError as error:
        raise AIProviderError(
            "AI 起草失败：模型调用超时。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory="timeout",
                selectionCount=len(selections),
            ),
        ) from error
    except HTTPError as error:
        diagnostics = _parse_http_error(error)
        failure_category = "rate_limited" if error.code == 429 else "provider_error"
        raise AIProviderError(
            "AI 起草失败：模型服务暂时不可用。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory=failure_category,
                selectionCount=len(selections),
                **diagnostics,
            ),
        ) from error
    except (URLError, OSError) as error:
        raise AIProviderError(
            "AI 起草失败：模型服务暂时不可用。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_provider_unavailable",
                failureCategory="provider_error",
                selectionCount=len(selections),
            ),
        ) from error
    except json.JSONDecodeError as error:
        raise AIResponseError(
            "AI 起草结果不可用。",
            trace=_timed_trace(
                config,
                trace_context,
                started_at=started_at,
                started_clock=started_clock,
                status="failed",
                failureCode="ai_response_invalid",
                failureCategory="invalid_response",
                selectionCount=len(selections),
            ),
        ) from error

    content = _extract_response_content(
        payload,
        error_message="AI 起草结果不可用。",
        config=config,
        trace_context=trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )
    sections = _normalize_daily_report_sections(
        content,
        len(selections),
        config,
        trace_context,
        started_at=started_at,
        started_clock=started_clock,
    )
    return AIDailyReportResult(
        sections=sections,
        trace=_timed_trace(
            config,
            trace_context,
            started_at=started_at,
            started_clock=started_clock,
            status="succeeded",
            failureCategory=None,
            providerResponseId=payload.get("id"),
            selectionCount=len(selections),
        ),
    )


def _invoke_daily_report_provider(
    selections: list[dict[str, object]],
    config: AIConfig,
    trace_context: dict[str, object] | None,
) -> AIDailyReportResult:
    retry_history: list[dict[str, object]] = []

    for attempt_number in range(1, config.max_retries + 2):
        attempt_context = _with_attempt_context(
            trace_context,
            attempt_number=attempt_number,
            max_retries=config.max_retries,
        )
        try:
            result = _invoke_daily_report_provider_once(selections, config, attempt_context)
            return AIDailyReportResult(
                sections=result.sections,
                trace=_finalize_trace(result.trace, retry_history, config.max_retries),
            )
        except AIProcessingError as error:
            if not _should_retry(error, attempt_number=attempt_number, max_retries=config.max_retries):
                error.trace = _finalize_trace(error.trace, retry_history, config.max_retries)
                raise

            retry_attempt = len(retry_history) + 1
            next_delay_ms = _calculate_retry_delay_ms(config.retry_base_ms, retry_attempt)
            retry_history.append(
                {
                    "retryAttempt": retry_attempt,
                    "attemptNumber": attempt_number,
                    "failureCategory": error.trace.get("failureCategory"),
                    "durationMs": error.trace.get("durationMs"),
                    "finishedAt": error.trace.get("finishedAt"),
                    "nextDelayMs": next_delay_ms,
                }
            )
            sleep(next_delay_ms / 1000)

    raise RuntimeError("unreachable")


def generate_international_daily_report_with_trace(
    selections: list[dict[str, object]],
    *,
    trace_context: dict[str, object] | None = None,
) -> AIDailyReportResult:
    config = load_ai_config()

    if config.provider == "fail":
        started_at = _utc_now()
        started_clock = perf_counter()
        raise AIProviderError(
            "AI 起草失败。",
            trace=_finalize_trace(
                _timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="failed",
                    failureCode="ai_provider_unavailable",
                    failureCategory="provider_error",
                    selectionCount=len(selections),
                ),
                [],
                config.max_retries,
            ),
        )

    if config.provider == "stub":
        started_at = _utc_now()
        started_clock = perf_counter()
        return AIDailyReportResult(
            sections=_stub_daily_report_sections(selections),
            trace=_finalize_trace(
                _timed_trace(
                    config,
                    trace_context,
                    started_at=started_at,
                    started_clock=started_clock,
                    status="succeeded",
                    failureCategory=None,
                    selectionCount=len(selections),
                ),
                [],
                config.max_retries,
            ),
        )

    return _invoke_daily_report_provider(selections, config, trace_context)
