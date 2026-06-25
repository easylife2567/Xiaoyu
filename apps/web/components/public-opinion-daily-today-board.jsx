'use client'

/**
 * 「每日舆情」原始流总入口主组件 — daily-today board。
 *
 * 信息架构(单文件、内含子组件,与 polarity-board 同范式):
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ DailyTodayFilterBar      监测词 / 时间档 / 平台 chip /       │
 *   │                          搜索 / 更多筛选 / 刷新 / 导出       │
 *   ├────────────────────────────────────────────────────────────┤
 *   │ DailyTodayHistogramStrip 24 根柱 / hover tooltip / 点击      │
 *   │                          scrollTo;锚定当前视口的柱高亮       │
 *   ├────────────────────────────────────────────────────────────┤
 *   │ DailyTodayNewItemsBanner ↑ N 条新条目  [点击加载]            │
 *   ├────────────────────────────────────────────────────────────┤
 *   │ DailyTodayFeed           虚拟滚动(@tanstack/react-virtual) │
 *   │  ↳ DailyTodayFeedRow     单行 32-36px / checkbox / 命中高亮 │
 *   └────────────────────────────────────────────────────────────┤
 *                              ┌──────── DailyTodayDrawer ──────┐│
 *                              │ 360px 右抽屉 / 全文 / 译文 /   ││
 *                              │ 互动数 / 跳原文 / 抽屉内勾选   ││
 *                              └────────────────────────────────┘│
 *
 * 数据契约:
 *   GET /api/public-opinion/daily-today
 *   GET /api/public-opinion/daily-today/count
 *   GET /api/public-opinion/daily-today/export
 *
 * 排序:固定 publishedAt 倒序(本页定位是"流",不提供排序切换)。
 * 筛选:平台 chip / 情感档位 / 搜索框 全部为前端 filter,0 延迟。
 * facet count:平台 chip 显示"除自身外其他过滤生效"时的条目数。
 *
 * 与 polarity 范式对齐:行级勾选 + CSV 导出 + 时间倒序 + 平台 chip。
 * 视觉令牌沿用 v3 控制台范式(.po-rail / .po-tile 节奏),5 模态情感色板复用。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { PlatformLogo } from './platform-logo.jsx'

const HOURS_OPTIONS = [
  { value: 6, label: '6 小时' },
  { value: 12, label: '12 小时' },
  { value: 24, label: '24 小时' },
]

const POLARITY_OPTIONS = [
  { value: '正面', label: '正面', color: '#00b42a' },
  { value: '中立', label: '中立', color: '#86909c' },
  { value: '负面', label: '负面', color: '#f53f3f' },
]

// 90s 心跳;研发可通过 window.__DAILY_TODAY_POLL_MS 临时调短(用于演示)
const POLL_MS_DEFAULT = 90_000

const MAX_FAIL_BEFORE_PAUSE = 3
const FRESH_FADE_MS = 5000

const ROW_HEIGHT = 34
const OVERSCAN = 8

// ───────────────────────────────────────────────────────────────
// utilities
// ───────────────────────────────────────────────────────────────

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatHHMM(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatFullTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function highlightMatch(text, alias) {
  if (!alias || !text) return text
  const idx = text.indexOf(alias)
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="po-daily-today-mark">{alias}</mark>
      {text.slice(idx + alias.length)}
    </>
  )
}

function sentimentTone(polarity) {
  if (polarity === '正面') return 'pos'
  if (polarity === '负面') return 'neg'
  return 'neu'
}

function isCJK(lang) {
  return lang === 'zh'
}

function filterItems(items, { platforms, polarities, query }) {
  const q = query.trim().toLowerCase()
  return items.filter((item) => {
    if (platforms.size > 0 && !platforms.has(item.platform.id)) return false
    if (polarities.size > 0 && !polarities.has(item.polarity)) return false
    if (q) {
      const hay = [
        item.body || '',
        item.translation?.zh || '',
        item.author?.handle || '',
        item.author?.displayName || '',
      ]
        .join('\n')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

function computeHistogram(items, hours) {
  const buckets = new Array(24).fill(0)
  if (!items.length) return buckets
  const windowMs = hours * 3600 * 1000
  const bucketMs = windowMs / 24
  const latest = new Date(items[0].publishedAt).getTime()
  const earliest = latest - windowMs + 1
  for (const it of items) {
    const ts = new Date(it.publishedAt).getTime()
    let idx = Math.floor((ts - earliest) / bucketMs)
    if (idx < 0) idx = 0
    if (idx > 23) idx = 23
    buckets[idx] += 1
  }
  return buckets
}

function computePlatformFacets(items, baseFilter) {
  // facet:对每个 platform,按"除 platform 外其他过滤"的结果统计
  const facetForPlatform = new Map()
  for (const pid of new Set(items.map((i) => i.platform.id))) {
    const filtered = filterItems(items, {
      platforms: new Set(), // 关键:平台维度不过滤
      polarities: baseFilter.polarities,
      query: baseFilter.query,
    })
    facetForPlatform.set(pid, filtered.filter((i) => i.platform.id === pid).length)
  }
  return facetForPlatform
}

// ───────────────────────────────────────────────────────────────
// 主组件
// ───────────────────────────────────────────────────────────────

export function DailyTodayBoard() {
  // 状态
  const [keywordsList, setKeywordsList] = useState([])
  const [keyword, setKeyword] = useState(() => readSearchParam('keyword') || 'peking')
  const [hours, setHours] = useState(() => {
    const h = Number(readSearchParam('hours'))
    return [6, 12, 24].includes(h) ? h : 24
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)

  const [platformFilter, setPlatformFilter] = useState(() => new Set())
  const [polarityFilter, setPolarityFilter] = useState(() => new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)

  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [drawerOpenId, setDrawerOpenId] = useState(null)
  const [drawerFullscreen, setDrawerFullscreen] = useState(false)

  const [newCount, setNewCount] = useState(0)
  const [autoPaused, setAutoPaused] = useState(false)
  const [activeBucket, setActiveBucket] = useState(null)

  const failCountRef = useRef(0)
  const pollTimerRef = useRef(null)
  const feedHandleRef = useRef(null)

  // 拉监测词清单(MOCK 直接静态;真实接入后改 /api/public-opinion/daily-today/keywords)
  useEffect(() => {
    import('../src/public-opinion/daily-today-mock.js')
      .then((m) => setKeywordsList(m.MOCK_KEYWORDS))
      .catch(() => setKeywordsList([]))
  }, [])

  // 拉主数据
  const fetchMain = useCallback(
    async (signal) => {
      setLoading(true)
      setError(null)
      try {
        const usp = new URLSearchParams({ keyword, hours: String(hours), mock: '1' })
        const res = await fetch(`/api/public-opinion/daily-today?${usp.toString()}`, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json()
        setPayload(body)
        // 切监测词/时间档时清空筛选与勾选
        setPlatformFilter(new Set())
        setPolarityFilter(new Set())
        setSearchQuery('')
        setSelectedIds(new Set())
        setNewCount(0)
        setAutoPaused(false)
        failCountRef.current = 0
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message || '加载失败')
      } finally {
        setLoading(false)
      }
    },
    [keyword, hours],
  )

  useEffect(() => {
    const ctrl = new AbortController()
    fetchMain(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchMain])

  // URL 同步
  useEffect(() => {
    if (typeof window === 'undefined') return
    const usp = new URLSearchParams(window.location.search)
    usp.set('keyword', keyword)
    usp.set('hours', String(hours))
    const next = `${window.location.pathname}?${usp.toString()}`
    if (window.location.pathname + window.location.search !== next) {
      window.history.replaceState({}, '', next)
    }
  }, [keyword, hours])

  // 90s 心跳轮询 /count
  useEffect(() => {
    if (!payload?.generatedAt || autoPaused) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    const tick = async () => {
      try {
        const usp = new URLSearchParams({
          keyword,
          hours: String(hours),
          since: payload.generatedAt,
          mock: '1',
        })
        const res = await fetch(`/api/public-opinion/daily-today/count?${usp.toString()}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const body = await res.json()
        setNewCount(body.newCount || 0)
        failCountRef.current = 0
      } catch {
        failCountRef.current += 1
        if (failCountRef.current >= MAX_FAIL_BEFORE_PAUSE) {
          setAutoPaused(true)
          if (pollTimerRef.current) clearInterval(pollTimerRef.current)
        }
      }
    }

    const interval =
      (typeof window !== 'undefined' && window.__DAILY_TODAY_POLL_MS) || POLL_MS_DEFAULT
    pollTimerRef.current = setInterval(tick, interval)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [payload?.generatedAt, keyword, hours, autoPaused])

  // visibilitychange:失焦暂停 / 回焦立即拉
  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        if (pollTimerRef.current) clearInterval(pollTimerRef.current)
      } else if (!autoPaused && payload?.generatedAt) {
        // 触发一次 fetchMain 的 count 同步 — 通过修改 payload.generatedAt 来重启轮询
        // 简化:直接重新拉一次 count
        const usp = new URLSearchParams({
          keyword,
          hours: String(hours),
          since: payload.generatedAt,
          mock: '1',
        })
        fetch(`/api/public-opinion/daily-today/count?${usp.toString()}`)
          .then((r) => r.json())
          .then((b) => setNewCount(b.newCount || 0))
          .catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [autoPaused, payload?.generatedAt, keyword, hours])

  // 派生:过滤 + 直方图 + facet
  const filteredItems = useMemo(() => {
    if (!payload?.items) return []
    return filterItems(payload.items, {
      platforms: platformFilter,
      polarities: polarityFilter,
      query: searchQuery,
    })
  }, [payload?.items, platformFilter, polarityFilter, searchQuery])

  const histogram = useMemo(
    () => computeHistogram(filteredItems, hours),
    [filteredItems, hours],
  )

  const platformFacet = useMemo(() => {
    if (!payload?.items) return new Map()
    return computePlatformFacets(payload.items, {
      polarities: polarityFilter,
      query: searchQuery,
    })
  }, [payload?.items, polarityFilter, searchQuery])

  // 抽屉所选条目
  const drawerItem = useMemo(
    () => (drawerOpenId ? filteredItems.find((i) => i.id === drawerOpenId) ?? null : null),
    [drawerOpenId, filteredItems],
  )

  // 导出按钮
  const exportHref = useMemo(() => {
    const usp = new URLSearchParams({ keyword, hours: String(hours), mock: '1' })
    if (selectedIds.size > 0) usp.set('ids', Array.from(selectedIds).join(','))
    return `/api/public-opinion/daily-today/export?${usp.toString()}`
  }, [keyword, hours, selectedIds])

  // 加载新数据(横条点击)
  const loadNewItems = useCallback(async () => {
    if (newCount === 0) return
    // MVP:重拉全量,生成器是确定性的,所以"新数据"实际是 generatedAt 推进后的同一批 Mock
    // 真实接入后由 BFF 实现增量。为演示效果,我们在前端伪造一批"isFresh"标记。
    setNewCount(0)
    const ctrl = new AbortController()
    try {
      const usp = new URLSearchParams({ keyword, hours: String(hours), mock: '1' })
      const res = await fetch(`/api/public-opinion/daily-today?${usp.toString()}`, {
        signal: ctrl.signal,
      })
      const body = await res.json()
      // 把新的前 newCount 条标记为 fresh
      const next = { ...body, items: body.items.map((it, idx) => ({ ...it, isFresh: idx < newCount })) }
      setPayload(next)
      // 5s 后取消 fresh
      setTimeout(() => {
        setPayload((p) => (p ? { ...p, items: p.items.map((it) => ({ ...it, isFresh: false })) } : p))
      }, FRESH_FADE_MS)
    } catch (e) {
      if (e.name !== 'AbortError') setError(e.message || '加载新数据失败')
    }
  }, [newCount, keyword, hours])

  // 视口锚点反推(virtualizer 提供)
  const onVirtualScroll = useCallback(
    (firstVisibleIndex) => {
      if (!filteredItems.length) return
      const item = filteredItems[firstVisibleIndex]
      if (!item || !payload?.items?.length) return
      // 反推该 item 在直方图中的桶
      const windowMs = hours * 3600 * 1000
      const bucketMs = windowMs / 24
      const latest = new Date(payload.items[0].publishedAt).getTime()
      const earliest = latest - windowMs + 1
      const ts = new Date(item.publishedAt).getTime()
      let idx = Math.floor((ts - earliest) / bucketMs)
      if (idx < 0) idx = 0
      if (idx > 23) idx = 23
      setActiveBucket(idx)
    },
    [filteredItems, payload?.items, hours],
  )

  // 子操作
  const togglePlatform = useCallback((id) => {
    setPlatformFilter((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const togglePolarity = useCallback((v) => {
    setPolarityFilter((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v)
      else next.add(v)
      return next
    })
  }, [])

  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setPlatformFilter(new Set())
    setPolarityFilter(new Set())
    setSearchQuery('')
  }, [])

  // ───────────────────────────── 渲染 ─────────────────────────────

  if (loading && !payload) {
    return (
      <section className="po-daily-today is-loading" aria-busy="true">
        <div className="po-daily-today-skel po-daily-today-skel-filter" />
        <div className="po-daily-today-skel po-daily-today-skel-histogram" />
        <div className="po-daily-today-skel po-daily-today-skel-feed" />
      </section>
    )
  }

  if (error && !payload) {
    return (
      <section className="po-daily-today is-error">
        <p>数据加载失败:{error}</p>
        <button type="button" className="po-daily-today-retry" onClick={() => fetchMain()}>
          重试
        </button>
      </section>
    )
  }

  return (
    <section className="po-daily-today" data-keyword={keyword} data-hours={hours}>
      <DailyTodayFilterBar
        keywordsList={keywordsList}
        keyword={keyword}
        onKeyword={setKeyword}
        hours={hours}
        onHours={setHours}
        platformFilter={platformFilter}
        onTogglePlatform={togglePlatform}
        platforms={payload?.platforms ?? []}
        platformFacet={platformFacet}
        polarityFilter={polarityFilter}
        onTogglePolarity={togglePolarity}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        moreOpen={moreOpen}
        onToggleMore={() => setMoreOpen((v) => !v)}
        exportHref={exportHref}
        selectedCount={selectedIds.size}
        totalCount={filteredItems.length}
        onRefresh={() => fetchMain()}
        loading={loading}
      />

      <DailyTodayHistogramStrip
        histogram={histogram}
        hours={hours}
        activeBucket={activeBucket}
        onClickBucket={(idx) => {
          // 跳到桶内首条 — virtualizer 通过 scrollToFn 接收
          const target = filteredItems.findIndex((it) => {
            const windowMs = hours * 3600 * 1000
            const bucketMs = windowMs / 24
            const latest = new Date(payload.items[0].publishedAt).getTime()
            const earliest = latest - windowMs + 1
            const ts = new Date(it.publishedAt).getTime()
            const b = Math.max(0, Math.min(23, Math.floor((ts - earliest) / bucketMs)))
            return b === idx
          })
          if (target >= 0 && feedHandleRef.current) feedHandleRef.current.scrollToIndex(target)
          setActiveBucket(idx)
        }}
      />

      {payload?.truncated ? (
        <div className="po-daily-today-truncated-tip">
          结果超过 5000 条,仅显示最新 5000 条;建议收窄时间档或加平台过滤
        </div>
      ) : null}

      <DailyTodayNewItemsBanner count={newCount} onLoad={loadNewItems} paused={autoPaused} />

      <DailyTodayFeed
        feedHandleRef={feedHandleRef}
        items={filteredItems}
        onOpenDrawer={setDrawerOpenId}
        drawerOpenId={drawerOpenId}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onScroll={onVirtualScroll}
        onClearFilters={clearFilters}
        hasAnyFilter={
          platformFilter.size > 0 || polarityFilter.size > 0 || searchQuery.trim() !== ''
        }
      />

      {drawerItem ? (
        <DailyTodayDrawer
          item={drawerItem}
          fullscreen={drawerFullscreen}
          onToggleFullscreen={() => setDrawerFullscreen((v) => !v)}
          onClose={() => {
            setDrawerOpenId(null)
            setDrawerFullscreen(false)
          }}
          selected={selectedIds.has(drawerItem.id)}
          onToggleSelect={() => toggleSelect(drawerItem.id)}
        />
      ) : null}
    </section>
  )
}

// ───────────────────────────────────────────────────────────────
// 子组件:筛选条
// ───────────────────────────────────────────────────────────────

function DailyTodayFilterBar({
  keywordsList,
  keyword,
  onKeyword,
  hours,
  onHours,
  platforms,
  platformFilter,
  onTogglePlatform,
  platformFacet,
  polarityFilter,
  onTogglePolarity,
  searchQuery,
  onSearch,
  moreOpen,
  onToggleMore,
  exportHref,
  selectedCount,
  totalCount,
  onRefresh,
  loading,
}) {
  return (
    <div className="po-daily-today-filterbar">
      <div className="po-daily-today-filterbar-row1">
        <label className="po-daily-today-kw-label">
          <span>监测词</span>
          <select
            className="po-daily-today-kw-select"
            value={keyword}
            onChange={(e) => onKeyword(e.target.value)}
            disabled={loading}
          >
            {keywordsList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.displayName} · {k.aliases.slice(0, 2).join(' / ')}
                {k.aliases.length > 2 ? '...' : ''}
              </option>
            ))}
          </select>
        </label>

        <div className="po-daily-today-hours">
          {HOURS_OPTIONS.map((h) => (
            <button
              key={h.value}
              type="button"
              className={`po-daily-today-chip po-daily-today-hours-chip ${h.value === hours ? 'is-active' : ''}`}
              onClick={() => onHours(h.value)}
              disabled={loading}
            >
              {h.label}
            </button>
          ))}
        </div>

        <div className="po-daily-today-filterbar-spacer" />

        <button
          type="button"
          className="po-daily-today-refresh"
          onClick={onRefresh}
          disabled={loading}
          aria-label="手动刷新"
        >
          ↻
        </button>

        <span className="po-daily-today-total">共 {totalCount} 条</span>
      </div>

      <div className="po-daily-today-filterbar-row2">
        <button
          type="button"
          className={`po-daily-today-chip ${platformFilter.size === 0 ? 'is-active' : ''}`}
          onClick={() => {
            // "全部" chip — 清空平台筛选
            platforms.forEach((p) => {
              if (platformFilter.has(p.id)) onTogglePlatform(p.id)
            })
          }}
        >
          全部
        </button>
        {platforms.map((p) => {
          const facetCount = platformFacet.get(p.id) ?? p.count
          return (
            <button
              key={p.id}
              type="button"
              className={`po-daily-today-chip po-daily-today-platform-chip ${platformFilter.has(p.id) ? 'is-active' : ''}`}
              onClick={() => onTogglePlatform(p.id)}
              style={{ '--platform-color': p.color }}
            >
              <PlatformLogo platform={p.name} size={12} />
              <span>{p.name}</span>
              <span className="po-daily-today-chip-count">{facetCount}</span>
            </button>
          )
        })}
      </div>

      <div className="po-daily-today-filterbar-row3">
        <input
          type="search"
          className="po-daily-today-search"
          placeholder="搜索正文 / 译文 / 作者句柄"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
        />

        <button
          type="button"
          className={`po-daily-today-more ${moreOpen ? 'is-open' : ''}`}
          onClick={onToggleMore}
          aria-expanded={moreOpen}
        >
          更多筛选 {moreOpen ? '▴' : '▾'}
        </button>

        {moreOpen ? (
          <div className="po-daily-today-more-panel" role="dialog">
            <span className="po-daily-today-more-label">情感档位</span>
            <div className="po-daily-today-more-chips">
              {POLARITY_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={`po-daily-today-chip ${polarityFilter.has(p.value) ? 'is-active' : ''}`}
                  onClick={() => onTogglePolarity(p.value)}
                  style={{ '--polarity-color': p.color }}
                >
                  <span
                    className="po-daily-today-dot"
                    style={{ background: p.color }}
                    aria-hidden="true"
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <a
          className="po-daily-today-export"
          href={exportHref}
          download
          aria-disabled={totalCount === 0}
        >
          ⬇ {selectedCount > 0 ? `导出 (${selectedCount}/${totalCount})` : `导出全部 (${totalCount})`}
        </a>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// 子组件:迷你直方图
// ───────────────────────────────────────────────────────────────

function DailyTodayHistogramStrip({ histogram, hours, activeBucket, onClickBucket }) {
  const max = Math.max(1, ...histogram)
  const bucketHours = hours / 24

  function bucketLabel(idx) {
    if (hours === 24) {
      const startHour = idx
      return `${pad(startHour)}:00–${pad((startHour + 1) % 24)}:00`
    }
    const totalMin = hours * 60
    const bucketMin = totalMin / 24
    const startMin = idx * bucketMin
    const endMin = startMin + bucketMin
    function fmt(m) {
      const h = Math.floor(m / 60)
      const mm = Math.floor(m % 60)
      return `${pad(h)}:${pad(mm)}`
    }
    return `${fmt(startMin)}–${fmt(endMin)}`
  }

  return (
    <div className="po-daily-today-histogram" role="group" aria-label="时段分布">
      {histogram.map((count, idx) => {
        const h = Math.max(2, (count / max) * 56)
        return (
          <button
            type="button"
            key={idx}
            className={`po-daily-today-histogram-bar ${idx === activeBucket ? 'is-active' : ''}`}
            style={{ height: `${h}px` }}
            onClick={() => onClickBucket(idx)}
            title={`${bucketLabel(idx)} · ${count} 条`}
            aria-label={`${bucketLabel(idx)} ${count} 条`}
          >
            <span className="sr-only">
              {bucketLabel(idx)} {count} 条
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// 子组件:新数据横条
// ───────────────────────────────────────────────────────────────

function DailyTodayNewItemsBanner({ count, onLoad, paused }) {
  if (paused) {
    return (
      <div className="po-daily-today-banner is-paused" role="alert">
        ⚠ 自动刷新已暂停,请手动刷新
      </div>
    )
  }
  if (!count) return null
  return (
    <button type="button" className="po-daily-today-banner is-fresh" onClick={onLoad}>
      ↑ {count} 条新条目 · 点击加载
    </button>
  )
}

// ───────────────────────────────────────────────────────────────
// 子组件:虚拟滚动信息流
// ───────────────────────────────────────────────────────────────

function DailyTodayFeed({
  feedHandleRef,
  items,
  onOpenDrawer,
  drawerOpenId,
  selectedIds,
  onToggleSelect,
  onScroll,
  onClearFilters,
  hasAnyFilter,
}) {
  const parentRef = useRef(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  // 暴露 scrollToIndex 给外部(histogram 点击)
  useEffect(() => {
    if (feedHandleRef) {
      feedHandleRef.current = {
        scrollToIndex: (idx) => virtualizer.scrollToIndex(idx, { align: 'start' }),
      }
    }
  })

  // 监听滚动,推出当前视口首条索引
  const items_ = virtualizer.getVirtualItems()
  useEffect(() => {
    if (items_.length === 0) return
    const firstVisible = items_[0].index
    onScroll(firstVisible)
  }, [items_, onScroll])

  if (!items.length) {
    return (
      <div className="po-daily-today-empty">
        <p>当前筛选下没有条目;尝试切换平台或扩大时间档。</p>
        {hasAnyFilter ? (
          <button type="button" className="po-daily-today-clear-filters" onClick={onClearFilters}>
            清空筛选
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div ref={parentRef} className="po-daily-today-feed">
      <div
        className="po-daily-today-feed-inner"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((vrow) => {
          const item = items[vrow.index]
          return (
            <DailyTodayFeedRow
              key={item.id}
              item={item}
              isSelected={selectedIds.has(item.id)}
              isOpen={drawerOpenId === item.id}
              onToggleSelect={onToggleSelect}
              onOpen={onOpenDrawer}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: `${vrow.size}px`,
                transform: `translateY(${vrow.start}px)`,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

function DailyTodayFeedRow({ item, isSelected, isOpen, onToggleSelect, onOpen, style }) {
  const tone = sentimentTone(item.polarity)
  return (
    <div
      className={`po-daily-today-row ${isOpen ? 'is-open' : ''} ${isSelected ? 'is-selected' : ''} ${item.isFresh ? 'is-fresh' : ''}`}
      style={style}
      onClick={() => onOpen(item.id)}
    >
      <label
        className="po-daily-today-row-checkbox"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          aria-label={`选择 ${item.author?.displayName ?? ''} 的条目`}
        />
      </label>
      <span className="po-daily-today-row-platform" style={{ '--platform-color': item.platform.color }}>
        <PlatformLogo platform={item.platform.name} size={12} />
      </span>
      <time className="po-daily-today-row-time" title={formatFullTime(item.publishedAt)}>
        {formatHHMM(item.publishedAt)}
      </time>
      <span className="po-daily-today-row-author">{item.author?.handle ?? item.platform.name}</span>
      <span className="po-daily-today-row-body">
        {highlightMatch(item.body, item.matchedKeyword)}
        {!isCJK(item.language) ? <sup className="po-daily-today-row-trans">译</sup> : null}
      </span>
      <span
        className={`po-daily-today-row-dot is-${tone}`}
        title={`情感分 ${item.sentiment.toFixed(2)}`}
        aria-label={`情感 ${item.polarity}`}
      />
    </div>
  )
}

// ───────────────────────────────────────────────────────────────
// 子组件:右抽屉
// ───────────────────────────────────────────────────────────────

function DailyTodayDrawer({ item, fullscreen, onToggleFullscreen, onClose, selected, onToggleSelect }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const tone = sentimentTone(item.polarity)

  return (
    <>
      <div
        className="po-daily-today-drawer-mask"
        onClick={onClose}
        role="presentation"
      />
      <aside className={`po-daily-today-drawer ${fullscreen ? 'is-fullscreen' : ''}`} role="dialog" aria-modal="true">
        <header className="po-daily-today-drawer-head">
          <PlatformLogo platform={item.platform.name} size={14} />
          <span className="po-daily-today-drawer-platform">{item.platform.name}</span>
          <span className="po-daily-today-drawer-author">
            {item.author?.handle ? `${item.author.handle} · ` : ''}
            {item.author?.displayName ?? ''}
          </span>
          <div className="po-daily-today-drawer-actions">
            <button type="button" onClick={onToggleFullscreen} title={fullscreen ? '退出全屏' : '全屏'}>
              {fullscreen ? '⤡' : '⤢'}
            </button>
            <button type="button" onClick={onClose} aria-label="关闭">
              ✕
            </button>
          </div>
        </header>

        <div className="po-daily-today-drawer-body">
          <dl className="po-daily-today-drawer-meta">
            <div>
              <dt>发布时间</dt>
              <dd>{formatFullTime(item.publishedAt)}</dd>
            </div>
            <div>
              <dt>情感</dt>
              <dd>
                <span className={`po-daily-today-row-dot is-${tone}`} aria-hidden="true" />
                {item.polarity} · {item.sentiment.toFixed(2)} ({item.sentiment5})
              </dd>
            </div>
            <div>
              <dt>命中监测词</dt>
              <dd>{item.matchedKeyword}</dd>
            </div>
            <div>
              <dt>互动</dt>
              <dd>
                转发 {item.metrics?.reposts ?? 0} · 点赞 {item.metrics?.likes ?? 0} · 评论{' '}
                {item.metrics?.replies ?? 0}
              </dd>
            </div>
          </dl>

          <section className="po-daily-today-drawer-text">
            <h4>原文</h4>
            <p>{highlightMatch(item.body, item.matchedKeyword)}</p>
          </section>

          {item.translation?.zh ? (
            <section className="po-daily-today-drawer-text po-daily-today-drawer-translation">
              <h4>
                译文(Mock)
                <button
                  type="button"
                  className="po-daily-today-drawer-retranslate"
                  disabled
                  title="下一期上线"
                >
                  重新翻译
                </button>
              </h4>
              <p>{item.translation.zh}</p>
            </section>
          ) : null}
        </div>

        <footer className="po-daily-today-drawer-foot">
          <a
            className="po-daily-today-drawer-link"
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            ↗ 查看原文
          </a>
          <button
            type="button"
            className={`po-daily-today-drawer-select ${selected ? 'is-selected' : ''}`}
            onClick={onToggleSelect}
          >
            {selected ? '✓ 已勾选' : '加入勾选'}
          </button>
        </footer>
      </aside>
    </>
  )
}

// ───────────────────────────────────────────────────────────────
// helpers
// ───────────────────────────────────────────────────────────────

function readSearchParam(key) {
  if (typeof window === 'undefined') return null
  try {
    const usp = new URLSearchParams(window.location.search)
    return usp.get(key)
  } catch {
    return null
  }
}
