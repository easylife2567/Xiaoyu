'use client'

/**
 * 平台 logo SVG 组件 — 内联,无外部依赖。
 *
 * 给「正负面舆情」表格 / chip 提供品牌徽标。
 * 设计原则:
 *  - 单色描边或单色填充,默认用 currentColor,让父级 CSS 控制色调
 *  - 16×16 viewBox,内边距 1px,确保紧凑显示
 *  - 没匹配到平台时回退到通用 globe 图标
 *  - 平台名匹配大小写不敏感,允许「谷歌全网 / Google / google / Twitter / X / 微博」等同义词
 */

import React from 'react'

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

// 16×16 单色平台 SVG;不画背景圆,留给外层 .po-platform-logo
const PLATFORM_LOGOS = {
  google: {
    label: 'Google',
    accent: '#4285f4',
    paths: (
      <g>
        {/* Google G:沿用官方 4 段彩色,但我们走单色 + accent 边框,只画 G 字形 */}
        <path
          d="M15 8.2c0 3.9-2.7 6.6-7 6.6A6.8 6.8 0 1 1 12.7 3.4l-2 2A4 4 0 1 0 12 9.5H8.2V7.2H15c.0.3.0.6 0 1z"
          fill="currentColor"
        />
      </g>
    ),
  },
  twitter: {
    label: 'X',
    accent: '#0f1419',
    paths: (
      <g>
        {/* X (前 Twitter) 的当前 logo:两条交叉折线 */}
        <path
          d="M2.5 2.5h2.7l3.4 4.6 3.8-4.6h2.1l-4.8 5.8 5 6.7h-2.7l-3.7-5-4.1 5H2l5.1-6.2L2.5 2.5zm1.3.9 8.2 10.7h1.3L5.1 3.4H3.8z"
          fill="currentColor"
        />
      </g>
    ),
  },
  weibo: {
    label: '微博',
    accent: '#e6162d',
    paths: (
      <g>
        {/* 微博:简化为眼睛 + 笑脸 */}
        <ellipse cx="7.5" cy="9" rx="5.5" ry="3.5" {...STROKE_PROPS} />
        <circle cx="6.2" cy="9.2" r="1.4" fill="currentColor" />
        <circle cx="6.6" cy="8.8" r="0.5" fill="#fff" />
        <path d="M11.5 5.5c0-1.4 1.5-2 2.5-1.2.8.6.6 1.6.2 2" {...STROKE_PROPS} />
        <path d="M13.5 4.2c0.6-0.4 1.2 0 1 0.6" {...STROKE_PROPS} />
      </g>
    ),
  },
  telegram: {
    label: 'Telegram',
    accent: '#229ed9',
    paths: (
      <g>
        {/* Telegram 纸飞机 */}
        <path
          d="M14 3 2.5 7.3l3.5 1.3 1 3.4 1.8-1.8L11.7 13l2.3-10z M6 8.6l8-5.2-6 5.9.3 2.5"
          fill="currentColor"
        />
      </g>
    ),
  },
  facebook: {
    label: 'Facebook',
    accent: '#1877f2',
    paths: (
      <g>
        {/* Facebook f */}
        <path
          d="M9.8 14.5V8.6h2l.3-2.3H9.8V4.8c0-.7.2-1.1 1.1-1.1h1.2V1.6c-.2 0-.9-.1-1.8-.1-1.7 0-2.9 1-2.9 3v1.8H5.5v2.3h1.9v5.9h2.4z"
          fill="currentColor"
        />
      </g>
    ),
  },
  reddit: {
    label: 'Reddit',
    accent: '#ff4500',
    paths: (
      <g>
        {/* Reddit 圆头小机器人 */}
        <circle cx="8" cy="9" r="5.5" {...STROKE_PROPS} />
        <circle cx="13.5" cy="3.5" r="1.2" {...STROKE_PROPS} />
        <line x1="8" y1="3.5" x2="12.5" y2="3.7" {...STROKE_PROPS} />
        <circle cx="6" cy="9" r="0.8" fill="currentColor" />
        <circle cx="10" cy="9" r="0.8" fill="currentColor" />
        <path d="M5.5 11.2c.8.6 1.7 1 2.5 1s1.7-.4 2.5-1" {...STROKE_PROPS} />
      </g>
    ),
  },
  youtube: {
    label: 'YouTube',
    accent: '#ff0000',
    paths: (
      <g>
        <rect x="1.5" y="4" width="13" height="8" rx="2" {...STROKE_PROPS} />
        <path d="m6.8 6.5 4 1.5-4 1.5z" fill="currentColor" />
      </g>
    ),
  },
  instagram: {
    label: 'Instagram',
    accent: '#e4405f',
    paths: (
      <g>
        <rect x="2" y="2" width="12" height="12" rx="3" {...STROKE_PROPS} />
        <circle cx="8" cy="8" r="3" {...STROKE_PROPS} />
        <circle cx="11.5" cy="4.5" r="0.6" fill="currentColor" />
      </g>
    ),
  },
  tiktok: {
    label: 'TikTok',
    accent: '#000000',
    paths: (
      <g>
        <path
          d="M11 1.5c.3 1.4 1.3 2.5 2.7 2.8v2.1c-1 .1-1.9-.2-2.7-.7v4.6a3.9 3.9 0 1 1-3.9-3.9c.2 0 .4 0 .6 0v2.2c-.2-.1-.4-.1-.6-.1a1.7 1.7 0 1 0 1.7 1.7V1.5z"
          fill="currentColor"
        />
      </g>
    ),
  },
  linkedin: {
    label: 'LinkedIn',
    accent: '#0a66c2',
    paths: (
      <g>
        <rect x="2" y="2" width="12" height="12" rx="1.5" {...STROKE_PROPS} />
        <rect x="4.2" y="6.5" width="1.6" height="5" fill="currentColor" />
        <circle cx="5" cy="4.7" r="0.9" fill="currentColor" />
        <path
          d="M7 6.5h1.6v.8c.3-.5.9-.9 1.8-.9 1.4 0 2 .9 2 2.4v2.7h-1.6V9.3c0-.7-.3-1.2-1-1.2s-1.2.5-1.2 1.2v2.2H7v-5z"
          fill="currentColor"
        />
      </g>
    ),
  },
  webo: { alias: 'weibo' },
  x: { alias: 'twitter' },
  '谷歌全网': { alias: 'google' },
  '微博': { alias: 'weibo' },
  '抖音': { alias: 'tiktok' },
  '推特': { alias: 'twitter' },
}

const GLOBE_LOGO = {
  label: '其他来源',
  accent: '#86909c',
  paths: (
    <g {...STROKE_PROPS}>
      <circle cx="8" cy="8" r="5.8" />
      <ellipse cx="8" cy="8" rx="2.6" ry="5.8" />
      <line x1="2.2" y1="8" x2="13.8" y2="8" />
    </g>
  ),
}

function resolveKey(name) {
  if (!name) return null
  const lower = String(name).toLowerCase()
  // 精确匹配
  if (PLATFORM_LOGOS[lower]) {
    const entry = PLATFORM_LOGOS[lower]
    return entry.alias ? entry.alias : lower
  }
  if (PLATFORM_LOGOS[name]) {
    const entry = PLATFORM_LOGOS[name]
    return entry.alias ? entry.alias : name
  }
  // 模糊匹配
  for (const k of Object.keys(PLATFORM_LOGOS)) {
    if (lower.includes(k) || name.includes(k)) {
      const entry = PLATFORM_LOGOS[k]
      return entry.alias ? entry.alias : k
    }
  }
  return null
}

/**
 * PlatformLogo
 *  - platform: 平台名 (中文或英文皆可)
 *  - size: 像素大小, 默认 16
 *  - colorize: true 用品牌色, false (默认) 用 currentColor
 *  - withLabel: true 时返回 logo + 平台名 横排
 */
export function PlatformLogo({ platform, size = 16, colorize = false, withLabel = false, className }) {
  const key = resolveKey(platform)
  const entry = key ? PLATFORM_LOGOS[key] : GLOBE_LOGO
  const color = colorize ? entry.accent : undefined
  const svg = (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      role="img"
      aria-label={`${entry.label || platform || '未知平台'} 标识`}
      style={color ? { color } : undefined}
      className={className}
    >
      {entry.paths || GLOBE_LOGO.paths}
    </svg>
  )
  if (!withLabel) return svg
  return (
    <span className="po-platform-tag" data-platform={key ?? 'other'}>
      {svg}
      <span>{platform || entry.label}</span>
    </span>
  )
}

export { PLATFORM_LOGOS }
