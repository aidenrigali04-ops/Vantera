import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** R1a: meetings ledger shape. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <HeaderSkeleton />
      <div className="space-y-2 rounded-xl border border-[var(--hairline)] p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
