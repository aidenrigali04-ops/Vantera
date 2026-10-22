import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The unified-inbox pictures' shared pieces: the sample cast (the site's fictional
 * people; every name and line is sample data), the four labels a reply can get, and
 * the avatar and label chips the window and the screens are built from. No hooks, so
 * both the server-rendered screens and the animated window can use them.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

export type Label = "Interested" | "Question" | "Not now" | "Not interested";

export const LABELS: Label[] = ["Interested", "Question", "Not now", "Not interested"];

const LABEL_STYLE: Record<Label, string> = {
  Interested: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]",
  Question: "bg-[#fdf3dc] text-[#9a6a00]",
  "Not now": "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]",
  "Not interested": "bg-[#fdeef1] text-[#c0365a]",
};

export interface Thread {
  id: string;
  initials: string;
  name: string;
  role: string;
  tint: string;
  label: Label;
  when: string;
  /** The connected LinkedIn sender it came in on. */
  via: string;
  signal: string;
  opener: string;
  reply: string;
  /** The agent's autopilot answer; none for "not interested" (suppressed instead). */
  answer?: string;
  /** Recency, for the newest-first tiebreak. */
  t: number;
}

export const SENDERS = ["Jordan K.", "Sam R.", "Alex M."];

/* Already in the inbox, classified and answered. */
export const BASE: Thread[] = [
  {
    id: "rn",
    initials: "RN",
    name: "Rachel Nguyen",
    role: "VP Sales · Northwind",
    tint: "#1877f2",
    label: "Interested",
    when: "1h",
    via: "Jordan K.",
    signal: "Posted about rebuilding pipeline · 3d",
    opener: "",
    reply: "Confirmed. Where's the booking link?",
    t: 4,
  },
  {
    id: "mf",
    initials: "MF",
    name: "Marcus Feld",
    role: "Head of Growth · Lumen",
    tint: "#5e6ad2",
    label: "Interested",
    when: "3h",
    via: "Sam R.",
    signal: "Hiring two SDRs · 6d",
    opener: "",
    reply: "What's the link? I'll grab a slot now.",
    t: 3,
  },
  {
    id: "lr",
    initials: "LR",
    name: "Luis Ramos",
    role: "Head of Sales · Meridian",
    tint: "#0c9fce",
    label: "Question",
    when: "Tue",
    via: "Jordan K.",
    signal: "Hired a first AE · 9d",
    opener: "",
    reply: "What does pricing look like for a team of 3?",
    t: 2,
  },
  {
    id: "nl",
    initials: "NL",
    name: "Nora Lindqvist",
    role: "COO · Fieldnote",
    tint: "#c2557d",
    label: "Not now",
    when: "Mon",
    via: "Alex M.",
    signal: "Expanding to a second market · 1w",
    opener: "",
    reply: "Not this quarter. Try me in January.",
    t: 1,
  },
];

/* The replies that land while the window is on screen, in order. */
export const ARRIVALS: Thread[] = [
  {
    id: "ao",
    initials: "AO",
    name: "Aisha Okafor",
    role: "Founder · Brightlane",
    tint: "#0f9d6e",
    label: "Interested",
    when: "now",
    via: "Sam R.",
    signal: "Raised a seed round · 2w",
    opener:
      "Congrats on the seed, Aisha. Founders at your stage tell us outbound is the first thing that slips. We keep it running in minutes a day.",
    reply: "Yes, this is timely. Thursday works.",
    answer: "Thursday it is. Does 11:00 or 3:00 your time suit you better?",
    t: 10,
  },
  {
    id: "dc",
    initials: "DC",
    name: "Daniel Cho",
    role: "Sales Director · Summit Ridge",
    tint: "#0f766e",
    label: "Question",
    when: "now",
    via: "Jordan K.",
    signal: "New role · 3w",
    opener:
      "Congrats on the new role, Daniel. The first 90 days usually means rebuilding pipeline from scratch.",
    reply: "Interesting. Does it work with HubSpot?",
    answer:
      "It does. Every win lands in HubSpot automatically. Want a quick walkthrough on Thursday?",
    t: 11,
  },
  {
    id: "pn",
    initials: "PN",
    name: "Piotr Novak",
    role: "Ops Manager · Cadence",
    tint: "#64748b",
    label: "Not interested",
    when: "now",
    via: "Alex M.",
    signal: "Engaged with an outbound post · 2w",
    opener:
      "Piotr, saw your comment on outbound tooling. We help small teams book more meetings from LinkedIn.",
    reply: "Not for us, thanks.",
    t: 12,
  },
];

/* ---------- Atoms ---------- */

export function Avatar({ t, size = "md" }: { t: Pick<Thread, "initials" | "tint">; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        size === "md" ? "size-8 text-[0.68rem]" : "size-6 text-[0.58rem]",
      )}
      style={{ backgroundColor: t.tint }}
    >
      {t.initials}
    </span>
  );
}

export function LabelChip({ label, className }: { label: Label; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded px-1.5 py-px text-[0.62rem] font-semibold",
        LABEL_STYLE[label],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ClassifyingChip() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-[rgba(12,16,26,0.05)] px-1.5 py-px text-[0.62rem] font-semibold text-[var(--ink-3)]">
      <Sparkles className="size-2.5 motion-safe:animate-pulse" strokeWidth={2.4} />
      Classifying
    </span>
  );
}
