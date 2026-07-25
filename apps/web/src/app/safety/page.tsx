import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Gauge,
  Hand,
  KeyRound,
  PauseCircle,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";

export const metadata: Metadata = {
  title: "Account Safety — Vantera",
  description:
    "Your LinkedIn account is the asset. See how Vantera protects it — human-like pacing, hard limits you can't override, a system that stops before it risks you.",
  alternates: { canonical: "/safety" },
};

const INTRO_PARAS = [
  "Your LinkedIn account is the most valuable thing in this whole equation — years of connections, reputation, and reach that no tool is worth losing. So before anything else, Vantera is built around one rule: nothing it does may put your account at risk.",
  "Most tools treat safety as a settings page — sliders you can push too far on a bad day. We treat it as architecture: the limits live inside the sender itself, they're set below LinkedIn's danger zone, and nothing — not you on an ambitious morning, not the system chasing a better result — can push past them.",
  "Here's the full picture of how that works.",
];

const PROTECTIONS = [
  {
    icon: Gauge,
    title: "Human-like pacing, always",
    body: "Messages go out at a human rhythm — spread through the day, randomized timing, never in bursts. Volume stays under a hard weekly ceiling (about 100 invites a week), which is deliberately below where accounts start getting flagged.",
  },
  {
    icon: ShieldCheck,
    title: "Limits you can't push past",
    body: "The safety thresholds aren't settings. They're built into the sending system itself and can't be configured below safe levels — by you, or by anything the system learns. New accounts ramp up gradually instead of starting at full speed.",
  },
  {
    icon: KeyRound,
    title: "We never see your password",
    body: "You connect by signing in on a secure hosted login page — your credentials never touch our systems. Disconnect anytime in Settings, and the connection is gone.",
  },
  {
    icon: Hand,
    title: "You approve every send",
    body: "Review mode is the default: every message waits for your approval before it goes out. Even in automatic mode, anything flagged by quality checks routes back to you instead of sending.",
  },
  {
    icon: PauseCircle,
    title: "It stops itself before it risks you",
    body: "If your LinkedIn connection drops, sending parks instantly — nothing queues up and fires blind. You get an alert, and nothing moves again until the connection is healthy. There's also a global pause switch: one click stops all sending.",
  },
  {
    icon: Undo2,
    title: "People who say no stay contacted-never-again",
    body: "A \"not interested\" reply writes that person to your suppression list automatically and permanently. No follow-up sequence, no accidental re-contact, ever.",
  },
];

const LEARNING_LINES = [
  "Every new message idea passes the same quality and safety checks as everything else — before a single prospect sees it.",
  "Improvements are tested on small slices at a human pace, never by sending more.",
  "If a change ever performs worse, it's rolled back automatically.",
  "The safety limits sit outside the learning system — it cannot touch them.",
];

export default function SafetyPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Account safety"
          title="Your account is the asset. We built around that."
          subtitle="Human-like pacing, hard limits that can't be pushed past, and a system that stops itself before it ever risks you."
        />
      </section>

      <section className="px-6 pb-14 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
          {INTRO_PARAS.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

      {/* The protections */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROTECTIONS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                <p.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                {p.title}
              </h2>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety and the learning system */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--hairline)] bg-white p-8 shadow-[var(--shadow-sm)]">
          <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
            Improvement with hard lines
          </span>
          <h2 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
            A system that improves itself needs rules it can&apos;t break
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-3)]">
            Vantera{" "}
            <Link
              href="/how-it-learns"
              className="font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline"
            >
              tests and improves its own outreach
            </Link>
            . Safety is the boundary that learning happens inside — never a variable it gets to
            experiment with:
          </p>
          <ul className="mt-5 space-y-3">
            {LEARNING_LINES.map((l) => (
              <li
                key={l}
                className="flex items-start gap-3 text-[14.5px] leading-relaxed text-[var(--ink-3)]"
              >
                <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-[var(--cyan-strong)]" />
                {l}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Cross-links + CTA */}
      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          <Link
            href="/how-it-learns"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              How the learning works
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              The full loop in plain English — and the checks every new idea has to pass.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              How it learns{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/how-we-prove-it"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              How we prove it
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              Our standard for every claim on this site — real numbers or nothing.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              How we prove it{" "}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <div className="mx-auto mt-14 max-w-2xl text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#0a0c12] px-5 py-2.5 text-[14px] font-medium text-white transition-all hover:shadow-[0_8px_24px_-8px_rgba(11,87,171,0.6)]"
          >
            Start free
            <ArrowRight className="size-4" />
          </Link>
          <p className="mt-3 text-[13px] text-[var(--ink-3)]">
            No credit card required · You approve every message
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
