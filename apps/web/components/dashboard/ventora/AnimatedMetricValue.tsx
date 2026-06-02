'use client'

import { useMemo } from 'react'

type Props = {
  value: string
  className?: string
}

/** Stable metric display — avoids count-up re-triggers that flash false intermediate values. */
export function AnimatedMetricValue({ value, className }: Props) {
  const display = useMemo(() => value, [value])

  return (
    <span className={className} aria-live="polite">
      {display}
    </span>
  )
}
