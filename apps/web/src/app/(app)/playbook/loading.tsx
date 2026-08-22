import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

/** R1a: Playbook shape — header + three agent cards. Covers the playbook subtree. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5">
      <HeaderSkeleton />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
