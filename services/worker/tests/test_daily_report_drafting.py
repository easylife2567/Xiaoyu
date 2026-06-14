"""Tests for daily-report drafting logic."""

import json
import os
import sys
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from services.worker.shared.ai import (
    AIDailyReportResult,
    AIConfigurationError,
    AIProcessingError,
    generate_international_daily_report_with_trace,
    _stub_daily_report_sections,
    _build_daily_report_user_prompt,
)
from services.worker.daily_report.drafting import execute_draft_command


@pytest.fixture(autouse=True)
def _set_stub_provider():
    os.environ["XIAOYU_AI_PROVIDER"] = "stub"
    yield
    os.environ.pop("XIAOYU_AI_PROVIDER", None)


def test_stub_returns_sections():
    selections = [
        {"title": "G7 AI framework", "sourceName": "Reuters", "summary": "Consensus reached"},
        {"title": "EU AI act phase 2", "sourceName": "FT", "summary": "Accountability checklist"},
    ]
    result = generate_international_daily_report_with_trace(selections)
    assert isinstance(result, AIDailyReportResult)
    assert len(result.sections) == 2
    assert result.sections[0]["index"] == 1
    assert result.sections[1]["index"] == 2


def test_stub_sections_contain_source():
    selections = [{"title": "Test title", "sourceName": "TestSource", "summary": "Test summary"}]
    result = generate_international_daily_report_with_trace(selections)
    assert "TestSource" in result.sections[0]["body"]


def test_stub_sections_follow_daily_report_sentence_pattern():
    selections = [
        {
            "title": "Test title",
            "sourceName": "联合早报",
            "publishedAt": "2026-06-02T00:00:00.000Z",
            "summary": "测试新闻摘要。",
        }
    ]
    result = generate_international_daily_report_with_trace(selections)
    assert result.sections[0]["body"].startswith("6月2日，据联合早报报道，")
    assert not result.sections[0]["body"].startswith("一、")
    assert not result.sections[0]["body"].startswith("1.")


def test_build_prompt_includes_selection_data():
    selections = [{"title": "Climate summit", "sourceName": "Guardian", "summary": "Carbon negative"}]
    prompt = _build_daily_report_user_prompt(selections)
    assert "Climate summit" in prompt
    assert "Guardian" in prompt


def test_fail_provider_raises():
    os.environ["XIAOYU_AI_PROVIDER"] = "fail"
    with pytest.raises(AIProcessingError):
        generate_international_daily_report_with_trace([{"title": "X"}])


def test_execute_draft_command_returns_ok():
    class Args:
        task_id = "test-task"
        attempt_id = "test-attempt"
        selection = [
            json.dumps({"title": "G7", "sourceName": "R", "summary": "S"}),
            json.dumps({"title": "EU", "sourceName": "F", "summary": "S"}),
        ]

    result = execute_draft_command(Args())
    assert result["ok"] is True
    assert len(result["sections"]) == 2
    assert result["summary"]["sectionCount"] == 2
