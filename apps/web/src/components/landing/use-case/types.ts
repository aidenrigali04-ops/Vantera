import type { FaqItem } from "@/components/landing/faq-data";
import type { UseCaseIconKey } from "./icons";

/**
 * Use-case page content model — the ONE shape every persona page fills in. Everything is
 * plain, serializable data (strings / numbers / arrays / string icon keys) so a server
 * `page.tsx` can pass it straight into the "use client" section components across the RSC
 * boundary (no JSX, no function references). Replication = a new `content.ts`, same sections.
 */

export interface CtaLink {
  label: string;
  href: string;
}

/** Hero "command center" instrument data — a live team-pipeline dashboard. */
export interface HeroVisual {
  title: string;
  period: string;
  /** Funnel stages, first → last (Sourced → … → Booked). */
  funnel: { label: string; value: number }[];
  /** Leaderboard rows — one per rep/seat. `tint` is a brand-neutral hex accent. */
  reps: {
    initials: string;
    name: string;
    role: string;
    booked: number;
    trend: number[];
    delta: string;
    tint: string;
  }[];
  /** Reply-rate gauge (0–100). */
  replyRate: number;
  replyRateLabel: string;
  /** Weekly booked-meetings sparkline. */
  bookedTrend: number[];
  bookedDelta: string;
  /** The live "new qualified lead" toast that slides in. */
  toast: { name: string; role: string; fit: number; signal: string };
  /** Per-persona labels (default to the sales-team wording when omitted). */
  funnelCaption?: string;
  leaderboardTitle?: string;
  leaderboardTrendLabel?: string;
  toastLabel?: string;
}

export interface HeroContent {
  eyebrow: string;
  /** Headline is split so the middle phrase renders in the reserved blue chip. */
  headlinePre: string;
  headlineHighlight: string;
  headlinePost?: string;
  sub: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  /** Small reassurance items shown under the CTAs. */
  trust: string[];
  visual: HeroVisual;
}

export interface ProblemItem {
  icon: UseCaseIconKey;
  title: string;
  body: string;
  /** The quantified cost of the status quo (illustrative). */
  costValue: string;
  costLabel: string;
}

export interface ProblemContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: ProblemItem[];
  /** One closing line under the grid. */
  kicker: string;
}

export interface CompareStep {
  label: string;
  meta?: string;
}

export interface WorkflowCompareContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  before: { heading: string; caption: string; steps: CompareStep[] };
  after: { heading: string; caption: string; steps: CompareStep[] };
}

export interface BenefitItem {
  icon: UseCaseIconKey;
  value: string;
  title: string;
  body: string;
  /** Optional micro-trend sparkline for the tile. */
  trend?: number[];
  delta?: string;
}

export interface BenefitsContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: BenefitItem[];
}

export interface FeatureItem {
  icon: UseCaseIconKey;
  label: string;
  title: string;
  body: string;
  chips: string[];
  /** Marks the wide, accent "differentiator" card. */
  highlight?: boolean;
}

export interface FeaturesContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: FeatureItem[];
  /** Which live mock the wide differentiator card shows. Default: multi-sender spread.
   *  Use "pace" for solo personas (one account) so the mock stays honest. */
  highlightMock?: "senders" | "pace";
}

/** One draft in the interactive review-queue showcase. */
export interface ReviewDraft {
  initials: string;
  name: string;
  role: string;
  company: string;
  fit: number;
  tint: string;
  /** The in-market signal that triggered the draft. */
  signal: string;
  /** ai_insights chips (pain / trigger / value angle). */
  insights: { label: string; value: string }[];
  /** The drafted LinkedIn message. */
  message: string;
}

export interface ReviewShowcaseContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  drafts: ReviewDraft[];
}

export interface PipelineNode {
  icon: UseCaseIconKey;
  label: string;
  line: string;
  metric: string;
}

export interface PipelineContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  nodes: PipelineNode[];
  /** Steps for the HowTo JSON-LD (name + text). */
  howto: { name: string; text: string }[];
}

export interface OutcomeMetric {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  caption: string;
}

export interface OutcomesContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics: OutcomeMetric[];
  quote: { text: string; name: string; role: string; company: string; initials: string };
}

export interface RoiContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  /** Slider defaults / bounds. */
  reps: { min: number; max: number; default: number };
  dealSize: { min: number; max: number; step: number; default: number };
  meetings: { min: number; max: number; default: number; label: string };
  /** Illustrative assumptions, shown as a footnote for honesty. */
  assumptions: string;
  /** Monthly Vantera cost used for the vs-hire comparison. */
  monthlyCost: number;
  /** Per-persona relabeling (default to the sales-team wording when omitted). */
  repsLabel?: string;
  dealSizeLabel?: string;
  pipelineLabel?: string;
  meetingsOutputLabel?: string;
  hoursLabel?: string;
  equivalentUnit?: string;
  equivalentTail?: string;
}

export interface FaqContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: FaqItem[];
}

export interface FinalCtaContent {
  eyebrow: string;
  title: string;
  urgency: string;
  primaryCta: CtaLink;
  secondaryCta: CtaLink;
  reassurance: string[];
}

/** The complete content model for one use-case page. */
export interface UseCaseContent {
  slug: string;
  /** For metadata + breadcrumbs. */
  seo: { title: string; description: string };
  hero: HeroContent;
  problem: ProblemContent;
  compare: WorkflowCompareContent;
  benefits: BenefitsContent;
  features: FeaturesContent;
  review: ReviewShowcaseContent;
  pipeline: PipelineContent;
  outcomes: OutcomesContent;
  roi: RoiContent;
  faq: FaqContent;
  finalCta: FinalCtaContent;
}

/** Hub-card summary for the /use-cases index. */
export interface UseCaseSummary {
  slug: string;
  persona: string;
  title: string;
  blurb: string;
  icon: UseCaseIconKey;
  metric: { value: string; label: string };
  live: boolean;
}
