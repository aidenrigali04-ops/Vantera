import type { FitVerdict } from "@/lib/learning/fit";
import type { IntentPostIn, WhyNowCell } from "@/lib/prospects/why-now-cell";

/** Shared types for the lead profiler (shell: `../lead-profile.tsx`, sections: `./sections/`). */

export interface LeadProfileInsights {
  pain_points?: string[];
  triggers?: string[];
  motivations?: string[];
  value_angle?: string;
  aha_moment?: string;
  summary?: string;
}

export type PeekSignal = {
  kind: string;
  label: string | null;
  detail?: string | null;
  level?: string | null;
  source?: string | null;
  observed_at?: string | null;
};
export type PeekPost = { post_ref: string; headline: string | null; detail: string | null; observed_at: string };

export type QueuedDraft = {
  id: string;
  body: string;
  status: string;
  linkedin_stage: string | null;
  origin: string | null;
  style_flags: unknown;
};
export type RegenerateDraft = (
  sendId: string,
  steer: string
) => Promise<{ body?: string; styleFlags?: string | null; error?: string }>;

export interface LeadProfile {
  id?: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  company_name: string | null;
  company_size: string | null;
  industry: string | null;
  location: string | null;
  tech_stack: string[] | null;
  status: string;
  ai_score: number | null;
  ai_rationale: string | null;
  ai_insights: LeadProfileInsights | null;
  scored_at?: string | null;
  email: string | null;
  email_status: string | null;
  phone: string | null;
  phone_status: string | null;
  linkedin_url: string | null;
  /** where the lead entered the funnel — "intent" drives the In-market badge */
  source?: string | null;
  /** real captured buying signals (lead_signals, 0031) — the "why now" line, when present */
  lead_signals?: PeekSignal[] | null;
  /** ML-2: what in this prospect matches the people who actually reply (account's own outcomes) */
  learned_reasons?: { label: string; ratio: number }[] | null;
  /** ML-4: the user's own "Good fit" / "Not a fit" verdict */
  fit_verdict?: FitVerdict | null;
  /** UX-2: the saved "why not a fit" note */
  fit_reason?: string | null;
  /** UX-2: the precomputed reason cell (server-side `when`, no clock read in render) */
  why_now?: WhyNowCell;
  /** UX-2: in-market posts behind the intent signal */
  intent_posts?: IntentPostIn[];
  /** UX-2: the prospect's queued draft, if one is waiting */
  queued_draft?: QueuedDraft | null;
}

export type PeekNavProps = { index: number; total: number; onPrev: () => void; onNext: () => void };
