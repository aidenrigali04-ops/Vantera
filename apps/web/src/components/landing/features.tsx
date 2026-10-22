import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { BrainCircuit, Layers, MessagesSquare, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Band, SectionHead, type Icon, type TONES } from "./frame";
import { FeatureRow } from "./feature-row";
import { TargetingScreen } from "./targeting";
import { FitScoreScreen } from "./evidence-scoring";
import { RepliesScreen } from "./replies";
import { SafetyScreen } from "./safety";

/**
 * The product story, after rankbox.xyz's "Everything you need" block: one header band,
 * a feature row each for targeting that learns, fit scores with their math, the reply
 * inbox, and account safety (each row's screen lives in its own file), then the long
 * tail of features rolling past as chips. The row ids are the nav's and footer's
 * anchors (#targeting, #evidence, #replies, #safety).
 */

const FEATURES: {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: Icon;
  tone: keyof typeof TONES;
  screen: ReactNode;
}[] = [
  {
    id: "targeting",
    title: "Targeting that learns",
    body: "Machine learning studies who replies and who books, then sharpens your targeting every week. No rules to tune.",
    href: "/features/machine-learned-targeting",
    icon: BrainCircuit,
    tone: "blue",
    screen: <TargetingScreen />,
  },
  {
    id: "evidence",
    title: "Fit scores with receipts",
    body: "Every score shows its math: a fit gate on title, industry, and headcount, plus the signals that lifted it. Only 70+ enters outreach.",
    href: "/features/fit-scoring",
    icon: ScanSearch,
    tone: "green",
    screen: <FitScoreScreen />,
  },
  {
    id: "replies",
    title: "One inbox for every reply",
    body: "Replies come back classified, warm ones first, and the agent answers on autopilot. “Not interested” goes straight to your suppression list.",
    href: "/features/unified-inbox",
    icon: MessagesSquare,
    tone: "violet",
    screen: <RepliesScreen />,
  },
  {
    id: "safety",
    title: "Built to keep your account safe",
    body: "Your login never touches Vantera. Sends stay inside a hard weekly ceiling at a human pace, and a security check pauses everything.",
    href: "/features/account-safety",
    icon: ShieldCheck,
    tone: "amber",
    screen: <SafetyScreen />,
  },
];

const TAGS = [
  "Machine-learned targeting",
  "Autopilot sending",
  "Suppression list",
  "Warmup ramp",
  "Human pacing",
  "Signal-based openers",
  "ICP scoring",
  "Written rationale",
  "Reply classification",
  "CRM push",
  "Claude & MCP",
  "Team seats",
  "Unified inbox",
  "Auto-pause on checks",
  "Daily or weekly runs",
  "Up to 3 ICPs",
  "Your own content",
  "In-app copilot",
  "Opt-out handling",
];

/* Tags with a page of their own link to it; the rest stay labels. */
const TAG_LINKS: Record<string, string> = {
  "Machine-learned targeting": "/features/machine-learned-targeting",
  "Autopilot sending": "/features/autopilot-outreach",
  "Signal-based openers": "/features/autopilot-outreach",
  "ICP scoring": "/features/fit-scoring",
  "Human pacing": "/features/account-safety",
  "Unified inbox": "/features/unified-inbox",
  "CRM push": "/features/crm-sync",
  "Claude & MCP": "/claude-linkedin-mcp",
  "Opt-out handling": "/opt-out",
};

/* The long tail of features, rolling past in two rows that drift in opposite
   directions (`landing-marquee` in globals.css). Hovering a row holds it; with reduced
   motion the rows sit still and scroll sideways. The track holds the tags twice so the
   loop is seamless; the second copy is hidden from screen readers and the tab order. */
function TagRow({ tags, reverse = false }: { tags: string[]; reverse?: boolean }) {
  const chip = (t: string, copy: boolean) => {
    const cls =
      "inline-flex shrink-0 items-center gap-2 rounded-lg border border-[rgba(12,16,26,0.08)] bg-white px-3 py-2 text-[0.8rem] font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
    const inner = (
      <>
        <Sparkles className="size-3.5 text-[var(--fb)]" />
        {t}
      </>
    );
    return TAG_LINKS[t] ? (
      <Link
        key={`${t}-${copy}`}
        href={TAG_LINKS[t]}
        tabIndex={copy ? -1 : undefined}
        className={cn(
          cls,
          "underline decoration-[rgba(12,16,26,0.15)] underline-offset-2 transition-colors hover:border-[rgba(24,119,242,0.4)] hover:text-[var(--fb)]",
        )}
      >
        {inner}
      </Link>
    ) : (
      <span key={`${t}-${copy}`} className={cls}>
        {inner}
      </span>
    );
  };
  return (
    <div className="overflow-hidden motion-reduce:overflow-x-auto">
      <div
        data-reverse={reverse ? "" : undefined}
        className="landing-marquee flex w-max py-1"
        style={{ "--marquee-s": "55s" } as CSSProperties}
      >
        {/* Spacing inside each copy, so half the track is exactly one copy. */}
        <div className="flex gap-2.5 pr-2.5">{tags.map((t) => chip(t, false))}</div>
        <div aria-hidden className="flex gap-2.5 pr-2.5 motion-reduce:hidden">
          {tags.map((t) => chip(t, true))}
        </div>
      </div>
    </div>
  );
}

export function Features() {
  const half = Math.ceil(TAGS.length / 2);
  return (
    <section id="features" className="scroll-mt-16">
      <SectionHead
        icon={Layers}
        eyebrow="One agent, end to end"
        title={
          <>
            Everything an SDR does, <Accent>on autopilot</Accent>
          </>
        }
        subtitle="Prospecting, scoring, writing, and replies, run by agents that learn what works with every conversation."
      />

      {FEATURES.map((f) => (
        <FeatureRow key={f.id} {...f} />
      ))}

      <Band inner="py-10 sm:py-12">
        <p className="mb-6 px-5 text-center text-sm font-medium text-[var(--ink-3)]">
          Plus everything else you need to run LinkedIn outbound
        </p>
        <div className="space-y-2.5 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)]">
          <TagRow tags={TAGS.slice(0, half)} />
          <TagRow tags={[...TAGS.slice(half), "+ much more"]} reverse />
        </div>
      </Band>
    </section>
  );
}
