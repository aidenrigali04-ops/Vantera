import { Skeleton } from "@/components/ui/skeleton";

/** R1a: instant shape while the dashboard's queries resolve — tabs, greeting, KPI strip, panels. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
