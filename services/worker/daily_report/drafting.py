"""Drafting routines for the daily report worker."""

from __future__ import annotations

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from services.worker.shared.ai import (
    AIProcessingError,
    generate_international_daily_report_with_trace,
)


def _parse_selections(raw_selections: list[str]) -> list[dict]:
    selections = []
    for raw in raw_selections:
        try:
            selections.append(json.loads(raw))
        except json.JSONDecodeError as error:
            raise SystemExit(f"Invalid selection JSON: {error}") from error
    return selections


def execute_draft_command(args) -> dict:
    selections = _parse_selections(args.selection)
    if len(selections) < 1:
        return {
            "ok": False,
            "code": "no_selections",
            "message": "至少需要 1 条候选选择。",
            "failureCategory": "validation_failure",
            "retriable": False,
            "aiCalls": [],
            "events": [],
        }

    try:
        result = generate_international_daily_report_with_trace(
            selections,
            trace_context={
                "taskId": args.task_id,
                "attemptId": args.attempt_id,
                "kind": "draft",
                "selectionCount": len(selections),
            },
        )
    except AIProcessingError as error:
        return {
            "ok": False,
            "code": error.code,
            "message": str(error),
            "failureCategory": error.trace.get("failureCategory") if error.trace else "ai_failure",
            "retriable": error.retriable,
            "aiCalls": [error.trace] if error.trace else [],
            "events": [
                {
                    "type": "draft_ai_failed",
                    "createdAt": error.trace.get("finishedAt") if error.trace else None,
                    "detail": {
                        "failureCategory": error.trace.get("failureCategory") if error.trace else None,
                    },
                }
            ],
        }

    return {
        "ok": True,
        "sections": result.sections,
        "summary": {
            "draftGenerated": True,
            "sectionCount": len(result.sections),
        },
        "aiCalls": [result.trace],
        "events": [
            {
                "type": "draft_ai_completed",
                "createdAt": result.trace.get("finishedAt"),
                "detail": {
                    "sectionCount": len(result.sections),
                    "durationMs": result.trace.get("durationMs"),
                },
            }
        ],
    }