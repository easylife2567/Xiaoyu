"""Tests for daily-report candidate-pool collector (build-candidate-pool-real-collector)."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.append(str(PROJECT_ROOT))

from services.worker.daily_report import collect


# ---- helpers ---------------------------------------------------------------

def _write_config(tmp_path: Path, *, slug: str = "demo-daily-report", feeds=None,
                  recency_hours: int = 24, min_candidates: int = 3) -> Path:
    sources_dir = tmp_path / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "workflowSlug": slug,
        "recencyHours": recency_hours,
        "minCandidates": min_candidates,
        "feeds": feeds if feeds is not None else [
            {"name": "Demo Feed", "url": "https://example.com/rss", "language": "en", "kind": "rss"},
        ],
    }
    config_path = sources_dir / f"{slug}.json"
    config_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return config_path


def _stub_feedparser(routes: dict):
    """构造一个对象,parse(url, ...) 返回 routes[url] 或抛异常。

    routes 形如:
      {
        "https://example.com/rss": _make_parsed(entries=[...]),
        "https://broken.example.com/rss": _make_parsed(entries=[], bozo=1),
        "https://throws.example.com/rss": Exception("boom"),
      }
    """

    class _Stub:
        def parse(self, url, request_headers=None):
            value = routes.get(url)
            if isinstance(value, Exception):
                raise value
            return value

    return _Stub()


def _make_parsed(*, entries=None, bozo=0):
    return SimpleNamespace(
        entries=entries or [],
        bozo=bozo,
        bozo_exception=ValueError("malformed") if bozo else None,
    )


def _make_entry(*, title, link, when=None, summary="some summary", atom=False):
    """when=datetime, 默认现在;atom=True 则只填 updated 字段。"""
    when = when or datetime.now(tz=timezone.utc)
    struct = when.utctimetuple()
    if atom:
        return {
            "title": title,
            "link": link,
            "summary": summary,
            "updated_parsed": struct,
            "updated": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    return {
        "title": title,
        "link": link,
        "summary": summary,
        "published_parsed": struct,
        "published": when.strftime("%a, %d %b %Y %H:%M:%S +0000"),
    }


def _args(workflow="demo-daily-report", date="2026-06-18", *, force=True, fixture_root=None):
    return SimpleNamespace(
        workflow=workflow,
        date=date,
        force=force,
        fixture_root=str(fixture_root) if fixture_root else None,
        timeout=8,
    )


@pytest.fixture
def isolated_collector(tmp_path, monkeypatch):
    """让 collect 的 sources 目录与 fixture 输出都指向 tmp_path。"""
    fixture_root = tmp_path / "fixtures"
    sources_dir = tmp_path / "sources"
    monkeypatch.setattr(collect, "_resolve_sources_dir", lambda: sources_dir)
    return SimpleNamespace(
        tmp=tmp_path,
        fixture_root=fixture_root,
        sources_dir=sources_dir,
    )


# ---- 正常路径 --------------------------------------------------------------

def test_happy_path_writes_fixture_with_rss_sourceType(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp, feeds=[
        {"name": "Demo RSS", "url": "https://example.com/rss", "language": "zh", "kind": "rss"},
        {"name": "Demo Atom", "url": "https://atom.example.com/rss", "language": "en", "kind": "rss"},
    ])
    routes = {
        "https://example.com/rss": _make_parsed(entries=[
            _make_entry(title="新闻 A", link="https://example.com/a"),
            _make_entry(title="新闻 B", link="https://example.com/b"),
        ]),
        "https://atom.example.com/rss": _make_parsed(entries=[
            _make_entry(title="News C", link="https://atom.example.com/c", atom=True),
        ]),
    }
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes))

    result = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))

    assert result["ok"] is True
    assert result["candidateCount"] == 3
    written = Path(result["written"])
    assert written.exists()

    payload = json.loads(written.read_text(encoding="utf-8"))
    assert payload["workflowSlug"] == "demo-daily-report"
    assert payload["sourceType"] == "collected"
    assert payload["issueDate"] == "2026-06-18"
    assert len(payload["candidates"]) == 3
    for index, candidate in enumerate(payload["candidates"]):
        assert candidate["sourceType"] == "rss"
        assert candidate["id"].startswith("demo-daily-report-2026-06-18-")
        assert candidate["id"].endswith(f"-{index + 1:03d}")
        assert candidate["retrievalMetadata"]["language"] in ("zh", "en")


# ---- 单 feed 失败容忍 --------------------------------------------------------

def test_single_feed_failure_does_not_abort_run(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp, feeds=[
        {"name": "Broken", "url": "https://broken.example.com/rss", "language": "en", "kind": "rss"},
        {"name": "Healthy", "url": "https://good.example.com/rss", "language": "en", "kind": "rss"},
    ])
    routes = {
        "https://broken.example.com/rss": RuntimeError("network down"),
        "https://good.example.com/rss": _make_parsed(entries=[
            _make_entry(title="ok", link="https://good.example.com/x"),
        ]),
    }
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes))

    result = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))

    assert result["ok"] is True
    assert result["candidateCount"] == 1
    broken_report = next(r for r in result["feedReports"] if r["name"] == "Broken")
    assert broken_report["errors"] is not None
    assert broken_report["fetched"] == 0


# ---- 全 feed 失败 -----------------------------------------------------------

def test_all_feeds_failed_returns_no_feeds_succeeded(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp, feeds=[
        {"name": "F1", "url": "https://f1.example.com/rss", "language": "en", "kind": "rss"},
        {"name": "F2", "url": "https://f2.example.com/rss", "language": "en", "kind": "rss"},
    ])
    routes = {
        "https://f1.example.com/rss": RuntimeError("down"),
        "https://f2.example.com/rss": _make_parsed(entries=[], bozo=1),
    }
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes))

    result = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))

    assert result["ok"] is False
    assert result["code"] == collect.ERR_NO_FEEDS_SUCCEEDED
    assert "feedReports" in result["details"]
    # 不应写入 fixture 文件
    target = isolated_collector.fixture_root / "demo-daily-report" / "2026-06-18.json"
    assert not target.exists()


# ---- 时效过滤 ---------------------------------------------------------------

def test_recency_filter_drops_old_and_undated_items(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp, recency_hours=24)
    now = datetime.now(tz=timezone.utc)
    too_old = now.replace(year=now.year - 1)
    routes = {
        "https://example.com/rss": _make_parsed(entries=[
            _make_entry(title="新", link="https://example.com/n", when=now),
            _make_entry(title="老", link="https://example.com/o", when=too_old),
            # pubDate 缺失 → normalize 阶段就被丢
            {"title": "无日期", "link": "https://example.com/x", "summary": ""},
        ]),
    }
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes))

    result = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))

    assert result["ok"] is True
    assert result["candidateCount"] == 1
    payload = json.loads(Path(result["written"]).read_text(encoding="utf-8"))
    assert payload["candidates"][0]["title"] == "新"


# ---- 去重 -------------------------------------------------------------------

def test_dedupe_by_canonical_url_and_title(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp, feeds=[
        {"name": "F1", "url": "https://f1.example.com/rss", "language": "en", "kind": "rss"},
        {"name": "F2", "url": "https://f2.example.com/rss", "language": "en", "kind": "rss"},
    ])
    routes = {
        "https://f1.example.com/rss": _make_parsed(entries=[
            _make_entry(title="同一事件", link="https://news.com/a?utm_source=feed&utm_medium=rss"),
        ]),
        "https://f2.example.com/rss": _make_parsed(entries=[
            # tracking 参数不同 / host case 不同,canonical 后是同 URL
            _make_entry(title="同一事件", link="https://NEWS.com/a/?gclid=abc"),
        ]),
    }
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes))

    result = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))

    assert result["ok"] is True
    assert result["candidateCount"] == 1


# ---- target_already_exists & --force ----------------------------------------

def test_target_already_exists_without_force_fails(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp)
    routes = {
        "https://example.com/rss": _make_parsed(entries=[
            _make_entry(title="A", link="https://example.com/a"),
        ]),
    }
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes))

    # 先跑一次 force=True 写入
    result1 = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))
    assert result1["ok"] is True

    # 第二次 force=False 应失败
    result2 = collect.execute_collect_command(_args(force=False, fixture_root=isolated_collector.fixture_root))
    assert result2["ok"] is False
    assert result2["code"] == collect.ERR_TARGET_ALREADY_EXISTS


def test_force_overwrites_existing_target(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp)
    routes_a = {"https://example.com/rss": _make_parsed(entries=[
        _make_entry(title="OLD", link="https://example.com/a"),
    ])}
    routes_b = {"https://example.com/rss": _make_parsed(entries=[
        _make_entry(title="NEW", link="https://example.com/b"),
    ])}

    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes_a))
    collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))

    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser(routes_b))
    r2 = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))
    assert r2["ok"] is True

    payload = json.loads(Path(r2["written"]).read_text(encoding="utf-8"))
    assert payload["candidates"][0]["title"] == "NEW"


# ---- 配置缺失 / 非法 workflow ------------------------------------------------

def test_missing_source_config(isolated_collector, monkeypatch):
    isolated_collector.sources_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser({}))
    result = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))
    assert result["ok"] is False
    assert result["code"] == collect.ERR_SOURCE_CONFIG_MISSING


def test_invalid_workflow_slug(isolated_collector, monkeypatch):
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser({}))
    result = collect.execute_collect_command(_args(workflow="Bad Slug!", fixture_root=isolated_collector.fixture_root))
    assert result["ok"] is False
    assert result["code"] == collect.ERR_INVALID_WORKFLOW


def test_invalid_date_format(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp)
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser({}))
    result = collect.execute_collect_command(_args(date="2026/06/18", fixture_root=isolated_collector.fixture_root))
    assert result["ok"] is False
    assert result["code"] == collect.ERR_INVALID_WORKFLOW


# ---- 配置 schema 校验 -------------------------------------------------------

def test_unsupported_kind_rejected(isolated_collector, monkeypatch):
    _write_config(isolated_collector.tmp, feeds=[
        {"name": "Scraper", "url": "https://example.com", "language": "en", "kind": "scraper"},
    ])
    monkeypatch.setattr(collect, "_import_feedparser", lambda: _stub_feedparser({}))
    result = collect.execute_collect_command(_args(fixture_root=isolated_collector.fixture_root))
    assert result["ok"] is False
    assert result["code"] == collect.ERR_SOURCE_CONFIG_INVALID
