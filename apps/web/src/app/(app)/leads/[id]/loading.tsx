import { Skeleton } from "@/components/ui/skeleton";

/** R1a: lead brief shape — back link, identity header, three columns. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1560px] flex-col gap-6">
      <Skeleton className="h-4 w-16" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[28rem] rounded-xl" />
        <Skeleton className="h-[28rem] rounded-xl" />
        <Skeleton className="h-[28rem] rounded-xl" />
      </div>
    </div>
  );
}
