'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { WORKBENCHES } from '../src/workbenches.js'

const filters = [
  { id: 'favorite', label: '常用工作台' },
  { id: 'all', label: '全部工作台' },
]

export function WorkbenchLauncher() {
  const [activeFilter, setActiveFilter] = useState('favorite')
  const [selectedSlug, setSelectedSlug] = useState(WORKBENCHES[0].slug)
  const visibleWorkbenches = useMemo(
    () => (activeFilter === 'favorite' ? WORKBENCHES.slice(0, 3) : WORKBENCHES),
    [activeFilter],
  )
  const selectedWorkbench = WORKBENCHES.find((item) => item.slug === selectedSlug) ?? WORKBENCHES[0]

  return (
    <section className="launcher-section">
      <header className="launcher-toolbar">
        <div className="segmented-control" role="tablist" aria-label="工作台筛选">
          {filters.map((filter) => (
            <button
              aria-selected={activeFilter === filter.id}
              className={activeFilter === filter.id ? 'is-active' : ''}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              role="tab"
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <Link className="primary-action" href={`/workbenches/${selectedWorkbench.slug}`}>
          选择工作台
        </Link>
      </header>

      <p className="recommendation-title">为你推荐以下工作台</p>

      <div className="recommendation-grid">
        {visibleWorkbenches.map((workbench) => {
          const selected = workbench.slug === selectedSlug
          return (
            <Link
              className={selected ? 'recommendation-card is-selected' : 'recommendation-card'}
              href={`/workbenches/${workbench.slug}`}
              key={workbench.slug}
              onMouseEnter={() => setSelectedSlug(workbench.slug)}
              onFocus={() => setSelectedSlug(workbench.slug)}
            >
              <div className="card-head">
                <span className="card-glyph" aria-hidden="true" />
                <em>{workbench.kind === 'file-processing' ? '文件处理' : '日报生产'}</em>
              </div>
              <strong>{workbench.title}</strong>
              <p>{workbench.description}</p>
              <footer>
                <span>{selected ? '当前选择' : '可进入'}</span>
                <em>{selected ? '进入工作台' : '点击进入'}</em>
              </footer>
            </Link>
          )
        })}
      </div>

      <button className="text-action" type="button" onClick={() => setActiveFilter('all')}>
        {activeFilter === 'all' ? '收起工作台' : '更多工作台'}
      </button>

      <div className="selection-hint" aria-live="polite">
        <strong>{selectedWorkbench.title}</strong>
        <span>{selectedWorkbench.subtitle}</span>
      </div>
    </section>
  )
}
