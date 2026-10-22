import type { LeadOutcomeFlags } from "../optimize/outcomes";
import { buildTargetingProfile, rankByTilt, SEGMENT_FLOOR, seniorityBucket, type TargetingProfile, type TargetingRow } from "./tilt";

/**
 * ML-1 outcome learner (spec 2026-10-21-learning-gate-ml-roadmap.md §3.2): which features of a
 * qualified lead — source, buying-signal kinds, intent level, seniority, industry, size, and the
 * LLM score band itself — actually predict a positive reply (interested or booked) among MATURED
 * invites. Additive log-odds over feature families with hierarchical empirical-Bayes shrinkage
 * (global pool → account), so a feature earns influence only as its evidence grows. Ordering and
 * insight only: the qualification gate (score ≥ min_score, rule 06) is never moved by this. Pure.
 */

export type LearnerFeatures = {
  source?: string | null;
  /** buying-signal kinds on the lead (lead_signals.kind), multi-valued */
  signals?: string[];
  /** intent level when the lead came from an intent signal (high | medium | …) */
  intentLevel?: string | null;
  title: string | null;
  industry: string | null;
  companySize?: string | null;
  aiScore: number | null;
};
export type LearnerRow = LearnerFeatures & { flags: LeadOutcomeFlags };

type Count = { n: number; k: number };
/** Invited-lead counts: overall (n, k = positives) and per feature key. */
export type CountTable = { n: number; k: number; features: Map<string, Count> };

export type LearnedModel = {
  /** account base positive rate, shrunk toward the global base */
  base: number;
  /** matured invites behind the model (account + global pool) */
  evidence: number;
  /** per feature key: shrunk log rate-ratio vs base, and the account+global sample behind it */
  lifts: Map<string, { lift: number; n: number }>;
};

/** Matured invites (account + pool) before the learner may order anything. Below it: inert. */
export const LEARN_MIN_N = 30;
/** Pseudo-observations pulling a rate toward its prior — same M as tilt.ts / bandit.ts. */
const SHRINK_M = 25;
/** A single feature can move odds by at most e^±1.5 (≈ ×4.5 / ×0.22). */
const LIFT_CAP = 1.5;
const MULTI_VALUED = new Set(["signal"]);

const norm = (s: string | null | undefined) => s?.trim().toLowerCase() || null;

function scoreBand(score: number | null): string | null {
  if (score === null || !Number.isFinite(score)) return null;
  if (score >= 90) return "90+";
  if (score >= 80) return "80-89";
  if (score >= 70) return "70-79";
  return "<70";
}

/** The feature keys (`family:value`) a lead carries. */
export function featureKeys(lead: LearnerFeatures): string[] {
  const keys = new Set<string>();
  const source = norm(lead.source);
  if (source) keys.add(`source:${source}`);
  for (const s of lead.signals ?? []) {
    const kind = norm(s);
    if (kind) keys.add(`signal:${kind}`);
  }
  const intent = norm(lead.intentLevel);
  if (intent) keys.add(`intent:${intent}`);
  keys.add(`seniority:${seniorityBucket(lead.title)}`);
  const industry = norm(lead.industry);
  if (industry) keys.add(`industry:${industry}`);
  const size = norm(lead.companySize);
  if (size) keys.add(`size:${size}`);
  const band = scoreBand(lead.aiScore);
  if (band) keys.add(`score:${band}`);
  return [...keys];
}

const isPositive = (f: LeadOutcomeFlags) => f.interested || f.booked;

export function countRows(rows: LearnerRow[]): CountTable {
  const table: CountTable = { n: 0, k: 0, features: new Map() };
  for (const r of rows) {
    if (!r.flags.invited) continue;
    const pos = isPositive(r.flags) ? 1 : 0;
    table.n++;
    table.k += pos;
    for (const key of featureKeys(r)) {
      const c = table.features.get(key) ?? { n: 0, k: 0 };
      c.n++;
      c.k += pos;
      table.features.set(key, c);
    }
  }
  return table;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Keep rates off 0/1 so logs stay finite. */
const safe = (p: number) => clamp(p, 1e-4, 1 - 1e-4);

/**
 * Fit the account model. Global pool (all accounts, counts only) gives each feature a prior lift;
 * the account's own counts then shrink toward `account base × global lift`. No global table ⇒
 * features shrink straight to the account base.
 */
export function fitLearner(account: CountTable, global?: CountTable): LearnedModel {
  const g = global ?? { n: 0, k: 0, features: new Map<string, Count>() };
  const gBase = g.n > 0 ? g.k / g.n : account.n > 0 ? account.k / account.n : 0;
  const base = safe((account.k + SHRINK_M * gBase) / (account.n + SHRINK_M));

  const lifts = new Map<string, { lift: number; n: number }>();
  const keys = new Set([...account.features.keys(), ...g.features.keys()]);
  for (const key of keys) {
    const gc = g.features.get(key) ?? { n: 0, k: 0 };
    const ac = account.features.get(key) ?? { n: 0, k: 0 };
    // global feature rate shrunk to the global base → its ratio is this feature's prior lift
    const gRatio = gBase > 0 && gc.n > 0 ? safe((gc.k + SHRINK_M * gBase) / (gc.n + SHRINK_M)) / safe(gBase) : 1;
    const prior = safe(base * gRatio);
    const rate = safe((ac.k + SHRINK_M * prior) / (ac.n + SHRINK_M));
    lifts.set(key, { lift: clamp(Math.log(rate / base), -LIFT_CAP, LIFT_CAP), n: ac.n + gc.n });
  }
  return { base, evidence: account.n + g.n, lifts };
}

export function isInformative(model: LearnedModel): boolean {
  return model.evidence >= LEARN_MIN_N;
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export type Prediction = { p: number; logOdds: number; top: { feature: string; lift: number }[] };

/**
 * Predicted positive-reply probability. Single-valued families add their lift; a multi-valued
 * family (signals) contributes only its largest-magnitude lift — correlated evidence (a funded
 * company that's also hiring execs) is one signal, not two.
 */
export function predictLead(model: LearnedModel, lead: LearnerFeatures): Prediction {
  const byFamily = new Map<string, { feature: string; lift: number }>();
  for (const key of featureKeys(lead)) {
    const l = model.lifts.get(key);
    if (!l) continue;
    const family = key.slice(0, key.indexOf(":"));
    const prev = byFamily.get(family);
    if (!prev || (MULTI_VALUED.has(family) && Math.abs(l.lift) > Math.abs(prev.lift))) {
      byFamily.set(family, { feature: key, lift: l.lift });
    }
  }
  const parts = [...byFamily.values()];
  const logOdds = logit(model.base) + parts.reduce((s, x) => s + x.lift, 0);
  return {
    p: sigmoid(logOdds),
    logOdds,
    top: parts.filter((x) => x.lift !== 0).sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift)),
  };
}

/** Best-first by predicted p, ties by ai score — ordering ONLY, never a gate. */
export function rankByLearned<T extends LearnerFeatures>(leads: T[], model: LearnedModel): T[] {
  const scored = leads.map((lead) => ({ lead, p: predictLead(model, lead).p }));
  scored.sort((a, b) => b.p - a.p || (b.lead.aiScore ?? 0) - (a.lead.aiScore ?? 0));
  return scored.map((s) => s.lead);
}

export type SignalReportRow = { feature: string; lift: number; n: number };

/** The strongest positive / negative features — the automatic "which signals work" readout. */
export function signalReport(model: LearnedModel, k = 5): { positive: SignalReportRow[]; negative: SignalReportRow[] } {
  const all = [...model.lifts.entries()].map(([feature, l]) => ({ feature, lift: Math.round(l.lift * 100) / 100, n: l.n }));
  return {
    positive: all.filter((r) => r.lift > 0).sort((a, b) => b.lift - a.lift).slice(0, k),
    negative: all.filter((r) => r.lift < 0).sort((a, b) => a.lift - b.lift).slice(0, k),
  };
}

/** How a set of qualified leads gets ordered: the learner when it has evidence, else ML-0's tilt. */
export type LeadOrdering =
  | { kind: "learned"; model: LearnedModel }
  | { kind: "tilt"; profile: TargetingProfile };

export function buildLeadOrdering(account: CountTable, global: CountTable | undefined, tiltRows: TargetingRow[]): LeadOrdering {
  const model = fitLearner(account, global);
  return isInformative(model) ? { kind: "learned", model } : { kind: "tilt", profile: buildTargetingProfile(tiltRows) };
}

export function orderLeads<T extends LearnerFeatures>(leads: T[], ordering: LeadOrdering): T[] {
  return ordering.kind === "learned" ? rankByLearned(leads, ordering.model) : rankByTilt(leads, ordering.profile);
}

// ── What users see (ML-2) ────────────────────────────────────────────────────────────────────
// Displayed numbers come from the account's OWN outcomes only: the cross-account pool may shape
// ordering (above), but never a number on screen — with few accounts in the pool a blended rate
// could reveal another tenant's results.

/** Own matured invites behind a feature before it may be shown (same floor as tilt.ts). */
const DISPLAY_FLOOR = SEGMENT_FLOOR;
/** Lifts smaller than this read as noise and aren't shown (≈ ±10%). */
const DISPLAY_MIN_LIFT = 0.1;
const DISPLAY_MAX_FEATURES = 40;

export type ReadoutFeature = { feature: string; lift: number; ratio: number; n: number };
/** The account's learned readout, persisted with each scout run and read by the web app. */
export type LearnedReadout = { evidence: number; features: ReadoutFeature[] };

export function buildReadout(account: CountTable): LearnedReadout {
  const model = fitLearner(account);
  const features = [...model.lifts.entries()]
    .map(([feature, l]) => ({ feature, lift: l.lift, n: account.features.get(feature)?.n ?? 0 }))
    .filter((f) => f.n >= DISPLAY_FLOOR && Math.abs(f.lift) >= DISPLAY_MIN_LIFT)
    .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
    .slice(0, DISPLAY_MAX_FEATURES)
    .map((f) => ({ ...f, lift: Math.round(f.lift * 100) / 100, ratio: Math.round(Math.exp(f.lift) * 10) / 10 }));
  return { evidence: account.n, features };
}

export type LeadReason = { feature: string; label: string; ratio: number };

/** Up to `k` plain reasons this lead ranks where it does — empty until the account has evidence. */
export function explainLead(readout: LearnedReadout, lead: LearnerFeatures, k = 3): LeadReason[] {
  if (readout.evidence < LEARN_MIN_N) return [];
  const byKey = new Map(readout.features.map((f) => [f.feature, f]));
  const byFamily = new Map<string, ReadoutFeature>();
  for (const key of featureKeys(lead)) {
    const f = byKey.get(key);
    if (!f) continue;
    const family = key.slice(0, key.indexOf(":"));
    const prev = byFamily.get(family);
    if (!prev || Math.abs(f.lift) > Math.abs(prev.lift)) byFamily.set(family, f);
  }
  return [...byFamily.values()]
    .sort((a, b) => Math.abs(b.lift) - Math.abs(a.lift))
    .slice(0, k)
    .map((f) => ({ feature: f.feature, label: featureLabel(f.feature), ratio: f.ratio }));
}

const SIGNAL_LABELS: Record<string, string> = {
  funding: "Funding signal",
  exec_hire: "New executive hire signal",
  m_and_a: "Acquisition signal",
  office_opening: "New office signal",
  product_launch: "Product launch signal",
  partnership: "Partnership signal",
  award: "Award signal",
  hiring: "Hiring signal",
  workforce: "Workforce change signal",
  cost_cutting: "Cost-cutting signal",
  legal: "Legal event signal",
  security: "Security event signal",
  intent: "Buying-intent signal",
  other: "Company news signal",
};
const SENIORITY_LABELS: Record<string, string> = {
  founder: "Founders",
  exec: "C-level executives",
  vp: "VPs",
  director: "Directors",
  manager: "Managers",
  other: "Other roles",
};
const SOURCE_LABELS: Record<string, string> = {
  intent: "Found showing intent",
  discovery: "Found by search",
  manual: "Added by you",
  import: "Imported",
  inbound: "Inbound",
  ad: "From ads",
};
const ACRONYMS: Record<string, string> = { saas: "SaaS", it: "IT", b2b: "B2B", b2c: "B2C", ai: "AI", hr: "HR", crm: "CRM" };
const titleCase = (s: string) =>
  s
    .split(/[\s_]+/)
    .map((w) => ACRONYMS[w] ?? (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");

/** A feature key in plain words, for reasons and the "What's working" panel. */
export function featureLabel(key: string): string {
  const i = key.indexOf(":");
  const family = key.slice(0, i);
  const value = key.slice(i + 1);
  switch (family) {
    case "signal":
      return SIGNAL_LABELS[value] ?? `${titleCase(value)} signal`;
    case "seniority":
      return SENIORITY_LABELS[value] ?? titleCase(value);
    case "industry":
      return `${titleCase(value)} industry`;
    case "size":
      return `${value} employees`;
    case "score":
      return `Score ${value}`;
    case "source":
      return SOURCE_LABELS[value] ?? titleCase(value);
    case "intent":
      return `${titleCase(value)} intent`;
    default:
      return titleCase(value);
  }
}
