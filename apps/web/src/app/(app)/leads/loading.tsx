import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** R1a: leads table shape — header, tabs, search, rows. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5">
      <HeaderSkeleton />
      <Skeleton className="h-10 w-[26rem] max-w-full rounded-xl" />
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="space-y-2 rounded-xl border border-[var(--hairline)] p-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
