import type { ReactNode } from "react";
import {
  Check,
  CirclePause,
  Gauge,
  KeyRound,
  Lock,
  LockKeyhole,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { ScreenCard, ScreenNote } from "@/components/landing/feature-row";
import type { FeatureVisuals } from "../types";
import { SafetyWindow } from "./account-safety.window";
import {
  CEILING,
  CHECKS,
  CeilingBar,
  CheckRow,
  PaceStrip,
  SENDERS,
  StateChip,
} from "./account-safety.parts";

/**
 * The pictures on /features/account-safety, drawn the way the landing draws Vantera:
 * white screens, hairline borders, soft blue for whatever is selected.
 *
 * Every mechanism shown is a real one (rules 04/11): the hosted LinkedIn sign-in (the
 * password never touches Vantera), the hard weekly ceiling (CEILING_FACT, not
 * configurable above it), randomized human pacing, the gradual ramp for newer
 * accounts, volume spread across connected senders, and the automatic pause on a
 * security check. The only limit stated is the ceiling, from claims.ts; the sends and
 * senders are sample data, and the window says so. The console animates, so it's a
 * client module; the rest renders here.
 */

/* ---------- Benefit screens ---------- */

function Done({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 font-medium text-[#13824a]">
      <Check className="size-3" strokeWidth={3} />
      {children}
    </span>
  );
}

/** Benefit 1: LinkedIn's own sign-in, two-factor included; Vantera only gets a
    connection. */
function SignInScreen() {
  const rows: { icon: ReactNode; label: string; value: ReactNode }[] = [
    {
      icon: <LinkedinMark className="size-3.5 text-[var(--fb)]" />,
      label: "Sign in on LinkedIn",
      value: <Done>Done</Done>,
    },
    {
      icon: <KeyRound className="size-3.5 text-[var(--ink-3)]" strokeWidth={2.2} />,
      label: "Two-factor check",
      value: <Done>Passed</Done>,
    },
    {
      icon: <ShieldCheck className="size-3.5 text-[var(--fb)]" strokeWidth={2.2} />,
      label: "Connection granted to Vantera",
      value: <span className="font-medium text-[var(--cyan-strong)]">Connected</span>,
    },
    {
      icon: <Lock className="size-3.5 text-[var(--ink-3)]" strokeWidth={2.2} />,
      label: "Your password",
      value: (
        <span className="inline-flex items-center gap-1">
          <Lock className="size-3" strokeWidth={2.4} />
          Never stored
        </span>
      ),
    },
  ];
  return (
    <ScreenCard
      title="Connect LinkedIn"
      meta={
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--cyan-strong)]">
          <LinkedinMark className="size-2.5" />
          Hosted sign-in
        </span>
      }
    >
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
              {r.icon}
              <span className="truncate">{r.label}</span>
            </span>
            <span className="shrink-0 text-[0.7rem] text-[var(--ink-3)]">{r.value}</span>
          </div>
        ))}
      </div>
      <ScreenNote>Vantera receives a connection, never your password.</ScreenNote>
    </ScreenCard>
  );
}

/** Benefit 2: a week filling toward a locked ceiling, sent at irregular, human gaps. */
function CeilingScreen() {
  const s = SENDERS[0];
  return (
    <ScreenCard
      title={`This week · ${s.name}`}
      meta={
        <span className="inline-flex items-center gap-1 rounded-md border border-[rgba(19,130,74,0.3)] bg-[rgba(19,130,74,0.1)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[#13824a]">
          <span className="size-1.5 rounded-full bg-[#13824a]" />
          Within ceiling
        </span>
      }
    >
      <div className="rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Invites</span>
          <span className="tabular-nums text-[var(--ink-3)]">
            <span className="font-semibold text-foreground">{s.used}</span> of {CEILING}
          </span>
        </div>
        <CeilingBar used={s.used} className="mt-2" />
        <p className="mt-1.5 flex items-center justify-end gap-1 text-[0.6rem] text-[var(--ink-4)]">
          <Lock className="size-2.5" strokeWidth={2.4} />
          Ceiling locked
        </p>
      </div>
      <div className="mt-2 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">Today&rsquo;s pacing</span>
          <span className="text-[var(--ink-3)]">Randomized gaps</span>
        </div>
        <PaceStrip className="mt-2" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-xs">
        <span className="font-medium text-foreground">Volume spread across</span>
        <span className="tabular-nums text-[var(--ink-3)]">{SENDERS.length} senders</span>
      </div>
    </ScreenCard>
  );
}

const RAMP = [0.26, 0.44, 0.64, 0.84];

/** Benefit 3: a newer account's gradual ramp, and the pause a security check triggers. */
function RampScreen() {
  return (
    <ScreenCard
      title="Warmup · Sam Rivera"
      meta={<StateChip state="Auto-paused" className="text-[0.65rem]" />}
    >
      <div className="rounded-lg border border-[var(--hairline)] bg-white px-3 pb-2 pt-3">
        <div className="flex h-16 items-end gap-2">
          {RAMP.map((h, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  "w-full rounded-t-[4px]",
                  i === 1
                    ? "bg-[var(--fb)]"
                    : i < 1
                      ? "bg-[rgba(24,119,242,0.35)]"
                      : "border border-b-0 border-dashed border-[rgba(24,119,242,0.4)] bg-[rgba(24,119,242,0.05)]",
                )}
                style={{ height: `${h * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2">
          {RAMP.map((_, i) => (
            <span
              key={i}
              className={cn(
                "flex-1 text-center text-[0.6rem] font-medium",
                i === 1 ? "text-[var(--fb-strong)]" : "text-[var(--ink-4)]",
              )}
            >
              Wk {i + 1}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[rgba(245,158,11,0.35)] bg-[#fffbf2] px-3 py-2 text-xs">
        <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
          <CirclePause className="size-3.5 shrink-0 text-[#9a6a00]" strokeWidth={2.4} />
          <span className="truncate">Security check on LinkedIn</span>
        </span>
        <span className="shrink-0 font-medium text-[#9a6a00]">All sending paused</span>
      </div>
      <p className="mt-2 rounded-lg border border-[rgba(245,158,11,0.3)] bg-[#fdf3dc] px-3 py-2 text-[0.72rem] text-foreground">
        Resumes once you&rsquo;ve resolved the check.
      </p>
    </ScreenCard>
  );
}

/* ---------- Step pictures ---------- */

const ROW = "flex items-center justify-between gap-2.5 rounded-lg border border-[var(--hairline)] bg-white px-2.5 py-2";

/** Step 1: connected through LinkedIn's own sign-in. */
function ConnectStep() {
  return (
    <div className="space-y-1.5">
      <div className={ROW}>
        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
          <LinkedinMark className="size-3.5 text-[var(--fb)]" />
          Sign in on LinkedIn
        </span>
        <span className="rounded bg-[var(--cyan-tint)] px-1.5 py-px text-[0.6rem] font-semibold text-[var(--cyan-strong)]">
          Hosted
        </span>
      </div>
      <div className={ROW}>
        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Lock className="size-3.5 text-[var(--ink-3)]" strokeWidth={2.2} />
          Your password
        </span>
        <span className="text-[0.65rem] text-[var(--ink-3)]">Never stored</span>
      </div>
    </div>
  );
}

/** Step 2: volume building week by week. */
function RampStep() {
  return (
    <div>
      <div className="flex h-14 items-end gap-1.5">
        {RAMP.map((h, i) => (
          <span
            key={i}
            className={cn(
              "flex-1 rounded-t-[3px]",
              i === 1
                ? "bg-[var(--fb)]"
                : i < 1
                  ? "bg-[rgba(24,119,242,0.35)]"
                  : "border border-b-0 border-dashed border-[rgba(24,119,242,0.4)] bg-[rgba(24,119,242,0.05)]",
            )}
            style={{ height: `${h * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-2 flex items-center justify-between text-[0.62rem] font-medium">
        <span className="text-[var(--fb-strong)]">Week 2 · ramping</span>
        <span className="text-[var(--ink-4)]">builds weekly</span>
      </p>
    </div>
  );
}

/** Step 3: inside the ceiling, at uneven gaps. */
function CeilingStep() {
  const s = SENDERS[0];
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-[var(--hairline)] bg-white px-2.5 py-2">
        <div className="flex items-center justify-between text-[0.68rem]">
          <span className="font-medium text-foreground">This week</span>
          <span className="inline-flex items-center gap-1 tabular-nums text-[var(--ink-3)]">
            {s.used} of {CEILING}
            <Lock className="size-2.5" strokeWidth={2.4} />
          </span>
        </div>
        <CeilingBar used={s.used} className="mt-1.5" />
      </div>
      <PaceStrip />
    </div>
  );
}

/* ---------- The closing band's screen ---------- */

/** The top of the safety console, rising out of the closing band. */
function SafetyPeek() {
  return (
    <div className="rounded-t-xl border border-b-0 border-white/20 bg-white p-4 text-left shadow-[0_-12px_48px_-16px_rgba(4,24,72,0.55)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-foreground">
          <VanteraLogo className="size-4 text-[var(--fb)]" />
          Account safety
        </span>
        <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
          <span className="size-1.5 rounded-full bg-[#13a05a]" />
          All clear
        </span>
      </div>
      <div className="mt-3.5 space-y-2">
        {[CHECKS[0], CHECKS[1], CHECKS[4]].map((c) => (
          <CheckRow key={c.label} {...c} />
        ))}
      </div>
    </div>
  );
}

export const visuals: FeatureVisuals = {
  Window: SafetyWindow,
  Peek: SafetyPeek,
  benefits: [SignInScreen, CeilingScreen, RampScreen],
  benefitIcons: [LockKeyhole, Gauge, TrendingUp],
  steps: [ConnectStep, RampStep, CeilingStep],
};
