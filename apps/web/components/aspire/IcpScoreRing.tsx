import { cn } from '@/lib/utils'

type Props = {
  score: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function icpScoreColor(score: number): string {
  if (score >= 70) return '#16a34a'
  if (score >= 40) return '#d97706'
  return '#dc2626'
}

export function icpScoreLabel(score: number): string {
  if (score >= 70) return 'Strong fit'
  if (score >= 40) return 'Moderate fit'
  return 'Weak fit'
}

export function IcpScoreRing({ score, size = 88, strokeWidth = 7, className }: Props) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference
  const color = icpScoreColor(score)

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-stone-100"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold tabular-nums text-stone-900">{score}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-500">ICP</span>
      </div>
    </div>
  )
}
