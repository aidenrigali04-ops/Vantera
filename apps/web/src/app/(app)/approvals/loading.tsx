import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** R1a: Approvals shape — header, view toggle, draft cards. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <HeaderSkeleton />
      <Skeleton className="h-9 w-44 rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}
