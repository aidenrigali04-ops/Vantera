import { Check, CirclePause, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CEILING_FACT } from "@/components/landing/claims";

/**
 * The account-safety pictures' shared pieces: the sample senders and their states, the
 * sample week of sends, and the state chips, ceiling bars, pace strips and check rows
 * the console and the screens are built from. No hooks, so both the server-rendered
 * screens and the animated console can use them. The only limit stated is the
 * ceiling, read from claims.ts.
 */

/** "~100" — the ceiling's number, read from the one stated claim. */
export const CEILING = CEILING_FACT.replace(/\s*invites.*$/i, "");

export type State = "Active" | "Ramping" | "Auto-paused";

export interface Sender {
  initials: string;
  name: string;
  tint: string;
  /** Invites sent this week (sample). */
  used: number;
  state: State;
}

export const SENDERS: Sender[] = [
  { initials: "JK", name: "Jordan Kim", tint: "#1877f2", used: 61, state: "Active" },
  { initials: "SR", name: "Sam Rivera", tint: "#0f9d6e", used: 24, state: "Ramping" },
  { initials: "AM", name: "Alex Morgan", tint: "#5e6ad2", used: 47, state: "Active" },
];

const STATE_STYLE: Record<State, string> = {
  Active: "bg-[#e3f5ea] text-[#13824a]",
  Ramping: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]",
  "Auto-paused": "bg-[#fdf3dc] text-[#9a6a00]",
};

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/* Jordan's sends so far this week (Mon–Thu; today is Thursday). Sums to 61. */
const SENT_PER_DAY = [17, 15, 16, 13];
export const TODAY = 3;

/* A seeded generator (mulberry32), so the server and the browser draw the same week. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Each send as a dot: its day, where in the column it sits, and when in the working day
   it went out. Gaps between sends are irregular — never a straight line. */
export const TICKS = (() => {
  const rand = seeded(20261021);
  const out: { day: number; x: number; y: number; i: number }[] = [];
  let i = 0;
  SENT_PER_DAY.forEach((n, day) => {
    // Today stops at "now", so its sends cover only the morning and early afternoon.
    const end = day === TODAY ? 0.62 : 0.94;
    const times: number[] = [];
    for (let k = 0; k < n; k++) times.push(0.06 + rand() * (end - 0.06));
    times.sort((a, b) => a - b);
    for (const y of times) out.push({ day, x: 0.18 + rand() * 0.64, y, i: i++ });
  });
  return out;
})();

/* Today's sends as a single strip, for the smaller pictures. */
const STRIP = TICKS.filter((t) => t.day === TODAY).map((t) => t.y);

/* ---------- Atoms ---------- */

export function StateChip({ state, className }: { state: State; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-px text-[0.6rem] font-semibold",
        STATE_STYLE[state],
        className,
      )}
    >
      {state === "Auto-paused" && <CirclePause className="size-2.5" strokeWidth={2.6} />}
      {state}
    </span>
  );
}

/** A sender's week against the ceiling: the bar fills toward a locked end. */
export function CeilingBar({ used, className }: { used: number; className?: string }) {
  return (
    <span className={cn("relative block h-1.5 w-full rounded-full bg-[rgba(12,16,26,0.06)]", className)}>
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-[var(--fb)]"
        style={{ width: `${Math.min(100, used)}%` }}
      />
      <span className="absolute -right-0.5 top-1/2 h-3 w-[3px] -translate-y-1/2 rounded-full bg-[var(--ink-2)]" />
    </span>
  );
}

/** Randomized gaps, drawn as dots along one line (today's sends). */
export function PaceStrip({ className }: { className?: string }) {
  return (
    <span className={cn("relative block h-4 w-full", className)}>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(12,16,26,0.1)]" />
      {STRIP.map((y, i) => (
        <span
          key={i}
          className="absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--fb)]"
          style={{ left: `${(y / 0.62) * 96 + 2}%` }}
        />
      ))}
    </span>
  );
}

export const CHECKS: { label: string; value: string; locked?: boolean }[] = [
  { label: "Login", value: "Never stored", locked: true },
  { label: "Weekly ceiling", value: CEILING_FACT, locked: true },
  { label: "Pacing", value: "Randomized" },
  { label: "Warmup", value: "Gradual ramp" },
  { label: "Security check", value: "Auto-pause" },
];

export function CheckRow({ label, value, locked }: { label: string; value: string; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-[0.72rem]">
      <span className="truncate font-medium text-foreground">{label}</span>
      <span className="inline-flex shrink-0 items-center gap-1.5 tabular-nums text-[var(--ink-3)]">
        {locked ? (
          <Lock className="size-3 text-[var(--ink-3)]" strokeWidth={2.4} />
        ) : (
          <Check className="size-3 text-[#13824a]" strokeWidth={2.8} />
        )}
        {value}
      </span>
    </div>
  );
}
