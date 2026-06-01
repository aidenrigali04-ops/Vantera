import { cn } from '@/lib/utils'

/** Calm cropped UI preview — sidebar + action feed silhouette (not marketing imagery). */
export function UiPreviewMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
        className,
      )}
      aria-hidden
    >
      <div className="flex h-[176px]">
        <div className="w-[56px] shrink-0 border-r border-stone-100 bg-stone-900 px-2.5 py-3">
          <div className="mb-3 h-2 w-8 rounded bg-stone-700" />
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded bg-stone-700/90" />
            <div className="h-1.5 w-4/5 rounded bg-stone-700/60" />
            <div className="h-1.5 w-full rounded bg-stone-700/50" />
            <div className="h-1.5 w-3/5 rounded bg-stone-700/40" />
            <div className="h-1.5 w-4/5 rounded bg-stone-700/35" />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-3.5">
          <div className="flex items-center justify-between">
            <div className="h-2 w-24 rounded bg-stone-200" />
            <div className="h-2 w-10 rounded bg-stone-100" />
          </div>
          <div className="rounded-lg border border-stone-100 bg-stone-50/80 p-2.5">
            <div className="mb-2 h-1.5 w-20 rounded bg-stone-300/80" />
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="mt-0.5 size-4 shrink-0 rounded-full bg-stone-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-1 w-full rounded bg-stone-200" />
                  <div className="h-1 w-4/5 rounded bg-stone-100" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="mt-0.5 size-4 shrink-0 rounded-full bg-stone-200" />
                <div className="flex-1 space-y-1">
                  <div className="h-1 w-full rounded bg-stone-200" />
                  <div className="h-1 w-3/4 rounded bg-stone-100" />
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="h-9 rounded-md border border-stone-100 bg-stone-50" />
            <div className="h-9 rounded-md border border-stone-100 bg-stone-50" />
            <div className="h-9 rounded-md border border-stone-100 bg-stone-50" />
          </div>
        </div>
      </div>
    </div>
  )
}
