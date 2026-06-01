'use client'

import { ProductTourOverlay } from '@/components/onboarding/product-tour/ProductTourOverlay'
import {
  OPERATING_MODEL_CHANGED_EVENT,
  hasSelectedOperatingModel,
} from '@/lib/onboarding/operating-model-storage'
import {
  PRODUCT_TOUR_COMPLETED_EVENT,
  PRODUCT_TOUR_REQUEST_EVENT,
  isProductTourComplete,
} from '@/lib/onboarding/product-tour'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

type Props = {
  accountId: string
  enabled: boolean
}

/**
 * Full-screen click-through slideshow for first-time dashboard users.
 * Auto-opens after the operating model picker; replays via requestProductTourReplay().
 */
export function ProductTourHost({ accountId, enabled }: Props) {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const [tourComplete, setTourComplete] = useState(true)
  const [replayMode, setReplayMode] = useState(false)

  useEffect(() => {
    setTourComplete(isProductTourComplete(accountId))
  }, [accountId])

  useEffect(() => {
    function onCompleted(event: Event) {
      const detail = (event as CustomEvent<{ accountId: string }>).detail
      if (detail?.accountId === accountId) {
        setTourComplete(true)
      }
    }

    window.addEventListener(PRODUCT_TOUR_COMPLETED_EVENT, onCompleted)
    return () => window.removeEventListener(PRODUCT_TOUR_COMPLETED_EVENT, onCompleted)
  }, [accountId])

  useEffect(() => {
    if (!enabled || open || tourComplete || pathname !== '/admin/dashboard') return
    if (!hasSelectedOperatingModel(accountId)) return

    const timer = window.setTimeout(() => setOpen(true), 700)
    return () => window.clearTimeout(timer)
  }, [accountId, enabled, open, pathname, tourComplete])

  useEffect(() => {
    function onOperatingModelChanged(event: Event) {
      const detail = (event as CustomEvent<{ accountId: string }>).detail
      if (detail?.accountId !== accountId) return
      if (!enabled || tourComplete || pathname !== '/admin/dashboard') return
      if (!hasSelectedOperatingModel(accountId)) return
      window.setTimeout(() => setOpen(true), 400)
    }

    window.addEventListener(OPERATING_MODEL_CHANGED_EVENT, onOperatingModelChanged)
    return () => window.removeEventListener(OPERATING_MODEL_CHANGED_EVENT, onOperatingModelChanged)
  }, [accountId, enabled, pathname, tourComplete])

  useEffect(() => {
    function onReplayRequest() {
      setReplayMode(true)
      setOpen(true)
    }

    window.addEventListener(PRODUCT_TOUR_REQUEST_EVENT, onReplayRequest)
    return () => window.removeEventListener(PRODUCT_TOUR_REQUEST_EVENT, onReplayRequest)
  }, [])

  function handleClose() {
    setOpen(false)
    setReplayMode(false)
    setTourComplete(isProductTourComplete(accountId))
  }

  if (!enabled && !open) return null

  return (
    <ProductTourOverlay
      open={open}
      accountId={accountId}
      onClose={handleClose}
      persistCompletion={!replayMode}
    />
  )
}
