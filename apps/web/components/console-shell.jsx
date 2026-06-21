'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { WORKBENCHES } from '../src/workbenches.js'
import { Icon } from '../src/icons.jsx'

const topNavigation = ['工作台', '任务', '资源池', '文档']

const navigationGroups = [
  {
    title: '工作台',
    items: [
      { slug: 'overview', href: '/', title: '工作台总览' },
      ...WORKBENCHES,
    ],
  },
  {
    title: '舆情速览',
    items: [
      { slug: 'po-overview', href: '/public-opinion', title: '舆情总览', icon: 'po-overview' },
      {
        slug: 'po-daily',
        title: '每日舆情',
        icon: 'po-daily',
        children: [
          { slug: 'po-daily-polarity', href: '/public-opinion/daily/polarity', title: '正负面舆情' },
          { slug: 'po-daily-summary', href: '/public-opinion/daily', title: '每日舆情' },
          { slug: 'po-daily-trends', href: '/public-opinion/daily/trends', title: '趋势与占比' },
        ],
      },
      {
        slug: 'po-sentiment',
        title: '情感倾向',
        icon: 'po-sentiment',
        children: [
          { slug: 'po-sentiment-today', href: '/public-opinion/sentiment/today', title: '今日情感分析' },
          { slug: 'po-sentiment-range', href: '/public-opinion/sentiment/range', title: '任意时间段情感分析' },
        ],
      },
    ],
  },
  {
    title: '管理',
    items: [
      { slug: 'artifacts', href: '/artifacts', title: '产物归档' },
      { slug: 'settings', href: '/settings', title: '权限管理' },
    ],
  },
]

function findActiveSubgroupSlug(activeSlug) {
  for (const group of navigationGroups) {
    for (const item of group.items) {
      if (item.children?.some((child) => child.slug === activeSlug)) {
        return item.slug
      }
    }
  }
  return null
}

const quickTools = [
  { id: 'recent', title: '最近任务', label: '最近' },
  { id: 'help', title: '使用帮助', label: '帮助' },
  { id: 'feedback', title: '反馈入口', label: '反馈' },
]

function resolveHref(item) {
  return item.href ?? `/workbenches/${item.slug}`
}

export function ConsoleShell({ activeSlug = 'overview', eyebrow, title, description, children, actions }) {
  const [collapsed, setCollapsed] = useState(false)
  const [expandedSubgroups, setExpandedSubgroups] = useState(() => {
    const active = findActiveSubgroupSlug(activeSlug)
    return active ? new Set([active]) : new Set()
  })

  function toggleSubgroup(slug) {
    setExpandedSubgroups((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  return (
    <div className={collapsed ? 'console-shell is-collapsed' : 'console-shell'}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="console-topbar">
        <div className="topbar-left">
          <button
            aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}
            className="icon-button"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          <div className="console-brand">
            <span className="brand-mark" aria-hidden="true" />
            <strong>小舆工作台</strong>
          </div>
          <nav className="top-nav" aria-label="顶部导航">
            {topNavigation.map((item, index) => (
              <button className={index === 0 ? 'is-active' : ''} key={item} type="button">
                {item}
              </button>
            ))}
          </nav>
        </div>

        <div className="topbar-tools">
          <button type="button">帮助</button>
          <span className="operator-chip">easylife2567</span>
        </div>
      </header>

      <aside className="console-sidebar" aria-label="主导航">
        <nav className="sidebar-nav">
          {navigationGroups.map((group) => (
            <section className="nav-group" key={group.title}>
              <p>{group.title}</p>
              {group.items.map((item) => {
                if (item.children) {
                  const expanded = expandedSubgroups.has(item.slug)
                  return (
                    <div className="nav-subgroup" key={item.slug}>
                      <button
                        aria-expanded={expanded}
                        className="nav-item nav-subgroup-toggle"
                        onClick={() => toggleSubgroup(item.slug)}
                        type="button"
                      >
                        <Icon name={item.icon ?? item.slug} />
                        <strong>{item.title}</strong>
                        <span className={expanded ? 'nav-chevron is-open' : 'nav-chevron'} aria-hidden="true" />
                      </button>
                      {expanded ? (
                        <div className="nav-subitems">
                          {item.children.map((child) => {
                            const childActive = child.slug === activeSlug
                            return (
                              <Link
                                className={childActive ? 'nav-item nav-subitem is-active' : 'nav-item nav-subitem'}
                                href={resolveHref(child)}
                                key={child.slug}
                              >
                                <strong>{child.title}</strong>
                              </Link>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                }

                const active = item.slug === activeSlug
                return (
                  <Link className={active ? 'nav-item is-active' : 'nav-item'} href={resolveHref(item)} key={item.slug}>
                    <Icon name={item.icon ?? item.slug} />
                    <strong>{item.title}</strong>
                  </Link>
                )
              })}
            </section>
          ))}
        </nav>
      </aside>

      <section className="console-stage">
        <main className="console-content" id="main-content">
          <header className="page-heading">
            <div>
              <p className="page-eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {actions ? <div className="page-actions">{actions}</div> : null}
          </header>
          {children}
        </main>

        <aside className="utility-rail" aria-label="快捷工具">
          {quickTools.map((tool) => (
            <button aria-label={tool.title} key={tool.id} type="button">
              <Icon name={tool.id} />
              <span>{tool.label}</span>
            </button>
          ))}
        </aside>
      </section>
    </div>
  )
}
