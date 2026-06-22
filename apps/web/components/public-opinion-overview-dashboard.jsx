'use client'

import React, { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Label,
  Cell,
} from 'recharts'
import {
  blueScale,
  contrastTextOn,
  donutArcPath,
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

function Panel({ title, subtitle, error, empty, span = 6, children }) {
  return (
    <section className="po-panel console-section" data-span={span}>
      <header className="po-panel-head">
        <h2>{title}</h2>
        {subtitle ? <span>{subtitle}</span> : null}
      </header>
      {error ? (
        <p className="po-panel-state is-error">数据加载失败:{error}</p>
      ) : empty ? (
        <p className="po-panel-state">暂无数据</p>
      ) : (
        children
      )}
    </section>
  )
}

function KpiTile({ label, value, icon }) {
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
      </div>
    </div>
  )
}

function KpiBar({ data, error }) {
  return (
    <section className="po-panel console-section po-kpi-bar" data-span={12}>
      {error ? (
        <p className="po-panel-state is-error">KPI 加载失败:{error}</p>
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
          />
          <KpiTile
            label="当日信息量"
            value={data?.todayInfoCount ?? 0}
            icon={
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h10M4 18h16" />
              </svg>
            }
          />
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

function avgOf(points, key = 'count') {
  if (!points || points.length === 0) return 0
  return points.reduce((s, p) => s + (p[key] ?? 0), 0) / points.length
}

// ───────────────────────────── 主组件 ─────────────────────────────

export function PublicOpinionOverviewDashboard() {
  const [state, setState] = useState({ status: 'loading', payload: null })

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const res = await fetch('/api/public-opinion/overview')
        const payload = await res.json()
        if (active) setState({ status: 'ready', payload })
      } catch (err) {
        if (active) setState({ status: 'error', payload: null, error: String(err?.message ?? err) })
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  if (state.status === 'loading') {
    return (
      <div className="po-dashboard">
        <div className="po-grid-12">
          <section className="po-panel console-section po-skeleton" data-span={12} style={{ minHeight: 76 }} />
          {[6, 6, 6, 6, 4, 4, 4, 12, 12].map((span, i) => (
            <section
              key={i}
              className="po-panel console-section po-skeleton"
              data-span={span}
              style={{ minHeight: span === 12 ? 220 : 240 }}
            />
          ))}
        </div>
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

  const payload = state.payload ?? {}

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
  const hourly = payload.todayHourly
  const sentiment = payload.sentimentDistribution
  const media = payload.mediaShare
  const matrix = payload.mediaSentimentMatrix
  const todayPlatform = payload.todayPlatformShare
  const warnings = payload.warnings
  const hot = payload.topHotNews
  const latest = payload.latestNews

  const sentimentTotal = (sentiment ?? []).reduce((sum, item) => sum + item.count, 0)
  const mediaTop = (media ?? []).slice(0, 7)
  const platformTop = (todayPlatform ?? []).slice(0, 7)
  const weeklyAvg = avgOf(weekly?.points)
  const hourlyAvg = avgOf(hourly?.points)
  const hotTop = (hot ?? []).slice(0, 10)

  return (
    <div className="po-dashboard">
      <div className="po-grid-12">
        <KpiBar data={payload.kpis} error={errors.kpis} />

        <Panel
          title="本周舆情趋势"
          subtitle="近 7 天每日量"
          span={6}
          error={errors.weeklyTrend}
          empty={weekly && weekly.points.length === 0}
        >
          {weekly ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weekly.points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={PO_CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="label" tick={PO_CHART_THEME.axisTick} />
                <YAxis allowDecimals={false} tick={PO_CHART_THEME.axisTick} />
                <Tooltip contentStyle={PO_CHART_THEME.tooltipStyle} />
                <ReferenceLine y={weeklyAvg} stroke="#86909c" strokeDasharray="4 4">
                  <Label value={`Avg ${weeklyAvg.toFixed(1)}`} position="right" fill="#86909c" fontSize={11} />
                </ReferenceLine>
                <Bar dataKey="count" name="舆情量" radius={[4, 4, 0, 0]} fill={PO_CHART_THEME.primary} />
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </Panel>

        <Panel
          title="情感分布"
          subtitle="近 7 天"
          span={6}
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

        <Panel
          title="今日分时趋势"
          subtitle="按 2 小时分桶"
          span={6}
          error={errors.todayHourly}
          empty={hourly && hourly.total === 0}
        >
          {hourly ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={hourly.points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={PO_CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="label" tick={PO_CHART_THEME.axisTick} />
                <YAxis allowDecimals={false} tick={PO_CHART_THEME.axisTick} />
                <Tooltip contentStyle={PO_CHART_THEME.tooltipStyle} />
                <ReferenceLine y={hourlyAvg} stroke="#86909c" strokeDasharray="4 4">
                  <Label value={`Avg ${hourlyAvg.toFixed(1)}`} position="right" fill="#86909c" fontSize={11} />
                </ReferenceLine>
                <Line
                  type="monotone"
                  dataKey="count"
                  name="信息量"
                  stroke={PO_CHART_THEME.accent}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </Panel>

        <Panel
          title="今日平台分布"
          subtitle="今日各平台信息量"
          span={6}
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

        <Panel
          title="媒体来源占比"
          subtitle="近 7 天 · Top 7"
          span={4}
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
          span={4}
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

        <Panel title="预警概览" subtitle="近 7 天" span={4} error={errors.warnings}>
          {warnings ? (
            <div className="po-warning">
              <div className="po-warning-cards">
                <div className="po-warning-card">
                  <span>预警总量</span>
                  <strong>{warnings.warningTotal}</strong>
                </div>
                <div className="po-warning-card is-major">
                  <span>重大预警</span>
                  <strong>{warnings.majorTotal}</strong>
                </div>
              </div>
              {warnings.topWords.length > 0 ? (
                <div className="po-wordcloud">
                  {warnings.topWords.map((w, i) => (
                    <span key={w.word} style={{ fontSize: `${0.8 + Math.min(i === 0 ? 0.6 : 0.4 / (i + 1), 0.6)}rem` }}>
                      {w.word}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="po-panel-state">当前无预警</p>
              )}
            </div>
          ) : null}
        </Panel>

        <Panel
          title="媒体 × 情感矩阵"
          subtitle="近 7 天 · 各平台情感构成"
          span={12}
          error={errors.mediaSentimentMatrix}
          empty={matrix && matrix.length === 0}
        >
          {matrix ? <Heatmap rows={matrix} /> : null}
        </Panel>

        <Panel
          title="最新舆情信息流"
          subtitle="近 7 天 · 最新 15 条"
          span={12}
          error={errors.latestNews}
          empty={latest && latest.length === 0}
        >
          {latest ? (
            <ul className="po-feed">
              {latest.map((item, i) => (
                <li key={`${item.url}-${i}`}>
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
          ) : null}
        </Panel>
      </div>
    </div>
  )
}
