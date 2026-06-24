'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import { stack as d3stack, area as d3area, curveMonotoneX } from 'd3-shape'
import { scaleLinear, scaleBand } from 'd3-scale'
import {
  blueScale,
  contrastTextOn,
  donutArcPath,
  sparklinePath,
  useCountUp,
} from '../src/public-opinion/d3-utils.js'

// 对齐百炼(阿里云/Ant)设计令牌的图表主题
const EMOTION_LABELS = ['正面', '偏正面', '中立', '偏负面', '负面']
const EMOTION_COLORS = {
  正面: '#00b42a',
  偏正面: '#7bc47f',
  中立: '#86909c',
  偏负面: '#ff7d00',
  负面: '#f53f3f',
}
const MEDIA_COLORS = ['#1677ff', '#00b42a', '#ff7d00', '#f53f3f', '#722ed1', '#14c9c9', '#86909c']

const PO_CHART_THEME = {
  primary: '#1677ff',
  accent: '#14c9c9',
  grid: '#ebedf1',
  axisTick: { fill: '#86909c', fontSize: 12 },
  tooltipStyle: {
    borderRadius: 8,
    border: '1px solid #e5e6eb',
    boxShadow: '0 4px 16px rgba(0,0,0,.08)',
    fontSize: 12,
  },
}

// ───────────────────────────── 子组件 ─────────────────────────────

function Panel({ title, subtitle, error, empty, span = 4, children }) {
  return (
    <div className="po-tile" data-span={span}>
      <header className="po-tile-head">
        <h3>{title}</h3>
        {subtitle ? <span>{subtitle}</span> : null}
      </header>
      {error ? (
        <p className="po-tile-state is-error">数据加载失败:{error}</p>
      ) : empty ? (
        <p className="po-tile-state">暂无数据</p>
      ) : (
        children
      )}
    </div>
  )
}

/**
 * Band — 语义分组容器:小写灰标签 + 1px hairline + 12 列子栅格。
 * 是 v3 控制台分区视觉范式的核心:把"11 张白卡"重构为 3 个 band。
 */
function Band({ label, latin, children }) {
  return (
    <section className="po-band" data-band={latin}>
      <span className="po-band-label">
        {label}
        <span className="po-band-label-latin">{latin}</span>
      </span>
      <div className="po-band-grid">{children}</div>
    </section>
  )
}

/**
 * 迷你 sparkline — KPI 卡底部 22px 高趋势线。
 * 纯 SVG,不引入新 fetch,prefers-reduced-motion 下不做动画。
 */
function Sparkline({ points, color = '#1677ff', label, w = 120, h = 22 }) {
  const { d, last } = useMemo(() => sparklinePath(points, { w, h }), [points, w, h])
  if (!d) return null
  return (
    <svg
      className="po-kpi-spark"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label ? `${label} 趋势` : 'sparkline'}
    >
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="1.8" fill={color} />
    </svg>
  )
}

function KpiTile({ label, value, icon, sparkPoints, sparkColor }) {
  const animated = useCountUp(Number(value) || 0)
  const display = Math.round(animated).toLocaleString('zh-CN')
  return (
    <div className="po-kpi-tile">
      <span className="po-kpi-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="po-kpi-body">
        <strong className="po-kpi-value">{display}</strong>
        <span className="po-kpi-label">{label}</span>
        {sparkPoints && sparkPoints.length > 0 ? (
          <Sparkline points={sparkPoints} color={sparkColor} label={label} />
        ) : null}
      </div>
    </div>
  )
}

/**
 * 预警徽标 — KPI rail 末端的常驻态告警入口。
 * 三态:idle(0/0) / warn(>0/0) / major(major>0)。点击就地展开 popover。
 */
function AlertBadge({ warnings, error }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (error) {
    return (
      <button
        type="button"
        className="po-alert-badge"
        data-state="warn"
        title={`预警加载失败:${error}`}
        aria-label="预警加载失败"
      >
        预警 ?
      </button>
    )
  }

  const total = Number(warnings?.warningTotal ?? 0)
  const major = Number(warnings?.majorTotal ?? 0)
  const state = major > 0 ? 'major' : total > 0 ? 'warn' : 'idle'
  const text =
    state === 'major' ? `重大 ${major}` : state === 'warn' ? `预警 ${total}` : '当前无预警'

  const topWords = warnings?.topWords ?? []

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="po-alert-badge"
        data-state={state}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={text}
        onClick={() => setOpen((v) => !v)}
      >
        {text}
      </button>
      {open ? (
        <div className="po-alert-popover" role="dialog" aria-label="预警概览">
          <div className="po-alert-popover-counts">
            <span className={state === 'major' ? 'is-major' : ''}>
              重大预警 <strong>{major}</strong>
            </span>
            <span>
              预警总量 <strong>{total}</strong>
            </span>
          </div>
          {topWords.length > 0 ? (
            <div className="po-wordcloud">
              {topWords.map((w, i) => (
                <span
                  key={w.word}
                  style={{
                    fontSize: `${0.8 + Math.min(i === 0 ? 0.6 : 0.4 / (i + 1), 0.6)}rem`,
                  }}
                >
                  {w.word}
                </span>
              ))}
            </div>
          ) : (
            <p className="po-tile-state">当前无关键词</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * KPI rail — 顶部横条:3 KPI tile + 7d 态势 mini + 预警徽标。
 * 取代 v2 的 KpiBar 与「预警概览」独立 Panel。
 */
function KpiRail({ data, error, weeklyPoints, warnings, warningsError }) {
  const weeklyTotal = useMemo(() => {
    if (!Array.isArray(weeklyPoints)) return 0
    return weeklyPoints.reduce((s, p) => s + (Number(p?.count) || 0), 0)
  }, [weeklyPoints])

  return (
    <section className="po-rail">
      {error ? (
        <p className="po-tile-state is-error" style={{ gridColumn: '1 / -1' }}>
          KPI 加载失败:{error}
        </p>
      ) : (
        <>
          <KpiTile
            label="今日舆情量"
            value={data?.todayCount ?? 0}
            icon={
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 13l4-4 4 4 8-8" />
                <path d="M14 5h6v6" />
              </svg>
            }
            sparkPoints={weeklyPoints}
            sparkColor={PO_CHART_THEME.primary}
          />
          <KpiTile
            label="本周舆情量"
            value={data?.weekCount ?? 0}
            icon={
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 9h18M8 3v4M16 3v4" />
              </svg>
            }
            sparkPoints={weeklyPoints}
            sparkColor={PO_CHART_THEME.accent}
          />
          <KpiTile
            label="当日信息量"
            value={data?.todayInfoCount ?? 0}
            icon={
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            }
            sparkPoints={weeklyPoints}
            sparkColor="#86909c"
          />
          <div className="po-rail-mini" aria-label="近 7 天态势">
            <span className="po-rail-mini-label">近 7 天 · 总量</span>
            <span className="po-rail-mini-value">{weeklyTotal.toLocaleString('zh-CN')}</span>
            {weeklyPoints && weeklyPoints.length > 0 ? (
              <Sparkline points={weeklyPoints} color={PO_CHART_THEME.primary} label="7d 趋势" w={140} h={20} />
            ) : null}
          </div>
          <AlertBadge warnings={warnings} error={warningsError} />
        </>
      )}
    </section>
  )
}

function MiniDonut({ label, value, total, color }) {
  const { background, foreground } = donutArcPath({ value, total, size: 56, thickness: 9 })
  const animated = useCountUp(value)
  return (
    <div className="po-mini-donut">
      <svg viewBox="-28 -28 56 56" width="64" height="64" role="img" aria-label={`${label} ${value}`}>
        <path d={background} fill="#f2f3f5" />
        <path d={foreground} fill={color} className="po-mini-donut-fg" />
      </svg>
      <strong className="po-mini-donut-value" style={{ color }}>
        {Math.round(animated)}
      </strong>
      <span className="po-mini-donut-label">{label}</span>
    </div>
  )
}

function RankRow({ rank, name, value, share, secondary }) {
  return (
    <li className="po-rank-row">
      <span className="po-rank-num">#{rank}</span>
      <span className="po-rank-name" title={name}>
        {name || '(无名)'}
      </span>
      <span className="po-chip po-chip--primary" style={{ '--share': `${Math.min(100, share * 100)}%` }}>
        <span className="po-chip-bar" aria-hidden="true" />
        <span className="po-chip-text">{(share * 100).toFixed(1)}%</span>
      </span>
      <span className="po-chip po-chip--dark">{secondary ?? value}</span>
    </li>
  )
}

function Heatmap({ rows }) {
  const allValues = []
  for (const row of rows) {
    for (const label of EMOTION_LABELS) allValues.push(row[label] ?? 0)
  }
  const max = Math.max(1, ...allValues)
  const scale = blueScale(max)
  return (
    <div className="po-heatmap" role="table" aria-label="媒体与情感热力矩阵">
      <div className="po-heatmap-head" role="row">
        <span className="po-heatmap-axis" />
        {EMOTION_LABELS.map((label) => (
          <span key={label} className="po-heatmap-col" role="columnheader">
            {label}
          </span>
        ))}
      </div>
      {rows.map((row) => (
        <div className="po-heatmap-row" role="row" key={row.media}>
          <span className="po-heatmap-axis" role="rowheader">
            {row.media}
          </span>
          {EMOTION_LABELS.map((label) => {
            const v = row[label] ?? 0
            const bg = scale(v)
            return (
              <span
                key={label}
                role="cell"
                tabIndex={0}
                className="po-heatmap-cell"
                style={{ background: bg, color: contrastTextOn(bg) }}
                title={`${row.media} · ${label}:${v}`}
              >
                {v}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/**
 * 监听元素宽度变化(ResizeObserver),用于把固定 viewBox 的 SVG 真正响应到容器宽度。
 * SSR 安全:服务端返回 fallback 宽度。
 */
function useElementWidth(ref, fallback = 520) {
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof ResizeObserver === 'undefined') {
      setWidth(el.getBoundingClientRect().width || fallback)
      return
    }
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && Math.abs(w - width) > 0.5) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
  return width
}

/**
 * 情感 × 时间堆叠面积图 — 7 天 × 5 模态。
 * 一张图同时回答:① 趋势走向 ② 情感构成 ③ 日均比例。
 * v3 交互:① 容器宽度真响应(ResizeObserver) ② 可点击图例切换情感聚焦
 *         ③ hover 十字线 + 各情感分量小圆点 ④ 键盘左右切换 hover 日期
 */
function StackedSentimentArea({ data, height = 220 }) {
  const [hover, setHover] = useState(null)
  const [focused, setFocused] = useState(null) // 单击图例聚焦的情感模态
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const width = useElementWidth(wrapRef, 520)

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div ref={wrapRef}>
        <p className="po-tile-state">暂无数据</p>
      </div>
    )
  }

  const padding = { top: 16, right: 20, bottom: 24, left: 36 }
  const innerW = Math.max(80, width - padding.left - padding.right)
  const innerH = height - padding.top - padding.bottom

  const stackGen = d3stack().keys(EMOTION_LABELS)
  const series = stackGen(data)
  const maxY = Math.max(
    1,
    ...data.map((d) => EMOTION_LABELS.reduce((s, k) => s + (d[k] ?? 0), 0)),
  )
  const xScale = scaleBand()
    .domain(data.map((d) => d.date))
    .range([0, innerW])
    .padding(0)
  const yScale = scaleLinear().domain([0, maxY]).range([innerH, 0]).nice()
  const avg = data.reduce((s, d) => s + EMOTION_LABELS.reduce((ss, k) => ss + (d[k] ?? 0), 0), 0) / data.length

  const xCenter = (d) => (xScale(d.date) ?? 0) + xScale.bandwidth() / 2
  const areaGen = d3area()
    .x((d) => xCenter(d.data))
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(curveMonotoneX)

  function onMove(e) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientX - rect.left) / rect.width) * width - padding.left
    if (x < 0 || x > innerW) {
      setHover(null)
      return
    }
    const idx = Math.min(
      data.length - 1,
      Math.max(0, Math.round((x / innerW) * (data.length - 1))),
    )
    setHover({ idx })
  }

  function onKeyDown(e) {
    if (!data.length) return
    if (e.key === 'ArrowRight') {
      setHover((h) => ({ idx: Math.min(data.length - 1, (h?.idx ?? -1) + 1) }))
      e.preventDefault()
    } else if (e.key === 'ArrowLeft') {
      setHover((h) => ({ idx: Math.max(0, (h?.idx ?? data.length) - 1) }))
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setHover(null)
    }
  }

  const hoverX = hover ? xCenter(data[hover.idx]) : null
  const tooltipLeft = hoverX != null ? Math.min(width - 160, hoverX + padding.left + 8) : 0

  return (
    <div className="po-stack-area" ref={wrapRef}>
      <ul className="po-stack-legend" role="toolbar" aria-label="情感图例(单击聚焦)">
        {EMOTION_LABELS.map((k) => (
          <li key={k}>
            <button
              type="button"
              className={`po-stack-legend-chip${focused && focused !== k ? ' is-dim' : ''}${focused === k ? ' is-on' : ''}`}
              onClick={() => setFocused((f) => (f === k ? null : k))}
              aria-pressed={focused === k}
              title={focused === k ? `已聚焦 ${k},再次点击取消` : `仅显示 ${k}`}
            >
              <span className="po-stack-legend-dot" style={{ background: EMOTION_COLORS[k] }} />
              {k}
            </button>
          </li>
        ))}
      </ul>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label="情感 × 时间堆叠面积"
        tabIndex={0}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        <g transform={`translate(${padding.left},${padding.top})`}>
          {/* Y grid */}
          {yScale.ticks(4).map((t) => (
            <g key={t}>
              <line x1={0} x2={innerW} y1={yScale(t)} y2={yScale(t)} stroke={PO_CHART_THEME.grid} />
              <text x={-6} y={yScale(t) + 3} fontSize="10" textAnchor="end" fill="#86909c">
                {t}
              </text>
            </g>
          ))}
          {/* areas */}
          {series.map((s) => {
            const dimmed = focused && focused !== s.key
            return (
              <path
                key={s.key}
                d={areaGen(s)}
                fill={EMOTION_COLORS[s.key]}
                opacity={dimmed ? 0.12 : focused === s.key ? 1 : 0.85}
                style={{ transition: 'opacity 200ms ease' }}
              />
            )
          })}
          {/* avg dashed line */}
          <line
            x1={0}
            x2={innerW}
            y1={yScale(avg)}
            y2={yScale(avg)}
            stroke="#86909c"
            strokeDasharray="4 4"
          />
          <text x={innerW - 4} y={yScale(avg) - 4} fontSize="10" fill="#86909c" textAnchor="end">
            Avg {avg.toFixed(0)}
          </text>
          {/* x labels */}
          {data.map((d) => (
            <text
              key={d.date}
              x={xCenter(d)}
              y={innerH + 14}
              fontSize="10"
              textAnchor="middle"
              fill="#86909c"
            >
              {d.date}
            </text>
          ))}
          {/* hover crosshair + dots */}
          {hover ? (
            <>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={0}
                y2={innerH}
                stroke="#1d2129"
                strokeOpacity="0.25"
              />
              {series.map((s) => {
                const segment = s[hover.idx]
                if (!segment) return null
                const dimmed = focused && focused !== s.key
                return (
                  <circle
                    key={s.key}
                    cx={hoverX}
                    cy={yScale(segment[1])}
                    r={dimmed ? 0 : 3}
                    fill="#fff"
                    stroke={EMOTION_COLORS[s.key]}
                    strokeWidth="1.5"
                  />
                )
              })}
            </>
          ) : null}
        </g>
      </svg>
      {hover ? (
        <div
          className="po-stack-tooltip"
          style={{
            left: tooltipLeft,
            top: 8,
            ...PO_CHART_THEME.tooltipStyle,
            background: '#fff',
            padding: '6px 10px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{data[hover.idx].date}</div>
          {EMOTION_LABELS.map((k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, opacity: focused && focused !== k ? 0.35 : 1 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  background: EMOTION_COLORS[k],
                  borderRadius: 2,
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#86909c' }}>{k}</span>
              <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                {data[hover.idx][k] ?? 0}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * 媒体 × 情感 100% 横向堆叠条 — 看"哪个平台情感更偏负"。
 * 用 recharts 内置堆叠条,百分比换算后传入。
 */
function MediaSentimentPercentBar({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <p className="po-tile-state">暂无数据</p>
  }
  const data = rows.map((r) => {
    const total = EMOTION_LABELS.reduce((s, k) => s + (r[k] ?? 0), 0)
    const entry = { media: r.media }
    EMOTION_LABELS.forEach((k) => {
      entry[k] = total > 0 ? Math.round(((r[k] ?? 0) / total) * 1000) / 10 : 0
    })
    return entry
  })
  return (
    <div className="po-percent-bar">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={PO_CHART_THEME.grid} horizontal={false} />
          <XAxis
            type="number"
            domain={[0, 100]}
            unit="%"
            tick={PO_CHART_THEME.axisTick}
          />
          <YAxis type="category" dataKey="media" width={70} tick={PO_CHART_THEME.axisTick} />
          <Tooltip contentStyle={PO_CHART_THEME.tooltipStyle} formatter={(v) => `${v}%`} />
          {EMOTION_LABELS.map((label) => (
            <Bar key={label} dataKey={label} stackId="a" fill={EMOTION_COLORS[label]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * 分时 × 媒体小热力 — 12 桶 × N 媒体的色块网格。
 * 色 = blueScale(count),字色 = contrastTextOn(bg);keyboard Tab 可达。
 */
function HourlyMediaHeat({ rows, hourlyLabels }) {
  const [hover, setHover] = useState(null) // { row, col }
  if (!Array.isArray(rows) || rows.length === 0) {
    return <p className="po-tile-state">暂无数据</p>
  }
  const max = Math.max(1, ...rows.flatMap((r) => r.hours))
  const scale = blueScale(max)
  const labels = hourlyLabels ?? rows[0]?.hours.map((_, i) => `${String(i * 2).padStart(2, '0')}时`)
  return (
    <div
      className="po-hourly-heat"
      role="table"
      aria-label="今日分时 × 媒体热力"
      onMouseLeave={() => setHover(null)}
      data-active-col={hover?.col ?? ''}
    >
      <div className="po-hourly-heat-head" role="row">
        <span />
        {labels.map((l, i) => (
          <span
            key={l}
            role="columnheader"
            className={hover?.col === i ? 'is-active' : ''}
          >
            {l}
          </span>
        ))}
      </div>
      {rows.map((row, rIdx) => (
        <div
          className={`po-hourly-heat-row${hover?.row === rIdx ? ' is-active' : ''}`}
          role="row"
          key={row.media}
        >
          <span
            className={`po-hourly-heat-axis${hover?.row === rIdx ? ' is-active' : ''}`}
            role="rowheader"
            title={row.media}
          >
            {row.media}
          </span>
          {row.hours.map((v, i) => {
            const bg = scale(v)
            const active = hover?.row === rIdx || hover?.col === i
            return (
              <span
                key={i}
                role="cell"
                tabIndex={0}
                className={`po-hourly-heat-cell${active ? ' is-active' : ''}${hover?.row === rIdx && hover?.col === i ? ' is-focus' : ''}`}
                style={{ background: bg, color: contrastTextOn(bg) }}
                title={`${row.media} · ${labels[i] ?? i}:${v}`}
                onMouseEnter={() => setHover({ row: rIdx, col: i })}
                onFocus={() => setHover({ row: rIdx, col: i })}
                onBlur={() => setHover(null)}
              >
                {v > 0 ? v : ''}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function avgOf(points, key = 'count') {
  if (!points || points.length === 0) return 0
  return points.reduce((s, p) => s + (p[key] ?? 0), 0) / points.length
}

/**
 * 信息流过滤 chips — 「全部 / 风险 / 各平台」。
 */
function FeedChips({ items, selected, onSelect }) {
  const counts = useMemo(() => {
    const c = { all: items.length, risk: 0 }
    for (const it of items) {
      if (it.risk) c.risk += 1
      const p = it.platform || ''
      if (p) c[p] = (c[p] ?? 0) + 1
    }
    return c
  }, [items])
  const platforms = useMemo(() => {
    const set = new Set()
    for (const it of items) if (it.platform) set.add(it.platform)
    return Array.from(set)
  }, [items])

  const chip = (key, text) => (
    <button
      key={key}
      type="button"
      role="button"
      aria-pressed={selected === key}
      className={`po-feed-chip${selected === key ? ' is-active' : ''}`}
      onClick={() => onSelect(key)}
    >
      <span>{text}</span>
      <span className="po-feed-chip-count">{counts[key] ?? 0}</span>
    </button>
  )

  return (
    <div className="po-feed-chips" role="toolbar" aria-label="信息流过滤">
      {chip('all', '全部')}
      {chip('risk', '风险')}
      {platforms.map((p) => chip(p, p))}
    </div>
  )
}

/**
 * 受 prefers-reduced-motion 与 visibilityState 守护的轮询 hook。
 * 在 callback 抛错时静默(setLatestNews 内部已 try/catch 即可)。
 * 重要:disabled=true 时完全不启动 interval。
 */
function useInterval(callback, delay, { disabled = false } = {}) {
  const savedRef = useRef(callback)
  useEffect(() => {
    savedRef.current = callback
  }, [callback])
  useEffect(() => {
    if (disabled || delay == null) return
    let id
    const start = () => {
      stop()
      id = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
        savedRef.current?.()
      }, delay)
    }
    const stop = () => {
      if (id) clearInterval(id)
      id = null
    }
    start()
    const onVisibility = () => {
      // 切回前台立即拉一次(可选);为避免双拉,这里只重置 timer 节奏
      if (document.visibilityState === 'visible') {
        savedRef.current?.()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [delay, disabled])
}

// ───────────────────────────── 主组件 ─────────────────────────────

export function PublicOpinionOverviewDashboard() {
  const [state, setState] = useState({ status: 'loading', payload: null })
  const [feedFilter, setFeedFilter] = useState('all')

  useEffect(() => {
    let active = true
    async function load() {
      try {
        // v2:在 dev 环境下若 URL 带 ?mock=1 转发到 API
        const url = new URL('/api/public-opinion/overview', window.location.origin)
        const isMockUrl = new URLSearchParams(window.location.search).get('mock') === '1'
        if (isMockUrl) url.searchParams.set('mock', '1')
        const res = await fetch(url.toString())
        const payload = await res.json()
        if (active) {
          setState({ status: 'ready', payload })
          if (payload?.mock) {
            console.info('[public-opinion] mock 模式生效 — 轮询已停用')
          }
        }
      } catch (err) {
        if (active) setState({ status: 'error', payload: null, error: String(err?.message ?? err) })
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  const payload = state.payload ?? {}
  const isMock = Boolean(payload.mock)

  // v2:30s 轮询(仅信息流),mock 模式与 reduced-motion 不影响轮询(轮询是数据,非动画)
  useInterval(
    async () => {
      try {
        const res = await fetch('/api/public-opinion/overview?slice=latest')
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data?.latestNews)) {
          setState((s) =>
            s.status === 'ready'
              ? { ...s, payload: { ...s.payload, latestNews: data.latestNews } }
              : s,
          )
        }
      } catch {
        // 静默失败:轮询失败不打扰主视图
      }
    },
    30_000,
    { disabled: state.status !== 'ready' || isMock },
  )

  if (state.status === 'loading') {
    return (
      <div className="po-dashboard">
        <div className="po-overview-main">
          <section className="po-rail po-skeleton" style={{ minHeight: 68 }} />
          {['态势', '结构', '热点'].map((label) => (
            <section className="po-band" key={label}>
              <span className="po-band-label">
                {label}
                <span className="po-band-label-latin">loading</span>
              </span>
              <div className="po-band-grid">
                {[8, 4, 4].map((span, i) => (
                  <div
                    key={i}
                    className="po-tile po-skeleton"
                    data-span={span}
                    style={{ minHeight: 200 }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
        <aside className="po-overview-aside">
          <section className="po-panel console-section po-skeleton" style={{ minHeight: 480 }} />
        </aside>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <section className="console-section placeholder-state">
        <h2>看板加载失败</h2>
        <p>{state.error}</p>
      </section>
    )
  }

  if (payload.configured === false) {
    return (
      <section className="console-section placeholder-state">
        <h2>舆情接口未配置</h2>
        <p>
          请在 <code>.env.local</code> 配置 <code>PUBLIC_OPINION_API_BASE</code> /{' '}
          <code>PUBLIC_OPINION_API_USERNAME</code> / <code>PUBLIC_OPINION_API_PASSWORD</code> 后重试。
        </p>
      </section>
    )
  }

  const errors = payload.errors ?? {}
  const weekly = payload.weeklyTrend
  const sentiment = payload.sentimentDistribution
  const media = payload.mediaShare
  const matrix = payload.mediaSentimentMatrix
  const todayPlatform = payload.todayPlatformShare
  const warnings = payload.warnings
  const hot = payload.topHotNews
  const latest = payload.latestNews ?? []
  const weeklySentiment = payload.weeklySentiment
  const todayHourlyByMedia = payload.todayHourlyByMedia
  const hourlyLabels = payload.todayHourly?.points?.map((p) => p.label)

  const sentimentTotal = (sentiment ?? []).reduce((sum, item) => sum + item.count, 0)
  const mediaTop = (media ?? []).slice(0, 6)
  const platformTop = (todayPlatform ?? []).slice(0, 6)
  const hotTop = (hot ?? []).slice(0, 10)

  // 信息流前端过滤
  const filteredLatest = latest.filter((item) => {
    if (feedFilter === 'all') return true
    if (feedFilter === 'risk') return Boolean(item.risk)
    return item.platform === feedFilter
  })

  return (
    <div className="po-dashboard">
      <div className="po-overview-main">
        <KpiRail
          data={payload.kpis}
          error={errors.kpis}
          weeklyPoints={weekly?.points}
          warnings={warnings}
          warningsError={errors.warnings}
        />

        <Band label="态势" latin="trend">
          <Panel
            title="情感 × 时间趋势"
            subtitle="近 7 天 · 5 模态堆叠"
            span="12"
            error={errors.weeklyTrend}
            empty={Array.isArray(weeklySentiment) && weeklySentiment.length === 0}
          >
            {weeklySentiment ? <StackedSentimentArea data={weeklySentiment} /> : null}
          </Panel>

          <Panel
            title="今日分时 × 媒体"
            subtitle="12 桶 × 平台"
            span="12"
            error={errors.todayHourly}
            empty={Array.isArray(todayHourlyByMedia) && todayHourlyByMedia.length === 0}
          >
            {todayHourlyByMedia ? (
              <HourlyMediaHeat rows={todayHourlyByMedia} hourlyLabels={hourlyLabels} />
            ) : null}
          </Panel>
        </Band>

        <Band label="结构" latin="composition">
          <Panel
            title="媒体 × 情感矩阵"
            subtitle="近 7 天 · 各平台情感构成"
            span="6"
            error={errors.mediaSentimentMatrix}
            empty={matrix && matrix.length === 0}
          >
            {matrix ? <Heatmap rows={matrix} /> : null}
          </Panel>

          <Panel
            title="媒体 × 情感百分比"
            subtitle="各平台情感占比"
            span="6"
            error={errors.mediaSentimentMatrix}
            empty={matrix && matrix.length === 0}
          >
            {matrix ? <MediaSentimentPercentBar rows={matrix} /> : null}
          </Panel>

          <Panel
            title="情感分布"
            subtitle="近 7 天 · 5 模态"
            span="12"
            error={errors.sentimentDistribution}
            empty={sentiment && sentimentTotal === 0}
          >
            {sentiment ? (
              <div className="po-mini-donut-row">
                {sentiment.map((entry) => (
                  <MiniDonut
                    key={entry.label}
                    label={entry.label}
                    value={entry.count}
                    total={sentimentTotal}
                    color={EMOTION_COLORS[entry.label] ?? '#98a2b3'}
                  />
                ))}
              </div>
            ) : null}
          </Panel>
        </Band>

        <Band label="热点" latin="hot spots">
          <Panel
            title="媒体来源占比"
            subtitle="近 7 天 · Top 6"
            span="4"
            error={errors.mediaShare}
            empty={media && media.length === 0}
          >
            {media ? (
              <ol className="po-ranklist">
                {mediaTop.map((entry, i) => (
                  <RankRow
                    key={entry.media}
                    rank={i + 1}
                    name={entry.media}
                    value={entry.count}
                    share={entry.share}
                    secondary={entry.count}
                  />
                ))}
              </ol>
            ) : null}
          </Panel>

          <Panel
            title="Top 热门信息"
            subtitle="近 7 天 · Top 10"
            span="4"
            error={errors.topHotNews}
            empty={hot && hot.length === 0}
          >
            {hot ? (
              <ol className="po-ranklist">
                {hotTop.map((item, i) => (
                  <RankRow
                    key={`${item.url}-${i}`}
                    rank={i + 1}
                    name={item.title || item.platform || '(无标题)'}
                    value={item.hotValue}
                    share={item.share}
                    secondary={item.hotValue}
                  />
                ))}
              </ol>
            ) : null}
          </Panel>

          <Panel
            title="今日平台分布"
            subtitle="今日各平台信息量"
            span="4"
            error={errors.todayPlatformShare}
            empty={todayPlatform && todayPlatform.length === 0}
          >
            {todayPlatform ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={platformTop} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={PO_CHART_THEME.grid} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={PO_CHART_THEME.axisTick} />
                  <YAxis type="category" dataKey="media" width={70} tick={PO_CHART_THEME.axisTick} />
                  <Tooltip contentStyle={PO_CHART_THEME.tooltipStyle} />
                  <Bar dataKey="count" name="信息量" radius={[0, 4, 4, 0]}>
                    {platformTop.map((entry, i) => (
                      <Cell key={entry.media} fill={MEDIA_COLORS[i % MEDIA_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </Panel>
        </Band>
      </div>

      <aside className="po-overview-aside">
        <section className="po-panel console-section" style={{ minHeight: 0 }}>
          <div className="po-feed-head">
            <h2>
              最新舆情信息流
              <span
                className={`po-live-dot${isMock ? ' is-mock' : ''}`}
                aria-label={isMock ? 'mock 模式' : '实时更新'}
                title={isMock ? 'mock' : '实时'}
              />
            </h2>
            <FeedChips items={latest} selected={feedFilter} onSelect={setFeedFilter} />
          </div>
          {errors.latestNews ? (
            <p className="po-tile-state is-error">信息流加载失败:{errors.latestNews}</p>
          ) : filteredLatest.length === 0 ? (
            <p className="po-tile-state">暂无数据</p>
          ) : (
            <ul className="po-feed" aria-live="polite">
              {filteredLatest.map((item, i) => (
                <li
                  key={`${item.url}-${i}`}
                  className={`po-feed-item${item.risk ? ' is-risk' : ''}`}
                  data-emo={item.sentiment ?? ''}
                >
                  <span
                    className="po-feed-emo-bar"
                    aria-hidden="true"
                    style={{ background: EMOTION_COLORS[item.sentiment] ?? '#dcdfe6' }}
                  />
                  <div className="po-feed-main">
                    <a href={item.url || undefined} target="_blank" rel="noreferrer" className="po-feed-title">
                      {item.risk ? <span className="po-tag is-risk">风险</span> : null}
                      {item.title || '(无标题)'}
                    </a>
                    <span className="po-feed-meta">
                      {item.platform}
                      {item.keyword ? ` · ${item.keyword}` : ''}
                      {item.pubTime ? ` · ${item.pubTime}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  )
}
