import Link from "next/link";
import { cn } from "@/lib/utils";
import type { SenderChipRow } from "@/lib/today/rows";

/**
 * A connected sender and how much of today's allowance it has spent (blueprint §6.7). The
 * fraction and the tooltip are computed from the sending layer's own caps — the UI never
 * hardcodes a limit (D8). A dropped sender shows the repair verb instead of a number.
 */
export function SenderChip({ sender }: { sender: SenderChipRow }) {
  const down = sender.status === "disconnected";
  const attention = sender.status === "restricted" || sender.status === "connecting";
  return (
    <Link
      href={`/settings/senders#${sender.id}`}
      title={sender.tooltip}
      className="group inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-[var(--r-pill)] bg-[var(--surface-2)] py-0 pl-2 pr-2.5 transition-colors hover:bg-[var(--line)] focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          down
            ? "bg-[var(--danger)]"
            : attention
              ? "bg-[var(--attention)]"
              : sender.warmup
                ? "border-[1.5px] border-[var(--ink-dim)] bg-transparent"
                : "bg-[var(--positive)]"
        )}
      />
      <span className="truncate text-[13px] font-medium text-[var(--ink)]">{sender.name}</span>
      {down ? (
        <span className="shrink-0 text-[12px] font-medium text-[var(--attention)]">Reconnect</span>
      ) : (
        <>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-[var(--ink-mid)]">{sender.fraction}</span>
          {sender.warmup ? <span className="shrink-0 font-mono text-[12px] text-[var(--ink-dim)]">· Warmup</span> : null}
        </>
      )}
      <span className="sr-only">{sender.tooltip}</span>
    </Link>
  );
}
