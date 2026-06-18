#!/usr/bin/env python3
"""CLI entry point for daily-report worker commands."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from drafting import execute_draft_command
from exporting import execute_export_command
from collect import execute_collect_command

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))


def main() -> None:
    parser = argparse.ArgumentParser(description="Daily report worker")
    sub = parser.add_subparsers(dest="command")

    draft_parser = sub.add_parser("draft")
    draft_parser.add_argument("--task-id", required=True)
    draft_parser.add_argument("--attempt-id", required=True)
    draft_parser.add_argument("--selection", action="append", default=[], help="JSON of one selection's candidateSnapshot")

    export_parser = sub.add_parser("export")
    export_parser.add_argument("--task-id", required=True)
    export_parser.add_argument("--attempt-id", required=True)
    export_parser.add_argument("--issue-date", required=True)
    export_parser.add_argument("--issue-number", required=True)
    export_parser.add_argument("--docx-object-key", required=True)
    export_parser.add_argument("--xlsx-object-key", required=True)
    export_parser.add_argument("--sections-json", required=True)
    export_parser.add_argument("--selection", action="append", default=[])

    collect_parser = sub.add_parser("collect")
    collect_parser.add_argument("--workflow", required=True, help="workflow slug, e.g. international-daily-report")
    collect_parser.add_argument("--date", default=None, help="YYYY-MM-DD, 默认今天")
    collect_parser.add_argument("--force", action="store_true", help="覆盖已存在的目标 fixture")
    collect_parser.add_argument("--fixture-root", dest="fixture_root", default=None,
                                help="覆盖 fixture 写入根目录;不传读 XIAOYU_DAILY_REPORT_FIXTURE_ROOT 或仓库默认")
    collect_parser.add_argument("--timeout", type=int, default=0,
                                help="单 feed HTTP 超时秒数,默认走环境变量或 15")

    args = parser.parse_args()

    if args.command == "draft":
        result = execute_draft_command(args)
    elif args.command == "export":
        result = execute_export_command(args)
    elif args.command == "collect":
        result = execute_collect_command(args)
    else:
        raise SystemExit(f"Unknown command: {args.command}")

    print(json.dumps(result, ensure_ascii=False))
    if isinstance(result, dict) and result.get("ok") is False:
        sys.exit(2)


if __name__ == "__main__":
    main()