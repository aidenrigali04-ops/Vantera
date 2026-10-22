import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScreenCard } from "./feature-row";

/**
 * The replies row's screen — "What happens when someone replies?" The inbox with
 * every reply classified, warm first, and the agent's answer to the top one already
 * sent. The row's copy carries the suppression guarantee that's guardrail-tested in
 * this codebase (rule 11: "not interested" writes to suppression; suppression is
 * checked before every send). Sample data.
 */

type Tag = "Interested" | "Question" | "Not now";

const THREADS: { initials: string; name: string; tint: string; tag: Tag; preview: string }[] = [
  {
    initials: "MC",
    name: "Maya Chen",
    tint: "#1877f2",
    tag: "Interested",
    preview: "Yes, this is timely. How’s Thursday?",
  },
  {
    initials: "LR",
    name: "Luis Ramos",
    tint: "#0c9fce",
    tag: "Question",
    preview: "What does pricing look like for a team of 3?",
  },
  {
    initials: "PN",
    name: "Piotr Novak",
    tint: "#c2557d",
    tag: "Not now",
    preview: "Try me next quarter.",
  },
];

const TAG_STYLE: Record<Tag, string> = {
  Interested: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]",
  Question: "bg-[#fdf3dc] text-[#9a6a00]",
  "Not now": "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]",
};

export function RepliesScreen() {
  return (
    <ScreenCard
      title="Replies"
      meta={<span className="text-[0.68rem] text-[var(--ink-3)]">3 new</span>}
    >
      <div className="space-y-1.5">
        {THREADS.map((t) => (
          <div
            key={t.name}
            className="flex items-center gap-2.5 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2"
          >
            <span
              className="grid size-6 shrink-0 place-items-center rounded-full text-[0.6rem] font-semibold text-white"
              style={{ backgroundColor: t.tint }}
            >
              {t.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-foreground">{t.name}</p>
              <p className="truncate text-[0.68rem] text-[var(--ink-3)]">{t.preview}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-[0.6rem] font-semibold",
                TAG_STYLE[t.tag],
              )}
            >
              {t.tag}
            </span>
          </div>
        ))}
      </div>

      {/* The agent's answer to the warm reply, already on its way. */}
      <div className="mt-3 rounded-lg border border-[rgba(24,119,242,0.25)] bg-[var(--cyan-tint)] px-3 py-2">
        <span className="flex items-center gap-1.5 text-[0.68rem] font-semibold text-[var(--cyan-strong)]">
          <Send className="size-3" strokeWidth={2.4} />
          Agent replied · 2m ago
        </span>
        <p className="mt-1 text-[0.72rem] leading-relaxed text-foreground">
          Thursday works. I can do 10:30 or 2:00, whichever suits you, and I’ll send the invite
          as soon as you pick.
        </p>
      </div>
    </ScreenCard>
  );
}
