import { cn } from "@/lib/utils";
import type { QueueStep } from "@/lib/today/rows";

/**
 * How the draft will land on LinkedIn, so "Approve" means "read it the way they will".
 * Invite → the connection request's "Add a note" box with its character counter (red when
 * over the sending layer's cap); every other step → a sent-message bubble.
 */
export function DraftPreview({ body, stage, charLimit }: { body: string; stage: QueueStep; charLimit: number }) {
  const len = body.length;
  const over = len > charLimit;
  const counter = (
    <span className={cn("font-mono text-[12px]", over ? "text-[var(--danger)]" : "text-[var(--ink-dim)]")} aria-label={`${len} of ${charLimit} characters`}>
      {`${len}/${charLimit}`}
    </span>
  );

  if (stage === "Invite") {
    return (
      <div className="rounded-[var(--r-square)] border border-[var(--line)] bg-[var(--surface)] p-4" data-preview="invite">
        <p className="mb-2 text-[13px] font-semibold text-[var(--ink)]">Add a note to your invitation</p>
        <div
          className={cn(
            "min-h-24 rounded-[var(--r-btn)] border px-3 py-2.5 text-[14px] leading-[1.55] whitespace-pre-wrap text-[var(--ink)]",
            over ? "border-[var(--danger)]" : "border-[var(--line-strong)]"
          )}
        >
          {body}
        </div>
        <div className="mt-1.5 flex justify-end">{counter}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5" data-preview="message">
      <div className="max-w-[92%] rounded-[14px] rounded-br-[4px] bg-[var(--acc-tint)] px-4 py-3 text-[14px] leading-[1.55] whitespace-pre-wrap text-[var(--ink-2)]">
        {body}
      </div>
      {counter}
    </div>
  );
}
