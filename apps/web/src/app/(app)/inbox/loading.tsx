import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** R1a: inbox shape — header, thread list + thread pane. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-5">
      <HeaderSkeleton />
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <div className="space-y-2 rounded-xl border border-[var(--hairline)] p-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-[var(--hairline)] p-5">
          <Skeleton className="h-12 w-3/5" />
          <Skeleton className="ml-auto h-16 w-3/5" />
          <Skeleton className="h-16 w-3/5" />
          <Skeleton className="mt-6 h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
