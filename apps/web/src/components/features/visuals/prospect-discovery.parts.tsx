import type { ReactNode } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "@/components/landing/vantera-logo";

/**
 * The product-window vocabulary shared by the "Find buyers" feature pictures
 * (prospect-discovery and fit-scoring): the app window's frame, its figures, the
 * sample cast's avatars, score badges and rings, and pass/fail chips. Drawn the way
 * the homepage draws Vantera (app-replica.tsx): white surfaces, hairline borders, soft
 * blue for what's active. No hooks, so both the server-rendered screens and the
 * animated windows can use them. Every name and number is sample data.
 */

/** A bordered line inside a card, as in ScreenRow. */
export const ROW =
  "flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2";

/** The page's soft grey, half-mixed with white: rails, footers, wells. */
export const SOFT = "bg-[color-mix(in_oklab,var(--tint)_60%,white)]";

export interface Person {
  initials: string;
  name: string;
  role: string;
  tint: string;
}

export function Avatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold text-white",
        size === "sm" && "size-6 text-[0.6rem]",
        size === "md" && "size-7 text-[0.65rem]",
        size === "lg" && "size-9 text-[0.75rem]",
      )}
      style={{ backgroundColor: person.tint }}
    >
      {person.initials}
    </span>
  );
}

/** Name over role · company, truncating as one block. */
export function Who({ person, size = "md" }: { person: Person; size?: "md" | "lg" }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar person={person} size={size === "lg" ? "lg" : "md"} />
      <span className="min-w-0">
        <span
          className={cn(
            "block truncate font-semibold leading-tight text-foreground",
            size === "lg" ? "text-[0.9rem]" : "text-[0.78rem]",
          )}
        >
          {person.name}
        </span>
        <span className="block truncate text-[0.68rem] leading-tight text-[var(--ink-4)]">{person.role}</span>
      </span>
    </span>
  );
}

/** Score colour: green from 90, blue from 70 (enters outreach), grey below. */
export function scoreTone(score: number) {
  if (score >= 90) return { chip: "bg-[#e3f5ea] text-[#13824a]", ring: "#16a34a" };
  if (score >= 70) return { chip: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]", ring: "#1877f2" };
  return { chip: "bg-[rgba(12,16,26,0.05)] text-[var(--ink-3)]", ring: "#9aa0a8" };
}

export function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[2.1rem] justify-center rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold tabular-nums",
        scoreTone(score).chip,
      )}
    >
      {score}
    </span>
  );
}

/** A small ring filled to the score, the number inside. */
export function ScoreRing({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const C = 2 * Math.PI * 15.5;
  return (
    <span className={cn("relative grid shrink-0 place-items-center", size === "sm" ? "size-8" : "size-9")}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(12,16,26,0.07)" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke={scoreTone(score).ring}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * C} ${C}`}
        />
      </svg>
      <span className="text-[0.66rem] font-semibold tabular-nums text-foreground">{score}</span>
    </span>
  );
}

/** A pass/fail chip: a rule a prospect met, or the one it didn't. */
export function RuleChip({ label, ok = true }: { label: string; ok?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1 py-px text-[0.6rem] font-semibold",
        ok ? "bg-[#e3f5ea] text-[#13824a]" : "bg-[#fdedf1] text-[#c0365a]",
      )}
    >
      {ok ? <Check className="size-2.5" strokeWidth={3} /> : <X className="size-2.5" strokeWidth={3} />}
      {label}
    </span>
  );
}

/** A tick or a cross, on its own. */
export function PassMark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#e3f5ea] text-[#13824a]">
      <Check className="size-2.5" strokeWidth={3} />
    </span>
  ) : (
    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-[#fdedf1] text-[#c0365a]">
      <X className="size-2.5" strokeWidth={3} />
    </span>
  );
}

/** A soft chip: an ICP, a filter, a profile trait. */
export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "blue" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[0.68rem] font-medium",
        tone === "blue"
          ? "border-[rgba(24,119,242,0.25)] bg-[var(--cyan-tint)] text-[var(--cyan-strong)]"
          : "border-[var(--hairline)] bg-white text-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** A two-way switch, the active side raised on white. */
export function Segmented({ options, active }: { options: string[]; active: string }) {
  return (
    <span className="flex rounded-lg bg-[rgba(12,16,26,0.04)] p-0.5 text-[0.7rem] font-medium">
      {options.map((o) => (
        <span
          key={o}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1 text-center",
            o === active
              ? "bg-white text-[var(--fb-strong)] shadow-[0_1px_2px_rgba(16,24,40,0.08)]"
              : "text-[var(--ink-3)]",
          )}
        >
          {o}
        </span>
      ))}
    </span>
  );
}

/** One figure in the window's stats row. */
export function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-white px-4 py-3.5 lg:px-5">
      <p className="text-[0.7rem] font-medium text-[var(--ink-3)]">{label}</p>
      <div className="mt-1.5 flex h-7 items-center text-[1.4rem] font-semibold leading-none tracking-tight text-foreground tabular-nums">
        {children}
      </div>
    </div>
  );
}

/** A status dot: pulsing blue while the agent works, still green when it's done. */
export function StatusDot({ done }: { done: boolean }) {
  return (
    <span className="relative flex size-1.5">
      {!done && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[var(--fb)]/60 motion-reduce:animate-none" />
      )}
      <span
        className={cn(
          "relative inline-flex size-1.5 rounded-full transition-colors duration-300",
          done ? "bg-[#16a34a]" : "bg-[var(--fb)]",
        )}
      />
    </span>
  );
}

/** A placeholder bar for rows still loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span className={cn("block h-2.5 rounded-full bg-[rgba(12,16,26,0.06)] motion-safe:animate-pulse", className)} />
  );
}

/**
 * The Vantera app window: a title bar (the mark on its blue tile, the surface's name,
 * the agent it's showing, a status, a "Sample" tag), then the body, then an optional
 * action bar along the foot.
 */
export function AppWindow({
  title,
  context,
  status,
  footer,
  label,
  children,
  className,
}: {
  title: string;
  context: string;
  status: ReactNode;
  footer?: ReactNode;
  /** What the picture shows, for anyone who meets it outside an aria-hidden wrapper. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "overflow-hidden rounded-[14px] border border-white/70 bg-white text-left shadow-[0_2px_6px_rgba(3,22,58,0.16),0_40px_80px_-32px_rgba(3,22,58,0.55)]",
        className,
      )}
    >
      <div className="flex h-12 items-center gap-3 border-b border-[var(--hairline)] px-4">
        <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-[var(--fb)]">
          <VanteraLogo className="size-4 text-white" />
        </span>
        <span className="shrink-0 text-[0.82rem] font-semibold text-foreground">{title}</span>
        <span className="hidden items-center gap-1 rounded-md border border-[rgba(12,16,26,0.08)] bg-white px-2 py-0.5 text-[0.7rem] font-medium text-foreground sm:flex">
          {context}
          <ChevronDown className="size-3 text-[var(--ink-4)]" />
        </span>
        <span className="ml-auto flex min-w-0 items-center gap-2.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">
            {status}
          </span>
          <span className="hidden rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[var(--ink-3)] sm:inline">
            Sample
          </span>
        </span>
      </div>
      {children}
      {footer && (
        <div
          className={cn(
            "flex items-center justify-between gap-3 border-t border-[var(--hairline)] px-4 py-3",
            SOFT,
          )}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/** The top of a window rising out of the closing band (cropped by the band's foot). */
export function PeekFrame({ title, meta, children }: { title: string; meta: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-t-xl border border-b-0 border-white/20 bg-white p-4 text-left shadow-[0_-12px_48px_-16px_rgba(4,24,72,0.55)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[0.8rem] font-semibold text-foreground">
          <span className="grid size-5 place-items-center rounded-[6px] bg-[var(--fb)]">
            <VanteraLogo className="size-3 text-white" />
          </span>
          {title}
        </span>
        <span className="flex items-center gap-1.5 text-[0.7rem] font-medium text-[var(--ink-3)]">{meta}</span>
      </div>
      <div className="mt-3.5 space-y-2">{children}</div>
    </div>
  );
}

/* ---------- The sample cast ---------- */

export const RACHEL: Person = { initials: "RN", name: "Rachel Nguyen", role: "VP Sales · Northwind", tint: "#1877f2" };
export const MARCUS: Person = { initials: "MF", name: "Marcus Feld", role: "Head of Growth · Lumen", tint: "#5e6ad2" };
export const AISHA: Person = { initials: "AO", name: "Aisha Okafor", role: "Founder · Brightlane", tint: "#0f9d6e" };
export const LUIS: Person = { initials: "LR", name: "Luis Ramos", role: "Head of Sales · Meridian", tint: "#0c9fce" };
export const PRIYA: Person = { initials: "PN", name: "Priya Nair", role: "COO · Fieldnote", tint: "#c2557d" };
export const JAMAL: Person = { initials: "JC", name: "Jamal Carter", role: "Head of BD · Northgate", tint: "#7c8594" };
