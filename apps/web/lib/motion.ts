export const EASE_OUT = [0.16, 1, 0.3, 1] as const
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const

export const DURATION = {
  hover: 0.12,
  fade: 0.16,
  modal: 0.2,
  page: 0.24,
  banner: 0.2,
} as const

export const SPRING = {
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
  gentle: { type: 'spring' as const, stiffness: 300, damping: 28 },
}

export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.fade, ease: EASE_OUT },
  },
} as const

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DURATION.fade, ease: EASE_OUT },
  },
} as const

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
} as const

export const cardLift = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -2, transition: { duration: DURATION.hover } },
  tap: { scale: 0.99, transition: { duration: 0.08 } },
} as const

export const barGrow = {
  hidden: { opacity: 0, scaleY: 0 },
  visible: (i: number) => ({
    opacity: 1,
    scaleY: 1,
    transition: {
      delay: 0.04 + i * 0.03,
      duration: DURATION.page,
      ease: EASE_OUT,
    },
  }),
} as const
