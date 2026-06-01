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
