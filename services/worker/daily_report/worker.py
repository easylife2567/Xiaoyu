#!/usr/bin/env python3
"""CLI entry point for daily-report worker commands."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from drafting import execute_draft_command
from exporting import execute_export_command

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

    args = parser.parse_args()

    if args.command == "draft":
        result = execute_draft_command(args)
    elif args.command == "export":
        result = execute_export_command(args)
    else:
        raise SystemExit(f"Unknown command: {args.command}")

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()