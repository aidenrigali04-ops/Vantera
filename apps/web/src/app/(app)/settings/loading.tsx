import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** R1a: settings shape — header + stacked form cards. Covers the settings subtree. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <HeaderSkeleton />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-44 rounded-xl" />
      ))}
    </div>
  );
}
