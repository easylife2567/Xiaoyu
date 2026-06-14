"""Tests for daily-report export logic."""

import json
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from services.worker.daily_report.exporting import (
    ONE_PAGE_CHAR_BUDGET,
    execute_export_command,
    _validate_export,
)


SAMPLE_SECTIONS = [
    {"index": i, "title": f"标题 {i}", "body": f"正文 {i}。"}
    for i in range(1, 7)
]

SAMPLE_SELECTIONS = [
    {
        "title": f"候选 {i}",
        "sourceName": f"源 {i}",
        "sourceUrl": f"https://example.com/{i}",
        "publishedAt": "2026-06-11T00:00:00.000Z",
        "summary": f"摘要 {i}",
    }
    for i in range(1, 7)
]


class _Args:
    def __init__(
        self,
        *,
        task_id="test-task",
        attempt_id="test-attempt",
        issue_date="2026-06-12",
        issue_number="1",
        docx_object_key="test-task/国际日报-20260612-001.docx",
        xlsx_object_key="test-task/resource-pool-20260612.xlsx",
        sections=None,
        selections=None,
    ):
        self.task_id = task_id
        self.attempt_id = attempt_id
        self.issue_date = issue_date
        self.issue_number = issue_number
        self.docx_object_key = docx_object_key
        self.xlsx_object_key = xlsx_object_key
        self.sections_json = json.dumps(sections if sections is not None else SAMPLE_SECTIONS)
        self.selection = [json.dumps(s) for s in (selections if selections is not None else SAMPLE_SELECTIONS)]


def test_export_succeeds_with_valid_inputs():
    result = execute_export_command(_Args())
    assert result["ok"] is True
    assert result["validationReport"]["passed"] is True
    assert result["docx"]["sizeBytes"] > 0
    assert result["xlsx"]["sizeBytes"] > 0


def test_export_fails_on_bad_docx_name():
    result = execute_export_command(_Args(docx_object_key="test-task/bad-name.docx"))
    assert result["ok"] is False
    assert result["code"] == "export_validation_failed"
    assert any(
        c["code"] == "naming_rule" and c["scope"] == "docx_report" and not c["passed"]
        for c in result["validationReport"]["checks"]
    )


def test_export_fails_on_bad_xlsx_name():
    result = execute_export_command(_Args(xlsx_object_key="test-task/bad.xlsx"))
    assert result["ok"] is False
    assert any(
        c["code"] == "naming_rule" and c["scope"] == "resource_pool_xlsx" and not c["passed"]
        for c in result["validationReport"]["checks"]
    )


def test_export_fails_on_zero_issue_number():
    result = execute_export_command(
        _Args(
            issue_number="0",
            docx_object_key="test-task/国际日报-20260612-000.docx",
        )
    )
    assert result["ok"] is False
    assert any(
        c["code"] == "issue_number_match" and not c["passed"]
        for c in result["validationReport"]["checks"]
    )


def test_export_fails_on_one_page_overflow():
    huge_sections = [
        {"index": 1, "title": "超长", "body": "字" * (ONE_PAGE_CHAR_BUDGET + 100)},
    ]
    result = execute_export_command(_Args(sections=huge_sections))
    assert result["ok"] is False
    assert any(
        c["code"] == "one_page_budget" and not c["passed"]
        for c in result["validationReport"]["checks"]
    )


def test_validate_export_helper_directly():
    report = _validate_export(
        docx_target=Path("/tmp/国际日报-20260612-001.docx"),
        xlsx_target=Path("/tmp/resource-pool-20260612.xlsx"),
        issue_date="2026-06-12",
        issue_number=1,
        expected_issue_number=1,
        sections=SAMPLE_SECTIONS,
    )
    assert report["passed"] is True
    assert len(report["checks"]) == 4
