import { ArrowUp, Ban, Bot, Check, Hand, Sparkles, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { ScreenCard, ScreenNote } from "@/components/landing/feature-row";
import type { FeatureVisuals } from "../types";
import { ClassifyScreen } from "./unified-inbox.classify";
import { InboxWindow } from "./unified-inbox.window";
import {
  ARRIVALS,
  Avatar,
  BASE,
  LABELS,
  LabelChip,
  SENDERS,
  type Thread,
} from "./unified-inbox.parts";

/**
 * The pictures on /features/unified-inbox, drawn the way the landing draws Vantera:
 * white screens, hairline borders, soft blue for whatever is selected.
 *
 * The window runs the inbox for real: a reply lands from one of the connected senders,
 * is classified (interested, a question, not now, not interested), slides to its place
 * warm-first, and the agent answers it on autopilot — or, for a "not interested", the
 * person goes straight onto the suppression list (rule 11). The window and the
 * classifying card animate, so they're client modules; the rest renders here. Sample
 * data throughout, the site's fictional cast; the window says so.
 */

/* ---------- Benefit screens ---------- */

/** Benefit 2: the agent's answer, sent on autopilot, with the way to step in. */
function AnswerScreen() {
  const a = ARRIVALS[0];
  return (
    <ScreenCard
      title={a.name}
      meta={
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--cyan-strong)]">
          <Sparkles className="size-3" strokeWidth={2.4} />
          Autopilot
        </span>
      }
    >
      <div className="space-y-2.5">
        <div className="max-w-[82%] rounded-[12px] rounded-bl-[4px] bg-[#f1f3f6] px-3 py-2 text-[0.72rem] leading-relaxed text-foreground">
          {a.reply}
        </div>
        <div className="ml-auto max-w-[86%] rounded-[12px] rounded-br-[4px] bg-[var(--fb)] px-3 py-2 text-[0.72rem] leading-relaxed text-white">
          {a.answer}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--hairline)] pt-2.5">
        <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-[var(--cyan-strong)]">
          <Sparkles className="size-3" strokeWidth={2.4} />
          Replied on autopilot · just now
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(12,16,26,0.1)] bg-white px-2 py-0.5 text-[0.65rem] font-medium text-[var(--ink-2)]">
          <Hand className="size-3" strokeWidth={2.2} />
          Take over
        </span>
      </div>
    </ScreenCard>
  );
}

const SUPPRESSED: { initials: string; name: string; tint: string; reason: string; when: string; fresh?: boolean }[] = [
  { initials: "PN", name: "Piotr Novak", tint: "#64748b", reason: "Not interested", when: "just now", fresh: true },
  { initials: "KW", name: "Kenji Watanabe", tint: "#5e6ad2", reason: "Opted out", when: "Sep 30" },
  { initials: "CB", name: "Chloe Bernard", tint: "#c2557d", reason: "Not interested", when: "Sep 12" },
];

/** Benefit 3: "not interested" written straight to the suppression list. */
function SuppressScreen() {
  return (
    <ScreenCard
      title="Suppression list"
      meta={<span className="text-[0.68rem] text-[var(--ink-3)]">Updated just now</span>}
    >
      <div className="space-y-1.5">
        {SUPPRESSED.map((s) => (
          <div
            key={s.name}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2",
              s.fresh ? "border-[rgba(192,54,90,0.25)] bg-[#fffafb]" : "border-[var(--hairline)] bg-white",
            )}
          >
            <Avatar t={s} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{s.name}</span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-px text-[0.6rem] font-semibold",
                s.reason === "Opted out"
                  ? "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]"
                  : "bg-[#fdeef1] text-[#c0365a]",
              )}
            >
              {s.reason}
            </span>
            <span className="w-12 shrink-0 text-right text-[0.62rem] tabular-nums text-[var(--ink-4)]">{s.when}</span>
          </div>
        ))}
      </div>
      <ScreenNote>
        <span className="inline-flex items-center gap-1.5">
          <Ban className="size-3 text-[#c0365a]" strokeWidth={2.4} />
          Never messaged again — checked before every draft and every send
        </span>
      </ScreenNote>
    </ScreenCard>
  );
}

/* ---------- Step pictures ---------- */

const ROW = "flex items-center gap-2.5 rounded-lg border border-[var(--hairline)] bg-white px-2.5 py-2";

/** Step 1: a reply lands, from one of your connected senders. */
function LandStep() {
  const a = ARRIVALS[0];
  return (
    <div className="space-y-1.5">
      <div className={ROW}>
        <Avatar t={a} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{a.name}</p>
          <p className="truncate text-[0.65rem] text-[var(--ink-3)]">{a.reply}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[0.6rem] font-semibold text-[var(--fb-strong)]">
          <span className="size-1.5 rounded-full bg-[var(--fb)]" />
          New
        </span>
      </div>
      <p className="flex items-center gap-1.5 px-1 text-[0.62rem] text-[var(--ink-3)]">
        <LinkedinMark className="size-3 text-[var(--fb)]" />
        via {a.via} · one inbox for all {SENDERS.length} senders
      </p>
    </div>
  );
}

/** Step 2: the label it gets, and where that puts it. */
function ClassifyStep() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {LABELS.map((l) => (
          <span
            key={l}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.62rem] font-semibold",
              l === "Interested"
                ? "bg-[var(--cyan-tint)] text-[var(--cyan-strong)] shadow-[inset_0_0_0_1px_rgba(22,111,229,0.22)]"
                : "border border-[var(--hairline)] bg-white text-[var(--ink-4)]",
            )}
          >
            {l === "Interested" && <Check className="size-2.5" strokeWidth={3} />}
            {l}
          </span>
        ))}
      </div>
      <p className="flex items-center gap-1.5 rounded-lg border border-[rgba(24,119,242,0.25)] bg-[var(--cyan-tint)] px-2.5 py-1.5 text-[0.65rem] font-medium text-foreground">
        <ArrowUp className="size-3 text-[var(--fb-strong)]" strokeWidth={2.6} />
        Warm replies rise to the top
      </p>
    </div>
  );
}

/** Step 3: the agent answers, and you can still step in. */
function AnswerStep() {
  const a = ARRIVALS[0];
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="max-w-[92%] rounded-[12px] rounded-br-[4px] bg-[var(--fb)] px-2.5 py-1.5 text-[0.68rem] leading-relaxed text-white">
        {a.answer}
      </div>
      <span className="flex items-center gap-1 text-[0.6rem] font-medium text-[var(--cyan-strong)]">
        <Sparkles className="size-2.5" strokeWidth={2.4} />
        Replied on autopilot
      </span>
    </div>
  );
}

/* ---------- The closing band's screen ---------- */

/** The top of the inbox, warm first, rising out of the closing band. */
function InboxPeek() {
  const rows: Thread[] = [ARRIVALS[0], BASE[0], ARRIVALS[1]];
  return (
    <div className="rounded-t-xl border border-b-0 border-white/20 bg-white p-4 text-left shadow-[0_-12px_48px_-16px_rgba(4,24,72,0.55)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-foreground">
          <VanteraLogo className="size-4 text-[var(--fb)]" />
          Inbox
          <span className="font-normal text-[var(--ink-3)]">· warm first</span>
        </span>
        <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
          <span className="size-1.5 rounded-full bg-[#13a05a]" />
          Agent live
        </span>
      </div>
      <div className="mt-3.5 space-y-2">
        {rows.map((t) => (
          <div key={t.id} className={ROW}>
            <Avatar t={t} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{t.name}</span>
            <LabelChip label={t.label} />
            <span className="w-8 shrink-0 text-right text-[0.62rem] tabular-nums text-[var(--ink-4)]">{t.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const visuals: FeatureVisuals = {
  Window: InboxWindow,
  Peek: InboxPeek,
  benefits: [ClassifyScreen, AnswerScreen, SuppressScreen],
  benefitIcons: [Tags, Bot, Ban],
  steps: [LandStep, ClassifyStep, AnswerStep],
};
