"""RSS-based candidate pool collector for the daily report worker.

实现 build-candidate-pool-real-collector(2026-06-18)的 worker 侧:
读取 sources/<workflowSlug>.json,逐 feed 拉取、规范化、去重、按时效过滤,
最后写出与 fixture provider 同 schema 的 <issueDate>.json 文件,
candidate 上 sourceType='rss' 用于审计。

设计依据见 [openspec/changes/.../design.md](../../../openspec/changes/2026-06-18-build-candidate-pool-real-collector/design.md)
R3-R7。本模块只对外暴露 execute_collect_command(args, *, fixture_root, ...);
所有内部辅助函数都以 _ 开头,便于在 tests/test_collect.py 里 monkeypatch。
"""

from __future__ import annotations

import calendar
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))


# ---- 错误码 -----------------------------------------------------------------

ERR_SOURCE_CONFIG_MISSING = "source_config_missing"
ERR_SOURCE_CONFIG_INVALID = "source_config_invalid"
ERR_TARGET_ALREADY_EXISTS = "target_already_exists"
ERR_NO_FEEDS_SUCCEEDED = "no_feeds_succeeded"
ERR_INVALID_WORKFLOW = "invalid_workflow"


# ---- 配置加载 ---------------------------------------------------------------

def _resolve_sources_dir() -> Path:
    return Path(__file__).resolve().parent / "sources"


def _load_source_config(workflow_slug: str) -> dict:
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", workflow_slug or ""):
        raise CollectError(ERR_INVALID_WORKFLOW, f"workflowSlug 不合法: {workflow_slug!r}")

    config_path = _resolve_sources_dir() / f"{workflow_slug}.json"
    if not config_path.exists():
        raise CollectError(
            ERR_SOURCE_CONFIG_MISSING,
            f"未找到源配置: {config_path}",
            details={"path": str(config_path)},
        )

    try:
        raw = json.loads(config_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise CollectError(
            ERR_SOURCE_CONFIG_INVALID,
            f"源配置不是合法 JSON: {config_path}: {exc}",
            details={"path": str(config_path)},
        ) from exc

    if not isinstance(raw, dict):
        raise CollectError(ERR_SOURCE_CONFIG_INVALID, "源配置必须是 JSON 对象")
    if raw.get("workflowSlug") != workflow_slug:
        raise CollectError(
            ERR_SOURCE_CONFIG_INVALID,
            f"workflowSlug 不匹配:配置={raw.get('workflowSlug')!r}, 入参={workflow_slug!r}",
        )
    feeds = raw.get("feeds")
    if not isinstance(feeds, list) or not feeds:
        raise CollectError(ERR_SOURCE_CONFIG_INVALID, "feeds 必须是非空数组")
    for index, feed in enumerate(feeds):
        if not isinstance(feed, dict):
            raise CollectError(ERR_SOURCE_CONFIG_INVALID, f"feeds[{index}] 必须是对象")
        for required in ("name", "url"):
            if not feed.get(required):
                raise CollectError(
                    ERR_SOURCE_CONFIG_INVALID,
                    f"feeds[{index}] 缺少必填字段 {required}",
                )
        kind = feed.get("kind", "rss")
        if kind != "rss":
            # R8 留的扩展点,首期只实现 rss
            raise CollectError(
                ERR_SOURCE_CONFIG_INVALID,
                f"feeds[{index}].kind={kind!r} 暂未实现,首期仅支持 'rss'",
            )

    return {
        "workflowSlug": workflow_slug,
        "recencyHours": int(raw.get("recencyHours", 24) or 24),
        "minCandidates": int(raw.get("minCandidates", 6) or 6),
        "feeds": feeds,
    }


# ---- 错误类型 ---------------------------------------------------------------

class CollectError(Exception):
    """Structured error surfaced as ok=False in stdout payload."""

    def __init__(self, code: str, message: str, *, details: Optional[dict] = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}


# ---- Fetch & normalize -------------------------------------------------------

# feedparser 在模块顶层 import 会让 tests/ 在 mock 阶段难以替换;改为 lazy import。
def _import_feedparser():
    try:
        import feedparser  # type: ignore[import-not-found]
    except ImportError as exc:
        raise CollectError(
            ERR_NO_FEEDS_SUCCEEDED,
            "未安装 feedparser;请在 worker 环境运行 pip install -r services/worker/requirements.txt",
        ) from exc
    return feedparser


def _fetch_feed(feed: dict, *, timeout: int, user_agent: str) -> tuple[list, list[str]]:
    """拉取单个 feed,返回 (entries, errors)。任何异常都吞掉转 errors。"""
    feedparser = _import_feedparser()
    errors: list[str] = []
    try:
        # feedparser 不直接支持 timeout 参数,通过环境内 socket 默认值控制
        # 改为提前 setdefaulttimeout——只在本调用临时生效,不污染全局。
        import socket
        prev_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(timeout)
        try:
            parsed = feedparser.parse(
                feed["url"],
                request_headers={"User-Agent": user_agent},
            )
        finally:
            socket.setdefaulttimeout(prev_timeout)
    except Exception as exc:  # pragma: no cover — network defensive
        errors.append(f"fetch 异常: {exc!r}")
        return [], errors

    # feedparser 的 bozo 标记格式错误;但若 entries 仍非空,容忍 bozo。
    entries = list(getattr(parsed, "entries", []) or [])
    if not entries:
        if getattr(parsed, "bozo", 0):
            bozo_exc = getattr(parsed, "bozo_exception", None)
            errors.append(f"feed 解析失败: {bozo_exc!r}")
        else:
            errors.append("feed 返回 0 条 entry")
    return entries, errors


_HTML_TAG_RE = re.compile(r"<[^>]+>")
_WHITESPACE_RE = re.compile(r"\s+")


def _strip_html(value: str) -> str:
    if not value:
        return ""
    return _WHITESPACE_RE.sub(" ", _HTML_TAG_RE.sub("", value)).strip()


def _to_iso_utc(struct_time) -> Optional[str]:
    """把 feedparser 给的 time.struct_time(UTC)转 ISO-8601 字符串。"""
    if struct_time is None:
        return None
    try:
        epoch = calendar.timegm(struct_time)
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%S.000Z"
    )


def _entry_published_iso(entry) -> Optional[str]:
    """优先 published_parsed,fallback 到 updated_parsed(Atom feed)。"""
    pub = entry.get("published_parsed") or entry.get("updated_parsed")
    return _to_iso_utc(pub)


def _summary_text(entry) -> str:
    raw = entry.get("summary") or entry.get("description") or ""
    text = _strip_html(raw)
    if len(text) > 300:
        text = text[:297] + "..."
    return text


_TRACKING_PARAM_PREFIXES = ("utm_",)
_TRACKING_PARAM_NAMES = {"fbclid", "gclid", "ref", "ref_src", "ref_url", "spm"}


def _canonicalize_url(url: str) -> str:
    """规范化 URL:lowercase host、去 fragment、去跟踪参数。"""
    if not url:
        return ""
    parts = urlsplit(url.strip())
    host = parts.hostname.lower() if parts.hostname else ""
    netloc = host
    if parts.port:
        netloc = f"{host}:{parts.port}"
    query_pairs = [
        (k, v)
        for (k, v) in parse_qsl(parts.query, keep_blank_values=True)
        if not (k.startswith(_TRACKING_PARAM_PREFIXES) or k in _TRACKING_PARAM_NAMES)
    ]
    query = urlencode(query_pairs)
    # path 保留大小写(部分站点 case-sensitive),但去掉尾部多余斜杠
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower() or "https", netloc, path, query, ""))


def _title_fingerprint(title: str) -> str:
    """title 指纹:lowercase、去标点、取前 80 字符 sha1 前 12。"""
    cleaned = re.sub(r"\W+", "", (title or "").lower(), flags=re.UNICODE)[:80]
    return hashlib.sha1(cleaned.encode("utf-8")).hexdigest()[:12]


def _normalize_entry(entry, *, feed: dict, collected_at_iso: str) -> Optional[dict]:
    """把 feedparser entry 映射成 candidate dict。pubDate 解析失败返回 None。"""
    title = (entry.get("title") or "").strip()
    link = (entry.get("link") or "").strip()
    if not title or not link:
        return None
    published_at = _entry_published_iso(entry)
    if not published_at:
        # R4: pubDate 缺失或不可解析 → 直接丢
        return None
    return {
        "title": title,
        "sourceName": feed["name"],
        "sourceUrl": link,
        "publishedAt": published_at,
        "summary": _summary_text(entry),
        "retrievalMetadata": {
            "collectedAt": collected_at_iso,
            "language": feed.get("language", "en"),
            "feedUrl": feed["url"],
        },
        # 规范化结果在去重 / 排序阶段使用,最终写文件前会被丢弃
        "_canonicalUrl": _canonicalize_url(link),
        "_titleFingerprint": _title_fingerprint(title),
    }


def _filter_recent(items: list[dict], *, recency_hours: int, anchor: datetime) -> list[dict]:
    cutoff = anchor - timedelta(hours=recency_hours)
    kept = []
    for item in items:
        try:
            pub = datetime.strptime(item["publishedAt"], "%Y-%m-%dT%H:%M:%S.000Z").replace(
                tzinfo=timezone.utc
            )
        except (KeyError, ValueError):
            continue
        if pub >= cutoff:
            kept.append(item)
    return kept


def _dedupe(items: list[dict]) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for item in items:
        key = (item["_canonicalUrl"], item["_titleFingerprint"])
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def _sort_by_recency(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda x: x.get("publishedAt", ""), reverse=True)


# ---- Output -----------------------------------------------------------------

def _resolve_fixture_root(override: Optional[str]) -> Path:
    if override:
        return Path(override).resolve()
    env = os.environ.get("XIAOYU_DAILY_REPORT_FIXTURE_ROOT")
    if env:
        return Path(env).resolve()
    return PROJECT_ROOT / ".data/daily-report/fixtures"


def _build_payload(
    *,
    workflow_slug: str,
    issue_date: str,
    candidates: list[dict],
    generated_at_iso: str,
) -> dict:
    final_candidates = []
    for index, raw in enumerate(candidates):
        cleaned = {k: v for k, v in raw.items() if not k.startswith("_")}
        cleaned["id"] = f"{_id_prefix(workflow_slug)}-{issue_date}-{index + 1:03d}"
        cleaned["sourceType"] = "rss"
        # 字段顺序对齐既有 fixture(便于 git diff 阅读)
        ordered = {
            "id": cleaned["id"],
            "sourceType": cleaned["sourceType"],
            "title": cleaned["title"],
            "sourceName": cleaned["sourceName"],
            "sourceUrl": cleaned["sourceUrl"],
            "publishedAt": cleaned["publishedAt"],
            "summary": cleaned["summary"],
            "retrievalMetadata": cleaned["retrievalMetadata"],
        }
        final_candidates.append(ordered)
    return {
        "workflowSlug": workflow_slug,
        "issueDate": issue_date,
        "generatedAt": generated_at_iso,
        "sourceType": "collected",
        "candidates": final_candidates,
    }


def _id_prefix(workflow_slug: str) -> str:
    """与既有 fixture 保持一致(intl-* 等)。"""
    return {
        "international-daily-report": "intl",
    }.get(workflow_slug, workflow_slug)


def _write_fixture(*, payload: dict, fixture_root: Path, force: bool) -> Path:
    target_dir = fixture_root / payload["workflowSlug"]
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / f"{payload['issueDate']}.json"
    if target_path.exists() and not force:
        raise CollectError(
            ERR_TARGET_ALREADY_EXISTS,
            f"目标 fixture 已存在: {target_path}(传 --force 覆盖)",
            details={"path": str(target_path)},
        )
    target_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return target_path


# ---- 顶层入口 ---------------------------------------------------------------

def execute_collect_command(args) -> dict:
    workflow_slug = args.workflow
    issue_date = args.date or _today_iso_local()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", issue_date or ""):
        return _fail(ERR_INVALID_WORKFLOW, f"--date 必须为 YYYY-MM-DD,收到 {issue_date!r}")

    timeout = max(1, int(getattr(args, "timeout", 0) or os.environ.get("XIAOYU_DAILY_REPORT_COLLECTOR_TIMEOUT_SECONDS", 15) or 15))
    user_agent = (
        os.environ.get("XIAOYU_DAILY_REPORT_COLLECTOR_USER_AGENT")
        or "xiaoyu-daily-report/0.1"
    )

    try:
        config = _load_source_config(workflow_slug)
    except CollectError as err:
        return _fail(err.code, str(err), err.details)

    now_utc = datetime.now(tz=timezone.utc)
    collected_at_iso = now_utc.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    generated_at_iso = now_utc.replace(
        hour=1, minute=30, second=0, microsecond=0
    ).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    feed_reports: list[dict] = []
    all_items: list[dict] = []
    succeeded_feed_count = 0

    for feed in config["feeds"]:
        entries, errors = _fetch_feed(feed, timeout=timeout, user_agent=user_agent)
        kept_for_feed = 0
        for entry in entries:
            normalized = _normalize_entry(entry, feed=feed, collected_at_iso=collected_at_iso)
            if normalized:
                all_items.append(normalized)
                kept_for_feed += 1
        if entries and not errors:
            succeeded_feed_count += 1
        feed_reports.append({
            "name": feed["name"],
            "url": feed["url"],
            "fetched": len(entries),
            "kept": kept_for_feed,
            "errors": errors or None,
        })

    if succeeded_feed_count == 0:
        return _fail(
            ERR_NO_FEEDS_SUCCEEDED,
            "全部 feed 拉取失败,未写入 fixture",
            {"feedReports": feed_reports},
        )

    deduped = _dedupe(all_items)
    recent = _filter_recent(
        deduped,
        recency_hours=config["recencyHours"],
        anchor=now_utc,
    )
    ordered = _sort_by_recency(recent)

    warnings: list[str] = []
    if len(ordered) < config["minCandidates"]:
        warnings.append(
            f"insufficient_candidates: 实得 {len(ordered)} 条,minCandidates={config['minCandidates']}"
        )

    fixture_root = _resolve_fixture_root(getattr(args, "fixture_root", None))
    payload = _build_payload(
        workflow_slug=workflow_slug,
        issue_date=issue_date,
        candidates=ordered,
        generated_at_iso=generated_at_iso,
    )
    try:
        target_path = _write_fixture(
            payload=payload,
            fixture_root=fixture_root,
            force=bool(getattr(args, "force", False)),
        )
    except CollectError as err:
        return _fail(err.code, str(err), err.details)

    return {
        "ok": True,
        "workflowSlug": workflow_slug,
        "issueDate": issue_date,
        "written": str(target_path),
        "candidateCount": len(ordered),
        "feedReports": feed_reports,
        "warnings": warnings or None,
    }


def _fail(code: str, message: str, details: Optional[dict] = None) -> dict:
    return {
        "ok": False,
        "code": code,
        "message": message,
        "details": details or {},
    }


def _today_iso_local() -> str:
    """与 web 侧 candidate-pool/index.js 的 todayInLocalTimeZone 对齐(本地时区)。"""
    now = datetime.now()
    return f"{now.year:04d}-{now.month:02d}-{now.day:02d}"
