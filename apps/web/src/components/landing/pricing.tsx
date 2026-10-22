import Link from "next/link";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  Check,
  Gauge,
  Headset,
  Inbox,
  Layers,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCog,
  Users,
  Workflow,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveTool, LIVE_TOOLS } from "@/lib/tools/registry";
import { Accent, Band, LINE, SectionHead } from "./frame";
import { VanteraLogo } from "./vantera-logo";
import { ClaudeMark, HubSpotMark, LinkedinMark, McpMark, SalesforceMark, SlackMark } from "./brand-glyphs";

/**
 * Landing pricing, after rankbox.xyz's pricing band (itself laid out like Rankaria's
 * plans): a row of static cards, each with a name, a price, a full-width button, a line
 * of reassurance, then what it includes as icon rows with a title and a one-line
 * detail. The recommended plan sits in the middle under a blue "7 days free" strip.
 *
 * Beside it sit the two other real ways in: the free tools (public, no signup) and a
 * custom plan for teams (a conversation, not a checkout). Nothing moves. The self-serve
 * card reads the real `plans` array page.tsx derives from `@vantera/billing` — the
 * plan billing marks `highlight` (center-stage), so the price shown can never drift
 * from Stripe. With no billing data it falls back to a clearly-placeholder `$[X]`,
 * never a fabricated price. The tool count comes from the live tools registry.
 */
export interface LandingPlan {
  tier: string;
  name: string;
  tagline: string;
  monthlyUsd: number;
  annualMonthlyUsd: number;
  annualYearlyUsd: number;
  highlight: boolean;
  features: string[];
}

type Icon = ComponentType<{ className?: string }>;

interface Row {
  icon: Icon;
  title: string;
  detail?: string;
  /** Rows that are destinations (the free tools) link to that tool. */
  href?: string;
}

/** Matches CTA_REASSURANCE's "Free 7-day trial" (claims.ts). */
const TRIAL_DAYS = 7;

/* Fallback copy, used only when no billing data reaches the component. */
const FALLBACK_NAME = "Starter";
const FALLBACK_TAGLINE = "For founders and operators running their own outbound.";
const STARTER_FEATURES = [
  "Agents prospecting 24/7",
  "500 prospects contacted / month",
  "Warm leads sourced automatically",
  "Unified inbox",
  "ICP lead scoring",
  "Machine-learned targeting",
  "Autopilot sending",
  "CRM + MCP integrations",
  "Email & chat support",
];

/* The custom plan's rows; it opens with "Everything in <plan>", added where the plan's
   name is known. Details restate the /pricing Enterprise card and integrations.tsx. */
const CUSTOM_ROWS: Row[] = [
  { icon: Gauge, title: "Custom agent + prospect volume", detail: "Priced to your goals" },
  {
    icon: Send,
    title: "More LinkedIn senders in parallel",
    detail: "Outreach spreads across every sender",
  },
  { icon: Headset, title: "Dedicated customer success manager" },
  {
    icon: Workflow,
    title: "Deep CRM + workflow integrations",
    detail: "HubSpot, Salesforce, GoHighLevel, Slack, and Claude via MCP",
  },
  {
    icon: UserCog,
    title: "Admin controls & team governance",
    detail: "Team seats and roles at your scale",
  },
];

/* Each plan feature gets an icon and, where the line is a bare noun, a one-line detail
   that only restates it (the billing copy stays the source of truth). First match wins;
   anything unmatched keeps a plain check. */
const FEATURE_LOOKS: { test: RegExp; icon: Icon; detail?: string }[] = [
  { test: /agents?\b/i, icon: Bot, detail: "Prospecting and outreach on autopilot" },
  { test: /vera|proven plays/i, icon: Sparkles },
  { test: /inbox/i, icon: Inbox, detail: "Every reply in one place" },
  { test: /enrichment|scoring|targeting/i, icon: ScanSearch, detail: "Machine-learned targeting" },
  { test: /senders?\b/i, icon: Send, detail: "Outreach spreads across every sender" },
  { test: /seats?\b/i, icon: Users, detail: "Add more seats anytime" },
  { test: /campaigns?\b/i, icon: Layers, detail: "Run several plays in parallel" },
  { test: /crm|integration/i, icon: Workflow },
];

function featureRow(feature: string): Row {
  // "Vera — self-optimizing outreach…" splits into a title and its own detail.
  const [head, tail] = feature.split(/\s+—\s+/, 2);
  const look = FEATURE_LOOKS.find((l) => l.test.test(feature));
  const detail = tail ? tail.charAt(0).toUpperCase() + tail.slice(1) : look?.detail;
  // A detail that repeats its own title adds nothing.
  return {
    icon: look?.icon ?? Check,
    title: head,
    detail: detail && detail.toLowerCase() !== head.toLowerCase() ? detail : undefined,
  };
}

/* ---------- The card every plan shares ---------- */

function Price({ amount, suffix }: { amount: number | null; suffix: string }) {
  const [whole, cents] = amount === null ? ["[X]", "00"] : amount.toFixed(2).split(".");
  return (
    <p className="mt-6 flex items-start text-foreground">
      <span className="mt-1.5 text-xl font-medium">$</span>
      <span className="text-[3.25rem] font-medium leading-none tracking-[-0.04em] tabular-nums">
        {whole}
        {cents !== "00" && <span className="text-[2rem] tracking-[-0.02em]">.{cents}</span>}
      </span>
      <span className="ml-1.5 self-end pb-1.5 text-sm text-[var(--ink-3)]">{suffix}</span>
    </p>
  );
}

function PlanCard({
  featured = false,
  strip,
  icon,
  name,
  tag,
  subtitle,
  price,
  priceNote,
  action,
  reassurance,
  rows,
  className,
}: {
  featured?: boolean;
  strip?: string;
  icon: ReactNode;
  name: string;
  tag?: string;
  subtitle: string;
  price: ReactNode;
  priceNote: ReactNode;
  action: { label: string; href: string };
  reassurance: string;
  rows: Row[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl bg-white",
        featured
          ? "border-[1.5px] border-[var(--fb-strong)] shadow-[0_1px_2px_rgba(16,24,40,0.05),0_24px_48px_-28px_rgba(16,24,40,0.28)]"
          : "border border-[rgba(12,16,26,0.09)] shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {strip && (
        <p className="bg-[var(--fb-strong)] py-1.5 text-center text-xs font-semibold text-white">
          {strip}
        </p>
      )}

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        <div className="flex items-start gap-3">
          {icon}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[1.35rem] font-medium leading-tight tracking-tight text-foreground">
                {name}
              </h3>
              {tag && (
                <span className="rounded-md bg-[var(--cyan-tint)] px-2 py-0.5 text-xs font-medium text-[#1161cc]">
                  {tag}
                </span>
              )}
            </div>
            {/* Two lines' room on every card, so the prices line up. */}
            <p className="mt-0.5 min-h-[2.5rem] text-sm text-[var(--ink-3)]">{subtitle}</p>
          </div>
        </div>

        {price}
        <p className="mt-2 text-sm text-[var(--ink-3)]">{priceNote}</p>

        <Link
          href={action.href}
          className="group mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--fb-strong)] px-5 text-[0.95rem] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)] transition-colors hover:bg-[#1161cc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--fb-tint)]"
        >
          {action.label}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="mt-3 text-balance text-center text-xs leading-relaxed text-[var(--ink-3)]">
          <ShieldCheck className="mr-1 inline size-3.5 -translate-y-px align-middle" />
          {reassurance}
        </p>

        <ul className={cn("mt-6 space-y-4 border-t pt-6", LINE)}>
          {rows.map(({ icon: RowIcon, title, detail, href }) => {
            const body = (
              <>
                <RowIcon className="mt-0.5 size-[1.1rem] shrink-0 text-[var(--fb)]" />
                <div className="min-w-0">
                  <p className="text-[0.92rem] font-medium leading-snug text-foreground transition-colors group-hover/row:text-[var(--fb-strong)]">
                    {title}
                  </p>
                  {detail && (
                    <p className="mt-0.5 text-[0.8rem] leading-snug text-[var(--ink-3)]">{detail}</p>
                  )}
                </div>
              </>
            );
            return (
              <li key={title}>
                {href ? (
                  <Link
                    href={href}
                    className="group/row -m-1.5 flex items-start gap-3 rounded-lg p-1.5 transition-colors hover:bg-[rgba(12,16,26,0.03)]"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

const PlanIcon = ({ icon: I }: { icon: Icon }) => (
  <I className="mt-0.5 size-8 shrink-0 text-[var(--fb)]" />
);

/* ---------- The free tools ---------- */

/* A profile → posts → outreach walk through the toolkit. Names and taglines are the
   tools' own (lib/tools/registry.ts); a slug that stops being live drops out. */
const FREE_TOOL_SLUGS = [
  "linkedin-headline-generator",
  "linkedin-hook-generator",
  "connection-request-generator",
  "cold-outreach-generator",
  "linkedin-profile-analyzer",
];
const TOOL_ROWS: Row[] = FREE_TOOL_SLUGS.flatMap((slug) => {
  const tool = getLiveTool(slug);
  if (!tool) return [];
  return [{ icon: tool.icon, title: tool.name, detail: tool.tagline, href: `/tools/${slug}` }];
});

/* ---------- The strip under the cards ---------- */

const WORKS_WITH: { name: string; color: string; Mark: Icon }[] = [
  { name: "LinkedIn", color: "#0a66c2", Mark: LinkedinMark },
  { name: "HubSpot", color: "#ff5c35", Mark: HubSpotMark },
  { name: "Salesforce", color: "#00a1e0", Mark: SalesforceMark },
  { name: "Slack", color: "#4a154b", Mark: SlackMark },
  { name: "Claude", color: "#d97757", Mark: ClaudeMark },
  { name: "MCP", color: "#0a0c12", Mark: McpMark },
];

export function Pricing({ plans }: { plans?: LandingPlan[] }) {
  // The self-serve plan is the one billing puts center-stage (`highlight`); a single
  // plan stands in for it. Without billing data, the fallback copy shows a `$[X]`
  // placeholder rather than an invented number.
  const plan = plans?.find((p) => p.highlight) ?? plans?.[0];
  const name = plan?.name ?? FALLBACK_NAME;
  const features = plan?.features.length ? plan.features : STARTER_FEATURES;
  // Vantera runs on autopilot: per-message approval is not part of the offer, so any
  // approval-centric line in the billing copy stays off the landing (the billing
  // package itself is untouched — it also feeds existing subscribers' pages).
  const planRows = features.filter((f) => !/approv/i.test(f)).map(featureRow);
  // The sender count is the plan's headline capacity; it rides beside the name.
  const senders = features.join("\n").match(/(\d+) LinkedIn senders? included/i)?.[1];

  const customRows: Row[] = [
    { icon: Check, title: `Everything in ${name}`, detail: "The same system, built around your team" },
    ...CUSTOM_ROWS,
  ];

  return (
    <section>
      <SectionHead
        id="pricing"
        icon={Tag}
        eyebrow="Simple pricing"
        title={
          <>
            Simple, <Accent>transparent pricing</Accent>
          </>
        }
        subtitle="Start free. Pick a plan when you deploy your first agent. No contracts, no surprises."
      />

      <Band inner="px-5 py-14 sm:px-8 sm:py-16">
        <div className="mx-auto grid max-w-[26rem] items-start gap-5 lg:max-w-none lg:grid-cols-3">
          <PlanCard
            icon={<PlanIcon icon={Wrench} />}
            name="Free tools"
            subtitle="For your LinkedIn profile, posts, and outreach"
            price={<Price amount={0} suffix="no signup" />}
            priceNote={`${LIVE_TOOLS.length} tools, free to use.`}
            action={{ label: `Browse all ${LIVE_TOOLS.length} tools`, href: "/tools" }}
            reassurance="No signup, no card."
            rows={TOOL_ROWS}
            className="order-2 lg:order-none"
          />

          <PlanCard
            featured
            strip={`${TRIAL_DAYS} days free`}
            icon={<VanteraLogo className="mt-0.5 size-8 shrink-0 text-[var(--fb)]" />}
            name={name}
            tag={senders ? `${senders} LinkedIn senders` : undefined}
            subtitle={plan?.tagline ?? FALLBACK_TAGLINE}
            price={<Price amount={plan?.monthlyUsd ?? null} suffix="/month" />}
            priceNote="Billed monthly. Everything included."
            action={{ label: "Get Started Free", href: "/signup" }}
            reassurance={
              plan
                ? `Free ${TRIAL_DAYS}-day trial, then $${plan.monthlyUsd}/month. Cancel anytime.`
                : `Free ${TRIAL_DAYS}-day trial. Cancel anytime.`
            }
            rows={planRows}
            className="order-1 lg:order-none"
          />

          <PlanCard
            icon={<PlanIcon icon={Building2} />}
            name="Custom"
            subtitle="For teams (5+) and agencies scaling LinkedIn outreach"
            price={
              <p className="mt-6 flex flex-wrap items-start text-foreground">
                <span className="text-[3.25rem] font-medium leading-none tracking-[-0.04em]">
                  Custom
                </span>
                <span className="ml-1.5 self-end pb-1.5 text-sm text-[var(--ink-3)]">
                  volume-based
                </span>
              </p>
            }
            priceNote="Volume-based pricing, built around your team and goals."
            action={{ label: "Book a demo", href: "/demo" }}
            reassurance="We'll map it to your goals on the call."
            rows={customRows}
            className="order-3 lg:order-none"
          />
        </div>
      </Band>

      {/* Where it plugs in: the network it sends on and the tools wins flow into. */}
      <Band>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-6 sm:flex-row sm:gap-5 sm:px-8">
          <span className="shrink-0 text-[0.64rem] font-semibold uppercase tracking-[0.2em] text-[var(--ink-3)]/85">
            Works with
          </span>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {WORKS_WITH.map(({ name: label, color, Mark }) => (
              <li
                key={label}
                style={{ "--mark": color } as CSSProperties}
                className="group/p flex items-center gap-1.5 text-[0.85rem] font-medium text-foreground/60 transition-colors hover:text-foreground"
              >
                <Mark className="size-4 text-[#8e96a1] transition-colors group-hover/p:text-[var(--mark)]" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </Band>
    </section>
  );
}
