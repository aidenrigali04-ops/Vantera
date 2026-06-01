'use client'

import { useEffect, useRef, type RefObject } from 'react'

type Options = {
  /** Element id to focus on mount (e.g. fullName on signup). */
  initialFocusId?: string
  /** Re-run focus when this changes (mode toggle). */
  focusKey?: string
}

/**
 * Mobile-friendly auth form behavior:
 * - Focus first field after mount / mode change
 * - Blur active field (triggering validation) when tapping outside the form
 */
export function useAuthFormBehavior(formRef: RefObject<HTMLElement | null>, options: Options = {}) {
  const { initialFocusId, focusKey } = options
  const mountedRef = useRef(false)

  useEffect(() => {
    if (!initialFocusId) return

    const timer = window.setTimeout(() => {
      const el = document.getElementById(initialFocusId)
      el?.focus({ preventScroll: true })
    }, mountedRef.current ? 0 : 80)

    mountedRef.current = true
    return () => window.clearTimeout(timer)
  }, [initialFocusId, focusKey])

  useEffect(() => {
    function dismissKeyboardOnOutsideTap(event: PointerEvent) {
      const formEl = formRef.current
      if (!formEl) return

      const target = event.target as Node
      if (formEl.contains(target)) return

      const active = document.activeElement
      if (active instanceof HTMLElement && formEl.contains(active)) {
        active.blur()
      }
    }

    document.addEventListener('pointerdown', dismissKeyboardOnOutsideTap)
    return () => document.removeEventListener('pointerdown', dismissKeyboardOnOutsideTap)
  }, [formRef])
}
