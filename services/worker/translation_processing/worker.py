#!/usr/bin/env python3
"""CLI entry point for translation-processing worker commands."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from openpyxl import load_workbook

from constants import REQUIRED_HEADERS, SUPPORTED_SUFFIXES

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from services.worker.shared.ai import generate_chinese_summary


def validate_workbook(input_path: Path) -> dict:
    if input_path.suffix.lower() not in SUPPORTED_SUFFIXES:
        return {
            "ok": False,
            "code": "invalid_file_type",
            "message": "仅支持 .xlsx 或 .xlsm Excel 工作簿。",
        }

    workbook = load_workbook(input_path, read_only=True, data_only=False)
    processable_sheets = []
    source_rows = 0

    for worksheet in workbook.worksheets:
        headers = [worksheet.cell(1, column).value for column in range(1, worksheet.max_column + 1)]
        if all(header in headers for header in REQUIRED_HEADERS):
            processable_sheets.append(worksheet.title)
            source_index = headers.index("发表内容") + 1
            for row_index in range(2, worksheet.max_row + 1):
                value = worksheet.cell(row_index, source_index).value
                if isinstance(value, str) and value.strip():
                    source_rows += 1

    if not processable_sheets:
        return {
            "ok": False,
            "code": "invalid_workbook_structure",
            "message": "缺少可处理的工作表：需要同时包含“发表内容”“研究内容”“分类”列。",
        }

    if source_rows == 0:
        return {
            "ok": False,
            "code": "invalid_workbook_content",
            "message": "未发现可处理的正文内容。",
        }

    return {
        "ok": True,
        "processableSheets": processable_sheets,
        "sourceRows": source_rows,
        "message": "文件已通过校验，可以开始处理。",
    }


def classify(text: str, sheet_name: str) -> str:
    lowered = text.lower()
    if "taiwan" in lowered or "台湾" in text:
        return "台湾问题"
    if any(term in lowered for term in ("wage arrears", "unpaid wages")) or any(
        term in text for term in ("欠薪", "讨薪", "拖欠工资")
    ):
        return "欠薪讨薪相关"
    if any(term in lowered for term in ("netizen", "mocked", "satirized", "commented")) or any(
        term in text for term in ("网友", "吐槽", "评论", "嘲讽")
    ):
        return "国外网友言论" if sheet_name != "DFY官方" else "国内网友言论"
    if any(term in lowered for term in ("school", "gaokao", "student", "education")) or "高考" in text:
        return "教育相关"
    if any(term in lowered for term in ("company", "factory", "market", "economy")):
        return "经济相关"
    return "社会问题"


def process_workbook(input_path: Path, output_path: Path) -> dict:
    workbook = load_workbook(input_path)
    issues = []
    processed_rows = 0
    generated_summaries = 0
    classified_rows = 0

    for worksheet in workbook.worksheets:
        headers = [worksheet.cell(1, column).value for column in range(1, worksheet.max_column + 1)]
        if not all(header in headers for header in REQUIRED_HEADERS):
            continue

        source_column = headers.index("发表内容") + 1
        summary_column = headers.index("研究内容") + 1
        classification_column = headers.index("分类") + 1

        for row_index in range(2, worksheet.max_row + 1):
            source_text = worksheet.cell(row_index, source_column).value
            if not isinstance(source_text, str) or not source_text.strip():
                continue

            try:
                summary = generate_chinese_summary(source_text)
                classification = classify(source_text, worksheet.title)
            except RuntimeError as error:
                return {
                    "ok": False,
                    "code": "ai_provider_unavailable",
                    "message": str(error),
                    "retriable": True,
                }

            worksheet.cell(row_index, summary_column).value = summary
            worksheet.cell(row_index, classification_column).value = classification
            processed_rows += 1
            generated_summaries += 1
            classified_rows += 1

            if not summary or not classification:
                issues.append(
                    {
                        "sheet": worksheet.title,
                        "row": row_index,
                        "message": "未能生成完整摘要或分类。",
                    }
                )

    if issues:
        return {
            "ok": False,
            "code": "output_validation_failed",
            "message": "结果校验失败：存在未完成的摘要或分类。",
            "issues": issues,
            "retriable": True,
        }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    workbook.save(output_path)
    return {
        "ok": True,
        "summary": {
            "processedRows": processed_rows,
            "generatedSummaries": generated_summaries,
            "classifiedRows": classified_rows,
            "issueCount": 0,
            "issues": [],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["validate", "process"])
    parser.add_argument("--input", required=True)
    parser.add_argument("--output")
    parser.add_argument("--task-id")
    parser.add_argument("--attempt-id")
    args = parser.parse_args()

    if args.command == "validate":
        print(json.dumps(validate_workbook(Path(args.input)), ensure_ascii=False))
        return

    if args.command == "process":
        if not args.output:
            raise SystemExit("--output is required for process")
        result = process_workbook(Path(args.input), Path(args.output))
        result["taskId"] = args.task_id
        result["attemptId"] = args.attempt_id
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
