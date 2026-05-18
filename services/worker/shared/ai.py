"""Shared AI provider seam for worker-side generation."""

from __future__ import annotations

import os


def generate_chinese_summary(text: str) -> str:
    provider = os.getenv("XIAOYU_AI_PROVIDER", "openai")
    lowered = text.lower()

    if provider == "fail":
        raise RuntimeError("AI 摘要生成失败，请稍后重试。")

    if provider == "stub":
        if "taiwan" in lowered or "台湾" in text:
            return "内容涉及台湾议题"
        if any(term in lowered for term in ("wage arrears", "unpaid wages")) or any(
            term in text for term in ("欠薪", "讨薪", "拖欠工资")
        ):
            return "内容涉及欠薪讨薪"
        if "robot marathon" in lowered:
            return "北京举行机器人马拉松"
        return "该条内容涉及外文事件报道"

    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("AI 摘要生成失败：未配置可用的模型凭据。")

    # Production adapters attach here later without changing workflow code.
    raise RuntimeError("AI 摘要生成失败：当前尚未配置生产模型适配器。")
