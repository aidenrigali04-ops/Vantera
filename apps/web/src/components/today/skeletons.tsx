import { cn } from "@/lib/utils";
import { TodayPageFrame } from "./wash";

/**
 * Loading skeletons (blueprint §6.13). No shimmer: the page arrives in one server pass, so
 * these exist for the route's loading boundary only. Every block is sized to its final
 * component so nothing shifts when the data lands (CLS 0 is the bar).
 */

function Block({ w, h, className }: { w: number | string; h: number; className?: string }) {
  return <div className={cn("rounded bg-[var(--surface-2)]", className)} style={{ width: w, height: h }} aria-hidden="true" />;
}

export function StatSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Block w={64} h={12} />
      <Block w={56} h={28} />
      <Block w={120} h={13} />
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <TodayPageFrame>
      <div role="status" aria-label="Loading Today" className="relative">
        {/* Z2 greeting */}
        <div className="grid grid-cols-1 gap-y-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-x-6">
          <Block w={280} h={32} className="md:col-start-1 md:row-start-1" />
          <Block w={560} h={15} className="max-w-full md:col-start-1 md:row-start-2" />
          <div className="mt-3.5 md:col-start-2 md:row-start-2 md:mt-0 md:flex md:h-0 md:items-center md:self-center md:justify-self-end">
            <Block w={120} h={40} />
          </div>
        </div>
        <div className="mt-7 h-px w-full bg-[var(--line)]" aria-hidden="true" />

        {/* Z3 stats */}
        <div className="mt-7 flex h-[88px] items-start gap-6">
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
          <StatSkeleton />
        </div>

        {/* Z4 needs-you tiles */}
        <Block w={96} h={12} className="mt-12" />
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          <Block w="100%" h={64} />
          <Block w="100%" h={64} />
          <Block w="100%" h={64} />
        </div>

        {/* Z5 work card */}
        <div className="mt-12 rounded-[var(--r-card)] bg-[var(--surface)] ring-1 ring-[var(--line)] shadow-[var(--shadow-card)]">
          <div className="flex h-16 items-center justify-between border-b border-[var(--line)] px-6">
            <Block w={220} h={15} />
            <Block w={260} h={28} />
          </div>
          <div className="px-6">
            <div className="flex h-10 items-center">
              <Block w="100%" h={12} />
            </div>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-14 items-center gap-4 border-t border-[var(--line)]">
                <Block w={28} h={28} />
                <Block w={180} h={14} />
                <Block w={160} h={14} className="hidden md:block" />
                <Block w={40} h={24} className="ml-auto" />
              </div>
            ))}
          </div>
          <div className="flex h-12 items-center justify-between border-t border-[var(--line)] px-6">
            <Block w={340} h={13} />
            <Block w={140} h={13} />
          </div>
        </div>
        <span className="sr-only">Loading Today…</span>
      </div>
    </TodayPageFrame>
  );
}
