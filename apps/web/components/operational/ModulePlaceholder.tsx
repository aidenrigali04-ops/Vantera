import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type ModulePlaceholderProps = {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function ModulePlaceholder({ icon: Icon, title, description, action }: ModulePlaceholderProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/50 px-6 py-12 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100">
        <Icon className="h-6 w-6 text-stone-500" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-stone-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-stone-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
