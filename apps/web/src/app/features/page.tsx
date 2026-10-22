import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BrainCircuit, ChevronRight, Layers, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { LandingNav } from "@/components/landing/nav";
import { LandingFooter } from "@/components/landing/footer";
import { landingFont } from "@/components/landing/font";
import { Band, CELL, CellGrid, LINE, Pill, SectionHead, Accent, Spacer } from "@/components/landing/frame";
import { MarkDither } from "@/components/landing/hero-dither";
import { PaintedStage } from "@/components/landing/painted-stage";
import { AppReplica } from "@/components/landing/app-replica";
import { UrlForm } from "@/components/landing/url-form";
import { Pricing } from "@/components/landing/pricing";
import { FaqHome } from "@/components/landing/faq-home";
import { FinalCta } from "@/components/landing/final-cta";
import { CEILING_FACT, CTA_REASSURANCE, ONBOARDING_MINUTES } from "@/components/landing/claims";
import { ENGINE_ORDER, FEATURE_GROUPS, featuresIn, type Feature, type FeatureGroup } from "@/lib/features";
import { getLandingPlans } from "@/lib/landing-plans";
import { JsonLd, SITE_URL, breadcrumbLd } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Features: AI Prospecting, Scoring & LinkedIn Outreach | Vantera",
  description:
    "Every Vantera feature: prospect discovery, fit scoring, machine-learned targeting, autopilot outreach, a unified inbox, account safety, and CRM sync — one engine for LinkedIn.",
  alternates: { canonical: "/features" },
};

const FACTS = [
  { value: `${ONBOARDING_MINUTES} min`, label: "from your website to a live agent" },
  { value: "Up to 3", label: "ideal customer profiles per agent" },
  { value: "70+", label: "score to enter outreach" },
  { value: CEILING_FACT, label: "invite ceiling per account" },
];

const GROUP_COPY: Record<FeatureGroup, { icon: typeof Layers; title: React.ReactNode; subtitle: string }> = {
  "Find buyers": {
    icon: BrainCircuit,
    title: (
      <>
        Find the buyers <Accent>worth messaging</Accent>
      </>
    ),
    subtitle:
      "Agents search your ICP, score every person on fit and signals, and learn from who responds.",
  },
  "Book meetings": {
    icon: Send,
    title: (
      <>
        Turn them into <Accent>booked meetings</Accent>
      </>
    ),
    subtitle:
      "Openers written from real activity, replies answered on autopilot, inside limits that keep your account safe.",
  },
};

function FeatureCell({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  const step = String(ENGINE_ORDER.indexOf(feature.slug as (typeof ENGINE_ORDER)[number]) + 1).padStart(2, "0");
  return (
    <li className={CELL}>
      <Link
        href={`/features/${feature.slug}`}
        className="group flex h-full flex-col p-6 transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--tint)_45%,white)] sm:p-8"
      >
        <div className="flex items-center justify-between">
          <span className="grid size-10 place-items-center rounded-xl border border-[rgba(12,16,26,0.08)] bg-white text-[var(--fb)] shadow-[0_1px_2px_rgba(16,24,40,0.05)] transition-colors group-hover:bg-[var(--fb-strong)] group-hover:text-white">
            <Icon className="size-[18px]" />
          </span>
          <span className="text-[0.75rem] font-medium tabular-nums text-[var(--ink-3)]">{step}</span>
        </div>
        <p className="mt-6 text-[0.75rem] font-medium text-[var(--fb-strong)]">{feature.eyebrow}</p>
        <h3 className="mt-1 text-[1.25rem] font-medium tracking-[-0.02em] text-foreground">{feature.name}</h3>
        <p className="mt-2 flex-1 text-[0.9rem] leading-relaxed text-[var(--ink-3)]">{feature.tagline}</p>
        <dl className={cn("mt-6 grid grid-cols-2 gap-3 border-t pt-4", LINE)}>
          {feature.specs.slice(0, 2).map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="text-[1rem] font-medium tracking-[-0.01em] text-foreground">{s.value}</dd>
              <dd className="mt-0.5 text-[0.75rem] leading-snug text-[var(--ink-3)]">{s.label}</dd>
            </div>
          ))}
        </dl>
        <span className="mt-6 inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-[var(--fb-strong)]">
          Learn more
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </li>
  );
}

/**
 * /features — every feature on one page, in the homepage's frame: a hero with the
 * engine's facts, the product on the painted sky, then a band of feature cells per group
 * in the order a prospect moves through them, and the homepage's pricing, FAQ, and
 * closing band.
 */
export default function FeaturesIndex() {
  const plans = getLandingPlans();
  return (
    <div className={`landing ${landingFont.variable} relative min-h-screen w-full overflow-x-clip bg-white`}>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", url: SITE_URL },
          { name: "Features", url: `${SITE_URL}/features` },
        ])}
      />
      <LandingNav framed />
      <main>
        <section aria-labelledby="features-title" className="relative bg-white">
          <div className={cn("relative mx-auto max-w-6xl overflow-hidden border-x", LINE)}>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.42] [mask-image:radial-gradient(ellipse_66%_82%_at_50%_50%,#000_50%,transparent_100%)]"
            >
              <MarkDither />
            </div>
            <div className="relative flex flex-col items-center px-5 pb-16 pt-7 text-center sm:px-8 sm:pb-20 sm:pt-9 lg:pb-[5.5rem]">
              <nav aria-label="Breadcrumb">
                <ol className="flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-3)]">
                  <li>
                    <Link href="/" className="py-2 transition-colors hover:text-foreground">
                      Home
                    </Link>
                  </li>
                  <li aria-hidden>
                    <ChevronRight className="size-3" />
                  </li>
                  <li aria-current="page" className="font-medium text-foreground">
                    Features
                  </li>
                </ol>
              </nav>
              <div className="mt-10 sm:mt-12">
                <Pill icon={Layers}>One engine, seven features</Pill>
              </div>
              <h1
                id="features-title"
                className="mt-6 text-[2.3rem] font-medium leading-[1.08] tracking-[-0.035em] text-foreground min-[400px]:text-[2.6rem] sm:text-[3.5rem] lg:text-[4.15rem]"
              >
                <span className="block">Everything an SDR does,</span>{" "}
                <span className="mt-[0.04em] inline-flex items-center gap-[0.22em] whitespace-nowrap">
                  <span
                    aria-hidden
                    className="inline-flex size-[0.84em] shrink-0 items-center justify-center rounded-[0.2em] border border-[rgba(12,16,26,0.08)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
                  >
                    <Layers className="size-[48%] text-[var(--fb)]" strokeWidth={2.4} />
                  </span>
                  <span className="font-bold text-[var(--fb)]">on autopilot</span>
                </span>
              </h1>
              <p className="mt-6 max-w-[41rem] text-balance text-[1.05rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.15rem]">
                Find buyers who fit, score them with receipts, write every opener from real
                activity, and answer every reply, while machine learning sharpens who you target.
              </p>
              <div className="mt-9 w-full max-w-[37rem]">
                <UrlForm />
                <p className="mt-3.5 text-[0.82rem] text-[var(--ink-3)]">{CTA_REASSURANCE}</p>
              </div>
            </div>
          </div>
          <div className={cn("border-t", LINE)}>
            <div className={cn("mx-auto max-w-6xl border-x", LINE)}>
              <CellGrid className="grid-cols-2 md:grid-cols-4">
                {FACTS.map((s) => (
                  <li
                    key={s.label}
                    className={cn(CELL, "flex flex-col items-center justify-center px-4 py-6 text-center sm:py-7")}
                  >
                    <p className="text-[1.45rem] font-medium leading-none tracking-[-0.02em] text-foreground sm:text-[1.6rem]">
                      {s.value}
                    </p>
                    <p className="mt-2 max-w-[13rem] text-balance text-[0.8rem] leading-snug text-[var(--ink-3)]">
                      {s.label}
                    </p>
                  </li>
                ))}
              </CellGrid>
            </div>
          </div>
        </section>

        <section aria-label="The Vantera app">
          <Band inner="overflow-hidden">
            <PaintedStage>
              <AppReplica />
            </PaintedStage>
          </Band>
        </section>

        {FEATURE_GROUPS.map((group) => {
          const copy = GROUP_COPY[group];
          const features = featuresIn(group);
          return (
            <section key={group} aria-label={group}>
              <Spacer />
              <SectionHead icon={copy.icon} eyebrow={group} title={copy.title} subtitle={copy.subtitle} />
              <Band>
                <CellGrid
                  className={cn("sm:grid-cols-2", features.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4")}
                >
                  {features.map((f) => (
                    <FeatureCell key={f.slug} feature={f} />
                  ))}
                </CellGrid>
              </Band>
            </section>
          );
        })}

        <Spacer />
        <Pricing plans={plans} />
        <Spacer />
        <FaqHome />
        <Spacer />
        <FinalCta />
      </main>
      <LandingFooter framed />
    </div>
  );
}
