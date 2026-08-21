import { cn } from "@/lib/utils";

/** R1a: the loading-state primitive — a pulsing block in the surface's own tint. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-md bg-foreground/[0.06]", className)} />;
}

/** Shared page-header skeleton: title line + subtitle line, matching app headers. */
export function HeaderSkeleton() {
  return (
    <div className="space-y-2 border-b border-[var(--hairline)] pb-4">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}
