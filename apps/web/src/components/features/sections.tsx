import type { CSSProperties } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  Compass,
  Layers,
  Target,
  Workflow,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ENGINE_ORDER, getFeature, type Feature, type TwoPart } from "@/lib/features";
import {
  Accent,
  Band,
  CELL,
  CellGrid,
  LINE,
  Pill,
  PRIMARY_BUTTON,
  SectionHead,
} from "@/components/landing/frame";
import { MarkDither } from "@/components/landing/hero-dither";
import { PaintedStage } from "@/components/landing/painted-stage";
import { Reveal, RevealItem } from "@/components/landing/surface";
import { UrlForm } from "@/components/landing/url-form";
import { CTA_REASSURANCE } from "@/components/landing/claims";
import type { FeatureVisuals } from "./types";

/**
 * The sections of a /features/[slug] page, after rankbox.xyz's feature layouts, in the
 * landing page's frame: hairline rails, a hairline over every band, blank bands between
 * sections, white throughout. All copy comes from the feature's entry in lib/features.ts
 * and the pictures from its visuals module; these only decide how they're set.
 */

/* Staggers the CSS entrance (`landing-rise` in globals.css). */
const rise = (delay: number) => ({ "--rise-delay": `${delay}s` }) as CSSProperties;

/** A two-part title: the lead in ink, the closing phrase bold blue. */
function Two({ title }: { title: TwoPart }) {
  return (
    <>
      {title.lead} <Accent>{title.accent}</Accent>
    </>
  );
}

/* ---------- Hero ---------- */

/** The landing hero, retold for one feature: the same centred lockup over the dithered
    mark, the feature's icon where the homepage's word reel turns, and the feature's
    facts in the band that closes it. */
export function FeatureHero({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  return (
    <section id="top" aria-labelledby="feature-title" className="relative bg-white">
      <div className={cn("relative mx-auto max-w-6xl overflow-hidden border-x", LINE)}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.42] [mask-image:radial-gradient(ellipse_66%_82%_at_50%_50%,#000_50%,transparent_100%)]"
        >
          <MarkDither />
        </div>

        <div className="relative flex flex-col items-center px-5 pb-16 pt-7 text-center sm:px-8 sm:pb-20 sm:pt-9 lg:pb-[5.5rem]">
          <nav aria-label="Breadcrumb" className="landing-rise" style={rise(0)}>
            <ol className="flex items-center gap-1.5 text-[0.78rem] text-[var(--ink-3)]">
              <li>
                <Link href="/" className="py-2 transition-colors hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3" />
              </li>
              <li>
                <Link href="/features" className="py-2 transition-colors hover:text-foreground">
                  Features
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="size-3" />
              </li>
              <li aria-current="page" className="font-medium text-foreground">
                {feature.name}
              </li>
            </ol>
          </nav>

          <div className="landing-rise mt-10 sm:mt-12" style={rise(0.05)}>
            <Pill icon={Icon}>{feature.eyebrow}</Pill>
          </div>

          {/* The H1 is the LCP element: it paints on the server with no opacity gate. */}
          <h1
            id="feature-title"
            className="mt-6 text-[2.3rem] font-medium leading-[1.08] tracking-[-0.035em] text-foreground min-[400px]:text-[2.6rem] sm:text-[3.5rem] lg:text-[4.15rem]"
          >
            <span className="block">{feature.headline.lead}</span>{" "}
            <span className="mt-[0.04em] inline-flex items-center gap-[0.22em] whitespace-nowrap">
              <span
                aria-hidden
                className="inline-flex size-[0.84em] shrink-0 items-center justify-center rounded-[0.2em] border border-[rgba(12,16,26,0.08)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.06)]"
              >
                <Icon className="size-[48%] text-[var(--fb)]" strokeWidth={2.4} />
              </span>
              <span className="font-bold text-[var(--fb)]">{feature.headline.accent}</span>
            </span>
          </h1>

          <p
            className="landing-rise mt-6 max-w-[41rem] text-balance text-[1.05rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.15rem]"
            style={rise(0.15)}
          >
            {feature.subhead}
          </p>

          <div className="landing-rise mt-9 w-full max-w-[37rem]" style={rise(0.25)}>
            <UrlForm />
            <p className="mt-3.5 text-[0.82rem] text-[var(--ink-3)]">{CTA_REASSURANCE}</p>
          </div>
        </div>
      </div>

      {/* The facts band. Top hairline only: the showcase under it draws the line
          beneath. */}
      <div className={cn("landing-rise border-t", LINE)} style={rise(0.35)}>
        <div className={cn("mx-auto max-w-6xl border-x", LINE)}>
          <CellGrid className="grid-cols-2 md:grid-cols-4">
            {feature.specs.map((s) => (
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
  );
}

/* ---------- The feature, running ---------- */

/** The landing's showcase with this feature in the frame: its window on the painted
    sky, rising upright as it comes up the screen. */
export function FeatureShowcase({ feature, visuals }: { feature: Feature; visuals: FeatureVisuals }) {
  const { Window } = visuals;
  return (
    <section aria-label={`${feature.name}, running`}>
      <Band inner="overflow-hidden">
        <PaintedStage>
          <div aria-hidden>
            <Window />
          </div>
        </PaintedStage>
      </Band>
    </section>
  );
}

/* ---------- Why it matters ---------- */

function ProblemCard({
  fresh,
  feature,
  items,
}: {
  fresh: boolean;
  feature: Feature;
  items: string[];
}) {
  const Icon = fresh ? feature.icon : X;
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[28rem] rounded-xl border bg-white p-5 sm:p-6",
        fresh
          ? "border-[rgba(22,111,229,0.25)] shadow-[0_0_0_4px_rgba(22,111,229,0.07),0_12px_32px_-18px_rgba(16,24,40,0.22)]"
          : "border-[var(--hairline)] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-18px_rgba(16,24,40,0.18)]",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-9 place-items-center rounded-lg",
            fresh ? "bg-[var(--fb-strong)] text-white" : "bg-[#fdedf1] text-[#e11d48]",
          )}
        >
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="text-[1.05rem] font-medium tracking-tight text-foreground">
            {fresh ? "With Vantera" : "The old way"}
          </h3>
          <p className="text-[0.78rem] text-[var(--ink-3)]">
            {fresh ? `${feature.name}, on autopilot` : "Manual, slow, and easy to skip"}
          </p>
        </div>
      </div>
      <ul className={cn("mt-5 divide-y divide-[var(--hairline)] border-t", LINE)}>
        {items.map((item) => (
          <li
            key={item}
            className={cn(
              "flex gap-3 py-3 text-[0.9rem] leading-snug",
              fresh ? "text-foreground" : "text-[var(--ink-3)]",
            )}
          >
            {fresh ? (
              <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-[#e3f5ea] text-[#13824a]">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            ) : (
              <X className="mt-0.5 size-4 shrink-0 text-[#e11d48]/60" />
            )}
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeatureProblem({ feature }: { feature: Feature }) {
  const { problem } = feature;
  return (
    <section>
      <SectionHead
        icon={Target}
        eyebrow="Why it matters"
        title={<Two title={problem.title} />}
        subtitle={problem.body}
      />
      <Band inner="bg-[color-mix(in_oklab,var(--tint)_70%,white)]">
        <Reveal className="grid lg:grid-cols-2">
          <RevealItem className="flex items-center px-5 py-10 sm:px-10 sm:py-14">
            <ProblemCard fresh={false} feature={feature} items={problem.before} />
          </RevealItem>
          <RevealItem
            className={cn(
              "flex items-center border-t px-5 py-10 sm:px-10 sm:py-14 lg:border-l lg:border-t-0",
              LINE,
            )}
          >
            <ProblemCard fresh feature={feature} items={problem.after} />
          </RevealItem>
        </Reveal>
      </Band>
    </section>
  );
}

/* ---------- Inside the feature ---------- */

/* Each benefit's panel tint, from the landing's feature rows. */
const BENEFIT_STYLE = [
  { panel: "#eaf2fe", tile: "#dbe8fd", ink: "#1877f2" },
  { panel: "#f1eefd", tile: "#e3ddfb", ink: "#6d4fd8" },
  { panel: "#e9f6ee", tile: "#d6efdf", ink: "#13824a" },
] as const;

export function FeatureBenefits({ feature, visuals }: { feature: Feature; visuals: FeatureVisuals }) {
  return (
    <section>
      <SectionHead
        icon={Layers}
        eyebrow={`Inside ${feature.name}`}
        title={<Two title={feature.benefitsTitle} />}
        subtitle={feature.benefitsIntro}
      />
      {feature.benefits.map((b, i) => {
        const style = BENEFIT_STYLE[i % BENEFIT_STYLE.length];
        const Icon = visuals.benefitIcons[i];
        const Screen = visuals.benefits[i];
        return (
          <Band key={b.title}>
            <div className="group grid lg:grid-cols-[0.85fr_1fr]">
              <Reveal className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:py-12 lg:pl-14 lg:pr-10">
                <RevealItem>
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-8 place-items-center rounded-lg"
                      style={{ background: style.tile, color: style.ink }}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="text-[0.75rem] font-medium tabular-nums text-[var(--ink-3)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-5 text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-foreground sm:text-[1.85rem]">
                    {b.title}
                  </h3>
                  <p className="mt-3 max-w-sm text-[0.95rem] leading-relaxed text-[var(--ink-3)]">
                    {b.body}
                  </p>
                </RevealItem>
              </Reveal>
              {/* Flush to the right rail, with a hairline of white around it. */}
              <div className="px-3 pb-3 lg:py-3 lg:pl-0 lg:pr-3">
                <div
                  aria-hidden
                  className="relative h-[17rem] overflow-hidden sm:h-[18.5rem]"
                  style={{ background: style.panel }}
                >
                  <Screen />
                </div>
              </div>
            </div>
          </Band>
        );
      })}
    </section>
  );
}

/* ---------- How it works ---------- */

export function FeatureSteps({ feature, visuals }: { feature: Feature; visuals: FeatureVisuals }) {
  return (
    <section>
      <SectionHead icon={Workflow} eyebrow="How it works" title={<Two title={feature.stepsTitle} />} />
      <Band>
        <Reveal>
          <CellGrid className="lg:grid-cols-3">
            {feature.steps.map((s, i) => {
              const Picture = visuals.steps[i];
              const last = i === feature.steps.length - 1;
              return (
                <li key={s.title} className={cn(CELL, "relative")}>
                  <RevealItem
                    className="flex h-full flex-col p-6 sm:p-8"
                    style={{ transitionDelay: `${i * 0.06}s` }}
                  >
                    <span className="grid size-8 place-items-center rounded-lg bg-[var(--cyan-tint)] text-[0.85rem] font-semibold tabular-nums text-[var(--fb-strong)]">
                      {i + 1}
                    </span>
                    <h3 className="mt-5 text-[1.05rem] font-semibold tracking-tight text-foreground">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-3)]">{s.body}</p>
                    <div
                      aria-hidden
                      className="mt-6 flex-1 rounded-xl border border-[rgba(12,16,26,0.06)] bg-[color-mix(in_oklab,var(--tint)_70%,white)] p-3.5"
                    >
                      <Picture />
                    </div>
                  </RevealItem>
                  {/* A joint on the hairline between two steps. */}
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute -right-3 top-[2.6rem] z-10 hidden size-6 place-items-center rounded-full border border-[rgba(12,16,26,0.08)] bg-white text-[var(--ink-3)] shadow-[0_1px_2px_rgba(16,24,40,0.05)] lg:grid"
                    >
                      <ArrowRight className="size-3" />
                    </span>
                  )}
                </li>
              );
            })}
          </CellGrid>
        </Reveal>
      </Band>
      <Band inner="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <Link href="/signup" className={cn(PRIMARY_BUTTON, "group h-11 px-5")}>
          Start your free trial
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <p className="text-[0.82rem] text-[var(--ink-3)]">{CTA_REASSURANCE}</p>
      </Band>
    </section>
  );
}

/* ---------- One engine ---------- */

/** Every feature, in the order a prospect moves through them, with this page marked;
    the eighth cell leads to the full list. */
export function FeatureEngine({ feature }: { feature: Feature }) {
  return (
    <section>
      <SectionHead
        icon={Boxes}
        eyebrow="One engine"
        title={
          <>
            Better with <Accent>the whole engine</Accent>
          </>
        }
        subtitle={feature.connects}
      />
      <Band>
        <CellGrid className="sm:grid-cols-2 lg:grid-cols-4">
          {ENGINE_ORDER.map((slug, i) => {
            const f = getFeature(slug);
            if (!f) return null;
            const Icon = f.icon;
            const step = String(i + 1).padStart(2, "0");
            if (slug === feature.slug) {
              return (
                <li key={slug} className={CELL}>
                  <div
                    aria-current="page"
                    className="flex h-full flex-col bg-[color-mix(in_oklab,var(--fb-strong)_5%,white)] p-5 sm:p-6"
                  >
                    <div className="flex items-center justify-between">
                      <span className="grid size-8 place-items-center rounded-lg bg-[var(--fb-strong)] text-white">
                        <Icon className="size-4" />
                      </span>
                      <span className="rounded-md bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--fb-strong)]">
                        You&rsquo;re here
                      </span>
                    </div>
                    <p className="mt-5 text-[0.68rem] font-medium tabular-nums text-[var(--fb-strong)]">{step}</p>
                    <p className="mt-0.5 text-[0.92rem] font-semibold text-foreground">{f.name}</p>
                    <p className="mt-1 text-[0.8rem] leading-relaxed text-[var(--ink-3)]">{f.tagline}</p>
                  </div>
                </li>
              );
            }
            return (
              <li key={slug} className={CELL}>
                <Link
                  href={`/features/${slug}`}
                  className="group flex h-full flex-col p-5 transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--tint)_45%,white)] sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-8 place-items-center rounded-lg border border-[rgba(12,16,26,0.08)] bg-white text-foreground/70 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors group-hover:text-[var(--fb)]">
                      <Icon className="size-4" />
                    </span>
                    <ArrowUpRight className="size-4 text-[var(--ink-4)] transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--fb)]" />
                  </div>
                  <p className="mt-5 text-[0.68rem] font-medium tabular-nums text-[var(--ink-3)]">{step}</p>
                  <p className="mt-0.5 text-[0.92rem] font-semibold text-foreground">{f.name}</p>
                  <p className="mt-1 text-[0.8rem] leading-relaxed text-[var(--ink-3)]">{f.tagline}</p>
                </Link>
              </li>
            );
          })}
          <li className={CELL}>
            <Link
              href="/features"
              className="group flex h-full flex-col justify-between bg-[color-mix(in_oklab,var(--tint)_55%,white)] p-5 transition-colors duration-300 hover:bg-[var(--cyan-tint)] sm:p-6"
            >
              <span className="grid size-8 place-items-center rounded-lg border border-[rgba(12,16,26,0.08)] bg-white text-[var(--fb)] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <Boxes className="size-4" />
              </span>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[0.92rem] font-semibold text-[var(--fb-strong)]">
                Explore all features
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        </CellGrid>
      </Band>
    </section>
  );
}

/* ---------- Keep exploring ---------- */

/** The links from this page into the rest of its topic — the guide, the use case, the
    free tool — with glossary terms as a row of chips. Plain server-rendered links, so
    crawlers that never run JavaScript follow them too. */
export function FeatureExplore({ feature }: { feature: Feature }) {
  const { title, links, terms } = feature.explore;
  return (
    <section aria-labelledby="explore-title">
      <Band inner="px-6 py-10 sm:px-10 lg:px-12">
        <Pill icon={Compass}>Keep exploring</Pill>
        <h2
          id="explore-title"
          className="mt-4 text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-foreground sm:text-[1.9rem]"
        >
          {title}
        </h2>
      </Band>
      <Band>
        <CellGrid className="sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <li key={l.href} className={CELL}>
              <Link
                href={l.href}
                className="group flex h-full flex-col px-6 py-6 transition-colors duration-300 hover:bg-[color-mix(in_oklab,var(--tint)_45%,white)] sm:px-7"
              >
                <span className="flex items-center justify-between text-[0.78rem] text-[var(--ink-3)]">
                  {l.kind}
                  <ArrowUpRight className="size-3.5 transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--fb)]" />
                </span>
                <span className="mt-2.5 text-[1rem] font-semibold leading-snug tracking-tight text-foreground">
                  {l.title}
                </span>
                <span className="mt-1.5 text-[0.86rem] leading-relaxed text-[var(--ink-3)]">{l.desc}</span>
              </Link>
            </li>
          ))}
        </CellGrid>
      </Band>
      {terms.length > 0 && (
        <Band inner="flex flex-wrap items-center gap-2 px-6 py-4 sm:px-10 lg:px-12">
          <span className="mr-1 text-[0.85rem] font-semibold text-foreground">Key terms</span>
          {terms.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-lg border border-[rgba(12,16,26,0.08)] bg-white px-3 py-1.5 text-[0.8rem] text-[var(--ink-2)] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-[rgba(24,119,242,0.35)] hover:text-[var(--fb-strong)]"
            >
              {t.label}
            </Link>
          ))}
        </Band>
      )}
    </section>
  );
}

/* ---------- Closing ---------- */

/** The landing's closing band, retold for the feature: blue inside the rails, the white
    mark dithered behind, the feature's icon, one button, and its window rising from the
    band's foot. #1468da rather than brand blue so the white body text passes AA. */
export function FeatureCta({ feature, visuals }: { feature: Feature; visuals: FeatureVisuals }) {
  const Icon = feature.icon;
  const { Peek } = visuals;
  return (
    <section aria-labelledby="feature-cta-title">
      <Band inner="overflow-hidden bg-[#1468da]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.16] [mask-image:radial-gradient(ellipse_70%_80%_at_50%_45%,#000_40%,transparent_100%)]"
        >
          <MarkDither className="text-white" />
        </div>

        <Reveal className="relative px-5 pt-16 text-center sm:px-8 sm:pt-20">
          <RevealItem>
            <span className="mx-auto mb-6 grid size-11 place-items-center rounded-xl bg-white text-[var(--fb)] shadow-[0_1px_2px_rgba(4,24,72,0.2),0_8px_24px_-12px_rgba(4,24,72,0.5)]">
              <Icon className="size-5" strokeWidth={2.4} />
            </span>
            <h2
              id="feature-cta-title"
              className="mx-auto max-w-2xl text-balance text-[2rem] font-medium leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.75rem]"
            >
              {feature.ctaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-[1rem] leading-relaxed text-white sm:text-[1.05rem]">
              {feature.ctaBody}
            </p>
            <Link
              href="/signup"
              className="group mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-[0.95rem] font-semibold text-[var(--fb-strong)] shadow-[0_1px_2px_rgba(4,24,72,0.2),0_8px_24px_-12px_rgba(4,24,72,0.5)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-white/95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              Get Started Free
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <p className="mt-3 text-[0.82rem] text-white">{CTA_REASSURANCE}</p>
          </RevealItem>

          {/* The window rises from the band's foot and is cut off by it. */}
          <RevealItem className="mx-auto mt-12 h-[11.5rem] max-w-xl overflow-hidden sm:mt-14 sm:h-[12.5rem]">
            <div aria-hidden>
              <Peek />
            </div>
          </RevealItem>
        </Reveal>
      </Band>
    </section>
  );
}
