'use client'

import { SlideMediaPreview } from '@/components/onboarding/product-tour/SlideMediaPreview'
import type { ProductTourMedia } from '@/lib/onboarding/product-tour'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { DURATION, EASE_OUT } from '@/lib/motion'

type Props = {
  media: ProductTourMedia
  slideId: string
  className?: string
}

export function ProductTourMediaPanel({ media, slideId, className }: Props) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)]',
        className,
      )}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={slideId}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: DURATION.fade, ease: EASE_OUT }}
          className="h-full min-h-[240px]"
        >
          {media.type === 'preview' ? (
            <SlideMediaPreview previewId={media.previewId} />
          ) : null}

          {media.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={media.src}
              alt={media.alt}
              className="h-full min-h-[240px] w-full object-cover object-top"
            />
          ) : null}

          {media.type === 'video' ? (
            <video
              src={media.src}
              poster={media.poster}
              autoPlay
              muted
              loop
              playsInline
              aria-label={media.alt}
              className="h-full min-h-[240px] w-full object-cover object-top"
            />
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
