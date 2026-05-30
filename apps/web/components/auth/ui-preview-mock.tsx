import { cn } from '@/lib/utils'

/** Calm cropped UI preview — sidebar + action feed silhouette (not marketing imagery). */
export function UiPreviewMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm',
        className,
      )}
      aria-hidden
    >
      <div className="flex h-44">
        <div className="w-14 shrink-0 border-r border-stone-100 bg-stone-900 p-2">
          <div className="mb-3 h-2 w-8 rounded bg-stone-700" />
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded bg-stone-700/80" />
            <div className="h-1.5 w-3/4 rounded bg-stone-700/50" />
            <div className="h-1.5 w-full rounded bg-stone-700/50" />
            <div className="h-1.5 w-2/3 rounded bg-stone-700/40" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="h-2 w-24 rounded bg-stone-200" />
          <div className="rounded-lg border border-stone-100 bg-stone-50 p-2">
            <div className="mb-1 h-1.5 w-16 rounded bg-stone-300" />
            <div className="space-y-1">
              <div className="h-1 w-full rounded bg-stone-200" />
              <div className="h-1 w-4/5 rounded bg-stone-200" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <div className="h-8 rounded border border-stone-100 bg-stone-50" />
            <div className="h-8 rounded border border-stone-100 bg-stone-50" />
            <div className="h-8 rounded border border-stone-100 bg-stone-50" />
          </div>
        </div>
      </div>
    </div>
  )
}
