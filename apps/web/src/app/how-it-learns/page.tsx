import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Library,
  Repeat,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";

export const metadata: Metadata = {
  title: "How It Learns — Vantera",
  description:
    "No magic, no black box. Here's exactly how Vantera figures out what works for your buyers on LinkedIn — and gets smarter every week.",
  alternates: { canonical: "/how-it-learns" },
};

const INTRO_PARAS = [
  "Most outreach tools never change. The day you set them up is the best they'll ever be — the messages you wrote, the targeting you guessed, frozen until you come back and rewrite them yourself.",
  "Vantera works the other way around. It starts from what's already proven, tests small improvements on real conversations, keeps what wins, and drops what doesn't. Every week, the floor rises.",
  "There's no magic in that — just a system that measures its own work and refuses to keep doing what isn't working. Here's the whole loop, in plain English.",
];

const LOOP_STEPS = [
  {
    icon: Library,
    step: "01",
    title: "It starts with what's proven",
    body: "No blank page, no guessing. From the first message, your outreach runs plays that already work — proven on our own real outbound and grounded in research on what buyers in your industry actually respond to.",
  },
  {
    icon: FlaskConical,
    step: "02",
    title: "It tries small, careful improvements",
    body: "A different opening line. A sharper reason to reach out. Each new version runs on a small slice of new conversations — and nothing goes live without passing the same quality and safety checks as everything else.",
  },
  {
    icon: Trophy,
    step: "03",
    title: "It keeps winners, drops losers",
    body: "Every version is judged on real outcomes — connections accepted, replies that show interest, meetings booked. Not opinions, not vibes. What wins earns more of your outreach; what loses is retired.",
  },
  {
    icon: CheckCircle2,
    step: "04",
    title: "It remembers what works for your buyers",
    body: "Wins aren't thrown away. What worked for buyers like yours gets remembered and reused, so every new conversation starts from the best of everything that came before it.",
  },
  {
    icon: Repeat,
    step: "05",
    title: "It repeats — every week",
    body: "The loop never stops. Each cycle, your outreach is a little smarter than the last — better openers, better targeting, better timing. That's the compounding other tools can't do: they only change when you change them.",
  },
];

const NEVER_LIST = [
  {
    title: "It never sends anything unchecked",
    body: "Every message — including every new idea it wants to try — passes hard quality and safety checks before a single prospect sees it. Fail the check, never sent.",
  },
  {
    title: "It never invents claims about your business",
    body: "It only uses facts you've given it. If it doesn't have a real number or a real result to share, it says so — it will not make one up.",
  },
  {
    title: "It never pushes past LinkedIn-safe limits",
    body: "Human-like pacing and hard weekly ceilings are built into the sender itself — not a setting the system (or you) can push past. Your account is protected by design.",
  },
  {
    title: "It never keeps a change that hurts",
    body: "If a new version ever performs worse, it's rolled back automatically. The system is built so results can only ratchet up — never quietly slide down.",
  },
];

const CONTROL_POINTS = [
  "You can approve every message before it sends — review mode is the default.",
  "You can see what it's testing right now, and why, on your dashboard.",
  "You can change your targeting, your facts, and your goals anytime in Settings.",
];

export default function HowItLearnsPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="How it works"
          title="How your outreach gets smarter every week"
          subtitle="No magic, no black box. Here's exactly how Vantera figures out what works for your buyers — in plain English."
        />
      </section>

      <section className="px-6 pb-14 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
          {INTRO_PARAS.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

      {/* The loop */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground">
            The loop
          </h2>
          <div className="mt-10 space-y-4">
            {LOOP_STEPS.map((s) => (
              <div
                key={s.step}
                className="flex gap-5 rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <div className="flex flex-col items-center gap-2">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-[11px] font-semibold tracking-[0.14em] text-[var(--ink-3)]/70">
                    {s.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-[1.1rem] font-semibold tracking-[-0.01em] text-foreground">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What it will never do */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
              The hard lines
            </span>
            <h2 className="mt-3 text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground">
              What it will never do
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--ink-3)]">
              A system that improves itself needs rules it can&apos;t break. These aren&apos;t
              settings — they&apos;re built into how it works, and the system can&apos;t change
              them.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {NEVER_LIST.map((n) => (
              <div
                key={n.title}
                className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                  <ShieldCheck className="size-5" />
                </span>
                <h3 className="mt-4 text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                  {n.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* You stay in control */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--hairline)] bg-white p-8 shadow-[var(--shadow-sm)]">
          <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
            It improves itself. You stay in charge.
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-3)]">
            The system decides what to test and what to keep. You decide what goes out under your
            name.
          </p>
          <ul className="mt-5 space-y-3">
            {CONTROL_POINTS.map((c) => (
              <li key={c} className="flex items-start gap-3 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
                <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-[var(--cyan-strong)]" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Honesty note */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
            Where the proof comes from
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.75] text-[var(--ink-3)]">
            Every result the system acts on is a real outcome from real outreach — never an
            invented number. We run Vantera on our own outbound and hold it to the same bar: if we
            can&apos;t prove a claim, we don&apos;t make it. That&apos;s the standard across this
            whole site, and inside the product.
          </p>
        </div>
      </section>

      {/* Cross-links + CTA */}
      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-3xl gap-5 sm:grid-cols-2">
          <Link
            href="/proven-plays"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              See what it starts with
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              The proven plays your outreach runs from day one — no blank page, no cold start.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              Proven plays <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/why-vantera"
            className="group rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)] transition-colors hover:border-[var(--cyan-strong)]/40"
          >
            <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              How this compares
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              Why a system that learns beats a sequencer that waits for instructions.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              Why Vantera <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
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
