from __future__ import annotations

from dataclasses import dataclass


DEFAULT_FALLBACK_SUMMARY = "该条内容涉及敏感公共舆情，建议人工复核"
SENSITIVE_CONTENT_ISSUE_CODE = "sensitive_content_fallback"


@dataclass(frozen=True)
class SensitiveContentMatch:
    category: str
    reason: str
    fallback_summary: str = DEFAULT_FALLBACK_SUMMARY


SENSITIVE_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    (
        "sensitive_political_expression",
        (
            "打倒共产党",
            "打倒司法",
            "推翻共产党",
            "推翻政府",
            "共产党下台",
        ),
    ),
    (
        "sensitive_collective_rights_defense",
        (
            "集体维权",
            "业主维权",
            "高喊口号维权",
            "群体抗议",
        ),
    ),
)


def detect_sensitive_content(text: str) -> SensitiveContentMatch | None:
    normalized = text.strip()
    if not normalized:
        return None

    for category, patterns in SENSITIVE_PATTERNS:
        for pattern in patterns:
            if pattern in normalized:
                return SensitiveContentMatch(
                    category=category,
                    reason=f"命中敏感内容规则：{pattern}",
                )

    return None


def build_sensitive_issue(*, sheet: str, row: int, match: SensitiveContentMatch) -> dict[str, object]:
    return {
        "sheet": sheet,
        "row": row,
        "code": SENSITIVE_CONTENT_ISSUE_CODE,
        "message": f"该行{match.reason}，已使用模板摘要并建议人工复核。",
        "category": match.category,
        "requiresHumanReview": True,
        "blocking": False,
    }
