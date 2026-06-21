'use client'

import React, { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

const EMOTION_COLORS = {
  正面: '#1f9d55',
  偏正面: '#7bc47f',
  中立: '#98a2b3',
  偏负面: '#f0a13c',
  负面: '#e0533d',
}
const MEDIA_COLORS = ['#3461ff', '#1f9d55', '#f0a13c', '#9b5de5', '#e0533d', '#26c6da', '#98a2b3']

function Panel({ title, subtitle, error, empty, wide, children }) {
  return (
    <section className={wide ? 'po-panel console-section po-panel--wide' : 'po-panel console-section'}>
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

function KpiCards({ data, error }) {
  const cards = [
    { key: 'todayCount', label: '今日舆情量' },
    { key: 'weekCount', label: '本周舆情量' },
    { key: 'todayInfoCount', label: '当日信息量' },
  ]
  return (
    <div className="po-kpi-row">
      {cards.map((card) => (
        <div className="po-kpi-card" key={card.key}>
          <span className="po-kpi-label">{card.label}</span>
          <strong className="po-kpi-value">{error || !data ? '—' : (data[card.key] ?? 0)}</strong>
        </div>
      ))}
    </div>
  )
}

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
        <div className="po-kpi-row">
          {[0, 1, 2].map((i) => (
            <div className="po-kpi-card po-skeleton" key={i} />
          ))}
        </div>
        <div className="po-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="po-panel console-section po-skeleton" key={i} />
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

  return (
    <div className="po-dashboard">
      <KpiCards data={payload.kpis} error={errors.kpis} />

      <div className="po-grid">
        <Panel
          title="本周舆情趋势"
          subtitle="近 7 天每日量"
          error={errors.weeklyTrend}
          empty={weekly && weekly.points.length === 0}
        >
          {weekly ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weekly.points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="舆情量" stroke="#3461ff" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </Panel>

        <Panel
          title="今日分时趋势"
          subtitle="按 2 小时分桶"
          error={errors.todayHourly}
          empty={hourly && hourly.total === 0}
        >
          {hourly ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={hourly.points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" name="信息量" stroke="#9b5de5" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : null}
        </Panel>

        <Panel
          title="情感分布"
          subtitle="近 7 天"
          error={errors.sentimentDistribution}
          empty={sentiment && sentimentTotal === 0}
        >
          {sentiment ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sentiment} dataKey="count" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {sentiment.map((entry) => (
                    <Cell key={entry.label} fill={EMOTION_COLORS[entry.label] ?? '#98a2b3'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
          {sentiment && sentimentTotal > 0 ? (
            <ul className="po-legend">
              {sentiment.map((entry) => (
                <li key={entry.label}>
                  <span className="po-dot" style={{ background: EMOTION_COLORS[entry.label] ?? '#98a2b3' }} />
                  {entry.label} <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <Panel
          title="媒体来源占比"
          subtitle="近 7 天"
          error={errors.mediaShare}
          empty={media && media.length === 0}
        >
          {media ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={mediaTop} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="media" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="信息量" radius={[0, 4, 4, 0]}>
                  {mediaTop.map((entry, i) => (
                    <Cell key={entry.media} fill={MEDIA_COLORS[i % MEDIA_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </Panel>

        <Panel
          title="媒体 × 情感矩阵"
          subtitle="近 7 天 · 各平台情感构成"
          error={errors.mediaSentimentMatrix}
          empty={matrix && matrix.length === 0}
          wide
        >
          {matrix ? (
            <ResponsiveContainer width="100%" height={Math.max(200, (matrix.length || 1) * 34 + 40)}>
              <BarChart data={matrix} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="media" width={88} tick={{ fontSize: 12 }} />
                <Tooltip />
                {['正面', '偏正面', '中立', '偏负面', '负面'].map((label) => (
                  <Bar key={label} dataKey={label} name={label} stackId="emotion" fill={EMOTION_COLORS[label]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </Panel>

        <Panel
          title="今日平台分布"
          subtitle="今日各平台信息量"
          error={errors.todayPlatformShare}
          empty={todayPlatform && todayPlatform.length === 0}
        >
          {todayPlatform ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={platformTop} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="media" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="信息量" radius={[0, 4, 4, 0]}>
                  {platformTop.map((entry, i) => (
                    <Cell key={entry.media} fill={MEDIA_COLORS[i % MEDIA_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : null}
        </Panel>

        <Panel title="预警概览" subtitle="近 7 天" error={errors.warnings}>
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
                    <span key={w.word} style={{ fontSize: `${0.8 + Math.min(i === 0 ? 0.8 : 0.6 / (i + 1), 0.8)}rem` }}>
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
          title="Top 热门信息"
          subtitle="近 7 天"
          error={errors.topHotNews}
          empty={hot && hot.length === 0}
        >
          {hot ? (
            <ol className="po-hotlist">
              {hot.map((item, i) => (
                <li key={`${item.url}-${i}`}>
                  <span className="po-hot-rank">{i + 1}</span>
                  <div className="po-hot-body">
                    <a href={item.url || undefined} target="_blank" rel="noreferrer" className="po-hot-title">
                      {item.title || '(无标题)'}
                    </a>
                    <span className="po-hot-meta">
                      {item.platform} · 热度 {item.hotValue}
                      {item.pubTime ? ` · ${item.pubTime}` : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </Panel>

        <Panel
          title="最新舆情信息流"
          subtitle="近 7 天 · 最新 15 条"
          error={errors.latestNews}
          empty={latest && latest.length === 0}
          wide
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
