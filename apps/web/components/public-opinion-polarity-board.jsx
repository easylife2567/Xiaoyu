'use client'

/**
 * 「正负面舆情」分析页主组件。
 *
 * 三段:
 *  - PolaritySummary  顶部 3 档 KPI 色块 + 8px 堆叠占比横条 (hover 5 档明细)
 *  - PolarityFilters  平台 chip 行 (单选) + 情感 chip 行 (单选)
 *  - PolarityTable    分页表格 + 行级勾选 + 行首 4px 情感色条 + 下载入口
 *
 * 数据契约:GET /api/public-opinion/polarity (聚合 + 切片)
 * 导出契约:GET /api/public-opinion/polarity/export (CSV UTF-8 BOM)
 *
 * 与「舆情总览」v3 control-room 同源:复用 .po-rail/.po-band/.po-tile 视觉节奏
 * 与 5 模态情感色板;不引入新外框、不引入新色板、不重写 5→3 折叠规则
 * (折叠在 src/public-opinion/polarity.js 内独占实现)。
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { PlatformLogo } from './platform-logo.jsx'

const SENTIMENT3_LABELS = ['正面', '中立', '负面']

// 5 模态色板 — 与 public-opinion-overview-dashboard.jsx 完全一致
const EMOTION_COLORS = {
  正面: '#00b42a',
  偏正面: '#7bc47f',
  中立: '#86909c',
  偏负面: '#ff7d00',
  负面: '#f53f3f',
}

const SENTIMENT3_COLORS = {
  正面: EMOTION_COLORS['正面'],
  中立: EMOTION_COLORS['中立'],
  负面: EMOTION_COLORS['负面'],
}

const RANGE_PRESETS = [
  { key: 'today', label: '今日', days: 1 },
  { key: '7d', label: '7 天', days: 7 },
  { key: 'custom', label: '自定义' },
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateString(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function presetRange(preset, today = new Date()) {
  if (preset.key === 'custom') return null
  const end = toDateString(today)
  const start = toDateString(new Date(today.getTime() - (preset.days - 1) * 86_400_000))
  return { start, end }
}

function buildQuery({ sentiment3, platform, range, page, pageSize, slice }) {
  const usp = new URLSearchParams()
  if (sentiment3 && sentiment3 !== '全部') usp.set('sentiment3', sentiment3)
  if (platform && platform !== '全部') usp.set('platform', platform)
  if (range?.start) usp.set('start', range.start)
  if (range?.end) usp.set('end', range.end)
  if (page) usp.set('page', String(page))
  if (pageSize) usp.set('pageSize', String(pageSize))
  if (slice) usp.set('slice', slice)
  return usp.toString()
}

function buildExportHref({ sentiment3, platform, range, selectedIds }) {
  const usp = new URLSearchParams()
  if (sentiment3 && sentiment3 !== '全部') usp.set('sentiment3', sentiment3)
  if (platform && platform !== '全部') usp.set('platform', platform)
  if (range?.start) usp.set('start', range.start)
  if (range?.end) usp.set('end', range.end)
  if (selectedIds && selectedIds.size) {
    usp.set('ids', Array.from(selectedIds).join(','))
  }
  return `/api/public-opinion/polarity/export${usp.toString() ? '?' + usp.toString() : ''}`
}

// ───────────────────────────── 子组件 ─────────────────────────────

function PolaritySummary({ summary, loading, error }) {
  // 计数滚动 — 仅在数据变化时缓动
  const positive = useCountUpLite(summary?.positive ?? 0)
  const neutral = useCountUpLite(summary?.neutral ?? 0)
  const negative = useCountUpLite(summary?.negative ?? 0)

  if (loading) {
    return (
      <section className="po-polarity-summary is-loading" aria-busy="true">
        <div className="po-polarity-kpi-skel" />
        <div className="po-polarity-kpi-skel" />
        <div className="po-polarity-kpi-skel" />
        <div className="po-polarity-strip-skel" />
      </section>
    )
  }
  if (error) {
    return <section className="po-polarity-summary is-error">概览加载失败:{error}</section>
  }
  if (!summary || summary.total === 0) {
    return <section className="po-polarity-summary is-empty">当前筛选下暂无数据</section>
  }
  const total = summary.total || 1
  const tiles = [
    { tone: 'pos', label: '正面', count: positive, raw: summary.positive },
    { tone: 'neu', label: '中立', count: neutral, raw: summary.neutral },
    { tone: 'neg', label: '负面', count: negative, raw: summary.negative },
  ]
  return (
    <section className="po-polarity-summary" aria-label="情感档位概览">
      {tiles.map((tile) => {
        const ratio = (tile.raw / total) * 100
        return (
          <div className="po-polarity-kpi" data-tone={tile.tone} key={tile.tone}>
            <span className="po-polarity-kpi-dot" aria-hidden="true" />
            <strong className="po-polarity-kpi-value">
              {Math.round(tile.count).toLocaleString('zh-CN')}
            </strong>
            <span className="po-polarity-kpi-label">{tile.label}</span>
            <span className="po-polarity-kpi-ratio">{ratio.toFixed(1)}%</span>
          </div>
        )
      })}
      <div
        className="po-polarity-strip"
        title="情感占比 (悬停查看 5 档明细)"
        aria-label="情感占比"
      >
        <div
          className="po-polarity-strip-seg"
          data-tone="pos"
          style={{ flexGrow: summary.positive }}
        />
        <div
          className="po-polarity-strip-seg"
          data-tone="neu"
          style={{ flexGrow: summary.neutral }}
        />
        <div
          className="po-polarity-strip-seg"
          data-tone="neg"
          style={{ flexGrow: summary.negative }}
        />
        {summary.sentiment5 ? (
          <div className="po-polarity-strip-popover" role="tooltip">
            {['正面', '偏正面', '中立', '偏负面', '负面'].map((label) => (
              <div className="po-polarity-strip-row" key={label}>
                <span
                  className="po-polarity-strip-swatch"
                  style={{ background: EMOTION_COLORS[label] }}
                />
                <span className="po-polarity-strip-name">{label}</span>
                <span className="po-polarity-strip-count">
                  {(summary.sentiment5[label] ?? 0).toLocaleString('zh-CN')}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/**
 * 数值缓动滚动 — 简化版,避免每次切换 chip 滥用 RAF。
 * 800ms easeOutCubic,reduced-motion 偏好下直通。
 */
function useCountUpLite(target, ms = 600) {
  const [value, setValue] = React.useState(target)
  const startRef = React.useRef(0)
  const fromRef = React.useRef(target)
  const rafRef = React.useRef(0)
  React.useEffect(() => {
    if (typeof window === 'undefined') return setValue(target)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return setValue(target)
    fromRef.current = value
    startRef.current = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / ms)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(fromRef.current + (target - fromRef.current) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else setValue(target)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])
  return value
}

function ChipRow({ ariaLabel, options, value, onChange, withLogo = false }) {
  return (
    <div className="po-polarity-chips" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value
        const showLogo = withLogo && opt.value !== '全部'
        return (
          <button
            type="button"
            key={opt.value}
            className={active ? 'po-polarity-chip is-active' : 'po-polarity-chip'}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
          >
            {showLogo ? (
              <span className="po-polarity-chip-logo" aria-hidden="true">
                <PlatformLogo platform={opt.value} size={13} colorize={!active} />
              </span>
            ) : null}
            <span>{opt.label}</span>
            {opt.count != null ? <em className="po-polarity-chip-count">{opt.count}</em> : null}
          </button>
        )
      })}
    </div>
  )
}

function PolarityFilters({ sentiment3, onSentiment, platform, onPlatform, platforms, totalCount }) {
  const platformOptions = useMemo(() => {
    const sumFromPlatforms = (platforms ?? []).reduce((s, p) => s + p.count, 0)
    const total = totalCount || sumFromPlatforms
    const list = [{ value: '全部', label: '全部', count: total }]
    for (const p of platforms ?? []) {
      list.push({ value: p.key, label: p.key, count: p.count })
    }
    return list
  }, [platforms, totalCount])

  const sentimentOptions = [
    { value: '全部', label: '全部' },
    ...SENTIMENT3_LABELS.map((label) => ({ value: label, label })),
  ]

  return (
    <section className="po-band" data-band="filter">
      <span className="po-band-label">
        筛选<span className="po-band-label-latin">filter</span>
      </span>
      <div className="po-polarity-filters">
        <ChipRow
          ariaLabel="平台过滤"
          options={platformOptions}
          value={platform}
          onChange={onPlatform}
          withLogo
        />
        <ChipRow
          ariaLabel="情感过滤"
          options={sentimentOptions}
          value={sentiment3}
          onChange={onSentiment}
        />
      </div>
    </section>
  )
}

function SentimentBadge({ sentiment3 }) {
  const color = SENTIMENT3_COLORS[sentiment3] ?? SENTIMENT3_COLORS['中立']
  return (
    <span className="po-polarity-badge" style={{ color, borderColor: color }}>
      {sentiment3}
    </span>
  )
}

function PolarityTable({
  items,
  pagination,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onClearSelection,
  onExportSelection,
  onKeywordClick,
  onPlatformClick,
  page,
  onPage,
  onRefresh,
  loading,
  error,
  sortBy,
  onSortChange,
}) {
  const pageStart = ((pagination?.page ?? 1) - 1) * (pagination?.pageSize ?? 10) + 1
  const pageEnd = Math.min(pagination?.total ?? 0, pageStart + (items?.length ?? 0) - 1)
  const allSelectedOnPage = items?.length > 0 && items.every((_, i) => selectedIds.has(String(i)))
  const someSelectedOnPage =
    !allSelectedOnPage && items?.some((_, i) => selectedIds.has(String(i)))

  // 排序后的视图(仅前端,不影响 BFF)
  const displayItems = useMemo(() => {
    if (!items?.length) return items
    const arr = items.slice()
    if (sortBy === 'time-desc') {
      arr.sort((a, b) => String(b.pubTime).localeCompare(String(a.pubTime)))
    } else if (sortBy === 'time-asc') {
      arr.sort((a, b) => String(a.pubTime).localeCompare(String(b.pubTime)))
    } else if (sortBy === 'platform') {
      arr.sort((a, b) => String(a.platform).localeCompare(String(b.platform)))
    } else if (sortBy === 'sentiment') {
      const order = { 负面: 0, 中立: 1, 正面: 2 }
      arr.sort((a, b) => (order[a.sentiment3] ?? 1) - (order[b.sentiment3] ?? 1))
    }
    return arr
  }, [items, sortBy])

  return (
    <section className="po-band" data-band="feed">
      <span className="po-band-label">
        信息流<span className="po-band-label-latin">feed</span>
      </span>

      <header className="po-polarity-toolbar">
        <label className="po-polarity-toolbar-check">
          <input
            type="checkbox"
            checked={allSelectedOnPage}
            ref={(el) => {
              if (el) el.indeterminate = someSelectedOnPage
            }}
            onChange={(e) => onToggleAll(e.target.checked)}
            aria-label="全选本页"
          />
          <span>全选本页</span>
        </label>
        <button
          type="button"
          className="po-polarity-toolbar-btn"
          onClick={onRefresh}
          title="刷新"
          aria-label="刷新"
        >
          ↻
        </button>
        <div className="po-polarity-toolbar-sort">
          <label htmlFor="po-sort">排序</label>
          <select
            id="po-sort"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="time-desc">最新优先</option>
            <option value="time-asc">最早优先</option>
            <option value="platform">按平台</option>
            <option value="sentiment">按情感档</option>
          </select>
        </div>
        <span className="po-polarity-toolbar-spacer" />
        {pagination ? (
          <span className="po-polarity-toolbar-meta">
            共 {pagination.total.toLocaleString('zh-CN')} 条
            {pagination.total > 0 ? `,当前第 ${pageStart}-${pageEnd} 条` : ''}
          </span>
        ) : null}
      </header>

      {/* 行级勾选 sticky 操作栏 — 只有勾选时出现 */}
      {selectedIds.size > 0 ? (
        <div className="po-polarity-selection-bar" role="region" aria-label="已选行操作">
          <span className="po-polarity-selection-count">
            已选 <strong>{selectedIds.size}</strong> 条
          </span>
          <span className="po-polarity-selection-spacer" />
          <button
            type="button"
            className="po-polarity-selection-btn"
            onClick={onExportSelection}
          >
            ⬇ 导出勾选
          </button>
          <button
            type="button"
            className="po-polarity-selection-btn is-ghost"
            onClick={onClearSelection}
          >
            清空
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="po-tile-state is-error">信息流加载失败:{error}</div>
      ) : loading ? (
        <div className="po-polarity-table is-loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="po-polarity-row-skel" key={i} />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="po-tile-state">当前筛选下暂无舆情条目</div>
      ) : (
        <div className="po-polarity-table">
          {displayItems.map((item, i) => {
            const id = String(i)
            const selected = selectedIds.has(id)
            const stripColor = EMOTION_COLORS[item.sentiment5] ?? SENTIMENT3_COLORS['中立']
            return (
              <div
                className={selected ? 'po-polarity-row is-selected' : 'po-polarity-row'}
                data-sentiment={item.sentiment5}
                data-risk={item.risk ? 'true' : 'false'}
                key={`${item.url}-${i}`}
                style={{ '--row-emotion-color': stripColor }}
              >
                <label className="po-polarity-row-check">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleRow(id)}
                    aria-label={`选择第 ${i + 1} 条`}
                  />
                </label>
                <button
                  type="button"
                  className="po-polarity-row-platform"
                  onClick={() => onPlatformClick?.(item.platform)}
                  title={`仅查看 ${item.platform || '未知'} 平台`}
                >
                  <span className="po-polarity-row-platform-logo" aria-hidden="true">
                    <PlatformLogo platform={item.platform} size={14} colorize />
                  </span>
                  <span className="po-polarity-row-platform-name">
                    {item.platform || '未知'}
                  </span>
                </button>
                <SentimentBadge sentiment3={item.sentiment3} />
                {item.risk ? (
                  <span className="po-polarity-row-risk" title="风险舆情" aria-label="风险">
                    ⚠
                  </span>
                ) : (
                  <span className="po-polarity-row-risk-placeholder" aria-hidden="true" />
                )}
                <div className="po-polarity-row-title">
                  {item.title ? (
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    <span className="po-polarity-row-title-empty">(无标题)</span>
                  )}
                  {item.url ? (
                    <a
                      className="po-polarity-row-source"
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      阅读原文 →
                    </a>
                  ) : null}
                </div>
                {item.keyword ? (
                  <button
                    type="button"
                    className="po-polarity-row-keyword"
                    onClick={() => onKeywordClick?.(item.keyword)}
                    title={`按关键词「${item.keyword}」过滤`}
                  >
                    #{item.keyword}
                  </button>
                ) : (
                  <span className="po-polarity-row-keyword-placeholder" aria-hidden="true" />
                )}
                <time className="po-polarity-row-time" dateTime={item.pubTime}>
                  {item.pubTime}
                </time>
              </div>
            )
          })}
        </div>
      )}

      {pagination && pagination.total > pagination.pageSize ? (
        <footer className="po-polarity-pager">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
          >
            ‹ 上一页
          </button>
          <span className="po-polarity-pager-info">
            第 {page} 页 / 共 {Math.ceil(pagination.total / pagination.pageSize)} 页
          </span>
          <button
            type="button"
            onClick={() =>
              onPage(Math.min(Math.ceil(pagination.total / pagination.pageSize), page + 1))
            }
            disabled={page >= Math.ceil(pagination.total / pagination.pageSize)}
          >
            下一页 ›
          </button>
        </footer>
      ) : null}
    </section>
  )
}

// ───────────────────────────── 主组件 ─────────────────────────────

export function DailyPolarityBoard() {
  const [rangePreset, setRangePreset] = useState('7d')
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const [sentiment3, setSentiment3] = useState('全部')
  const [platform, setPlatform] = useState('全部')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [routeError, setRouteError] = useState(null)
  const [downloadError, setDownloadError] = useState(null)
  const [downloading, setDownloading] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [sortBy, setSortBy] = useState('time-desc')

  const range = useMemo(() => {
    const preset = RANGE_PRESETS.find((p) => p.key === rangePreset)
    if (!preset) return null
    if (preset.key !== 'custom') return presetRange(preset)
    if (customRange.start && customRange.end) return customRange
    return null
  }, [rangePreset, customRange])

  // 切换筛选 → 重置到第 1 页 + 清空勾选
  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [sentiment3, platform, rangePreset, customRange.start, customRange.end])

  // 拉数据
  useEffect(() => {
    let alive = true
    setLoading(true)
    setRouteError(null)
    const query = buildQuery({ sentiment3, platform, range, page, pageSize: 10 })
    fetch(`/api/public-opinion/polarity${query ? '?' + query : ''}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!alive) return
        setPayload(data)
      })
      .catch((err) => {
        if (!alive) return
        setRouteError(String(err?.message ?? err))
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [sentiment3, platform, range?.start, range?.end, page, refreshTick])

  const toggleRow = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(
    (checked) => {
      const items = payload?.items ?? []
      setSelectedIds((prev) => {
        const next = new Set(prev)
        items.forEach((_, i) => {
          if (checked) next.add(String(i))
          else next.delete(String(i))
        })
        return next
      })
    },
    [payload?.items],
  )

  const handleRefresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const handleKeywordClick = useCallback((keyword) => {
    // 简化:把关键词复制到剪贴板(若可用),并在 UI 上做一次轻 hint
    if (typeof window !== 'undefined' && navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(keyword).catch(() => {})
    }
  }, [])

  const handlePlatformClick = useCallback(
    (p) => {
      if (!p) return
      setPlatform(platform === p ? '全部' : p)
    },
    [platform],
  )

  // 键盘快捷键:Esc 清空勾选 / r 刷新 / 1-4 切换情感档
  useEffect(() => {
    function onKey(e) {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return
      if (e.key === 'Escape') {
        if (selectedIds.size > 0) setSelectedIds(new Set())
        else setSentiment3('全部')
      } else if (e.key === 'r' || e.key === 'R') {
        handleRefresh()
      } else if (e.key === '1') setSentiment3('全部')
      else if (e.key === '2') setSentiment3('正面')
      else if (e.key === '3') setSentiment3('中立')
      else if (e.key === '4') setSentiment3('负面')
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selectedIds.size, handleRefresh])

  const handleDownload = useCallback(
    async (event) => {
      if (event) event.preventDefault()
      if (downloading) return
      setDownloading(true)
      setDownloadError(null)
      try {
        const href = buildExportHref({ sentiment3, platform, range, selectedIds })
        const res = await fetch(href, { cache: 'no-store' })
        if (!res.ok) {
          const detail = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
          throw new Error(detail.error || '导出失败')
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        // 从 Content-Disposition 解析文件名;失败回退默认
        const cd = res.headers.get('Content-Disposition') || ''
        const match = /filename\*=UTF-8''([^;]+)/i.exec(cd)
        a.download = match ? decodeURIComponent(match[1]) : '正负面舆情.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      } catch (err) {
        setDownloadError(String(err?.message ?? err))
      } finally {
        setDownloading(false)
      }
    },
    [downloading, sentiment3, platform, range, selectedIds],
  )

  // 未配置态
  if (!loading && payload && payload.configured === false) {
    return (
      <section className="po-polarity-shell">
        <div className="po-tile-state">
          舆情接口未配置。请在服务端 `.env.local` 设置
          <code> PUBLIC_OPINION_API_BASE / PUBLIC_OPINION_API_USERNAME / PUBLIC_OPINION_API_PASSWORD</code>
          ,或在 dev 下追加 <code>?mock=1</code> 查看演示数据。
        </div>
      </section>
    )
  }

  const summary = payload?.summary ?? null
  const platforms = payload?.platforms ?? []
  const items = payload?.items ?? []
  const pagination = payload?.pagination ?? { page: 1, pageSize: 10, total: 0 }
  const summaryError = payload?.errors?.summary
  const itemsError = payload?.errors?.items || routeError
  const selectionCount = selectedIds.size

  return (
    <section className="po-polarity-shell">
      <header className="po-polarity-header">
        <div className="po-polarity-range" role="group" aria-label="时间范围">
          {RANGE_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.key}
              className={
                rangePreset === preset.key
                  ? 'po-polarity-range-btn is-active'
                  : 'po-polarity-range-btn'
              }
              aria-pressed={rangePreset === preset.key}
              onClick={() => setRangePreset(preset.key)}
            >
              {preset.label}
            </button>
          ))}
          {rangePreset === 'custom' ? (
            <span className="po-polarity-range-custom">
              <input
                type="date"
                value={customRange.start}
                onChange={(e) =>
                  setCustomRange((prev) => ({ ...prev, start: e.target.value }))
                }
                aria-label="起始日期"
              />
              <span>—</span>
              <input
                type="date"
                value={customRange.end}
                onChange={(e) => setCustomRange((prev) => ({ ...prev, end: e.target.value }))}
                aria-label="结束日期"
              />
            </span>
          ) : range ? (
            <span className="po-polarity-range-display">
              {range.start} — {range.end}
            </span>
          ) : null}
        </div>
        <div className="po-polarity-header-actions">
          {downloadError ? (
            <span className="po-polarity-download-error">导出失败:{downloadError}</span>
          ) : null}
          <a
            className={downloading ? 'po-polarity-download is-loading' : 'po-polarity-download'}
            href={buildExportHref({ sentiment3, platform, range, selectedIds })}
            onClick={handleDownload}
            aria-busy={downloading}
            aria-disabled={downloading}
            title={
              selectionCount > 0
                ? `按当前选择导出 ${selectionCount} 条`
                : '按当前筛选导出全部条目'
            }
          >
            {downloading ? (
              <>
                <span className="po-polarity-download-spinner" aria-hidden="true" />
                导出中...
              </>
            ) : (
              <>⬇ {selectionCount > 0 ? `导出勾选 ${selectionCount} 条` : '下载全部'}</>
            )}
          </a>
        </div>
      </header>

      <PolaritySummary summary={summary} loading={loading} error={summaryError} />

      <PolarityFilters
        sentiment3={sentiment3}
        onSentiment={setSentiment3}
        platform={platform}
        onPlatform={setPlatform}
        platforms={platforms}
        totalCount={pagination.total}
      />

      <PolarityTable
        items={items}
        pagination={pagination}
        selectedIds={selectedIds}
        onToggleRow={toggleRow}
        onToggleAll={toggleAll}
        onClearSelection={handleClearSelection}
        onExportSelection={handleDownload}
        onKeywordClick={handleKeywordClick}
        onPlatformClick={handlePlatformClick}
        page={page}
        onPage={setPage}
        onRefresh={handleRefresh}
        loading={loading && !payload}
        error={itemsError}
        sortBy={sortBy}
        onSortChange={setSortBy}
      />
    </section>
  )
}
