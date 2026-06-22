'use client'

import { useEffect, useRef, useState } from 'react'
import { scaleSequential } from 'd3-scale'
import { interpolateBlues } from 'd3-scale-chromatic'
import { arc as d3arc } from 'd3-shape'
import { max as d3max } from 'd3-array'

// 舆情看板 d3 工具集 — 只用于"画 + 算色阶 + 数值插值",不直接操作 DOM。
// 所有动画受 prefers-reduced-motion 守护。

/**
 * 蓝色单色阶,把数值映射到 d3 interpolateBlues 上。
 * domain 起点收到 0.15 以避开极浅色不可读的部分,终点 0.95 以避免过黑。
 */
export function blueScale(maxValue) {
  const safe = maxValue > 0 ? maxValue : 1
  const scale = scaleSequential((t) => interpolateBlues(0.15 + t * 0.8)).domain([0, safe])
  return scale
}

/**
 * 对深底色返回白字、浅底色返回深字,粗略亮度阈值。
 */
export function contrastTextOn(rgbStr) {
  const m = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!m) return '#1d2129'
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.62 ? '#1d2129' : '#ffffff'
}

/**
 * 用 d3-shape.arc 算出环形扇区路径(MiniDonut 用)。
 * value/total 为 0..1 占比;size 为 SVG 边长。
 */
export function donutArcPath({ value, total, size = 54, thickness = 8, padAngle = 0.04 }) {
  const ratio = total > 0 ? Math.min(value / total, 1) : 0
  const radius = size / 2
  const generator = d3arc()
    .innerRadius(radius - thickness)
    .outerRadius(radius)
    .padAngle(padAngle)
    .cornerRadius(3)
  return {
    background: generator({ startAngle: 0, endAngle: Math.PI * 2 }),
    foreground: generator({ startAngle: 0, endAngle: ratio * Math.PI * 2 }),
    ratio,
  }
}

export { d3max }

/**
 * 数值滚动 hook。0 → target,持续 ms,easeOutCubic。
 * prefers-reduced-motion 下直接返回 target。
 */
export function useCountUp(target, ms = 800) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(0)
  const startRef = useRef(0)
  useEffect(() => {
    const target0 = Number.isFinite(target) ? target : 0
    if (typeof window === 'undefined') {
      setValue(target0)
      return
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || target0 === 0) {
      setValue(target0)
      return
    }
    startRef.current = performance.now()
    const tick = (now) => {
      const t = Math.min(1, (now - startRef.current) / ms)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target0 * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else setValue(target0)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, ms])
  return value
}
