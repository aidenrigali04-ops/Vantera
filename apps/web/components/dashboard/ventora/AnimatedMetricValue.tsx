'use client'

import { DURATION, EASE_OUT } from '@/lib/motion'
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'

type ParsedMetric =
  | { kind: 'number'; target: number; prefix: string; suffix: string; decimals: number }
  | { kind: 'text'; display: string }

function parseMetricValue(value: string): ParsedMetric {
  const currency = value.match(/^\$([\d,]+(?:\.\d+)?)(.*)$/)
  if (currency?.[1]) {
    const num = Number.parseFloat(currency[1].replace(/,/g, ''))
    return {
      kind: 'number',
      target: Number.isFinite(num) ? num : 0,
      prefix: '$',
      suffix: currency[2] ?? '',
      decimals: value.includes('.') ? 2 : 0,
    }
  }

  const leadingNum = value.match(/^([\d,]+)(.*)$/)
  if (leadingNum?.[1]) {
    const num = Number.parseInt(leadingNum[1].replace(/,/g, ''), 10)
    if (Number.isFinite(num)) {
      return {
        kind: 'number',
        target: num,
        prefix: '',
        suffix: leadingNum[2] ?? '',
        decimals: 0,
      }
    }
  }

  return { kind: 'text', display: value }
}

function formatNumber(n: number, decimals: number, prefix: string, suffix: string): string {
  const formatted =
    decimals > 0
      ? n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      : Math.round(n).toLocaleString('en-US')
  return `${prefix}${formatted}${suffix}`
}

type Props = {
  value: string
  className?: string
}

export function AnimatedMetricValue({ value, className }: Props) {
  const reduced = useReducedMotion()
  const parsed = parseMetricValue(value)
  const motionValue = useMotionValue(0)
  const [display, setDisplay] = useState(value)

  useMotionValueEvent(motionValue, 'change', (latest) => {
    if (parsed.kind === 'number') {
      setDisplay(formatNumber(latest, parsed.decimals, parsed.prefix, parsed.suffix))
    }
  })

  useEffect(() => {
    if (parsed.kind === 'text' || reduced) {
      setDisplay(value)
      return
    }
    motionValue.set(0)
    setDisplay(formatNumber(0, parsed.decimals, parsed.prefix, parsed.suffix))
    const controls = animate(motionValue, parsed.target, {
      duration: DURATION.page,
      ease: EASE_OUT,
    })
    return () => controls.stop()
  }, [motionValue, parsed, reduced, value])

  return (
    <span className={className} aria-live="polite">
      {display}
    </span>
  )
}
