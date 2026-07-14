import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  MessageSquareText,
  Quote,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";

export const metadata: Metadata = {
  title: "Proven Plays — Vantera",
  description:
    "Vantera doesn't start from a blank page. From the first message, your outreach runs plays that already work — and gets smarter from there.",
  alternates: { canonical: "/proven-plays" },
};

const INTRO_PARAS = [
  "Every other outreach tool starts you at zero: a blank message editor, a targeting form, and good luck. Whatever you type on day one is what gets sent — and if it doesn't work, that's on you.",
  "Vantera starts you somewhere very different: with plays that already work. A play is a complete, proven way to run a conversation — who to reach out to, what to lead with, what proof to share, and how to ask. When you sign up, your outreach is matched to the plays that fit your buyers, and it runs those from the very first message.",
  "So the first message you send isn't a guess. It's the best starting point we can honestly give you — and it only gets smarter from there.",
];

const PLAY_ANATOMY = [
  {
    icon: Users,
    title: "Who to reach",
    body: "The exact kind of person the play works on — role, company type, and the moment that makes them worth reaching right now.",
  },
  {
    icon: MessageSquareText,
    title: "What to lead with",
    body: "The opening angle — the one thing in the first sentence that makes them keep reading instead of archiving.",
  },
  {
    icon: Quote,
    title: "What proof to share",
    body: "The real, verifiable fact that answers \"why should I believe you?\" — pulled only from facts you've approved.",
  },
  {
    icon: Target,
    title: "How to ask",
    body: "The close — sized to the conversation. A soft question for a cold start, a concrete next step once they're warm.",
  },
];

const EXAMPLE_PLAYS = [
  {
    name: "The peer opener",
    body: "Lead with a company like theirs — not with you. People pay attention to what their peers are doing long before they care what a stranger is selling.",
  },
  {
    name: "The problem-first note",
    body: "Name the exact problem they're living, in one plain sentence, with no pitch attached. Being understood earns more replies than being sold to.",
  },
  {
    name: "The soft ask",
    body: "End the first message with a low-pressure question instead of a calendar link. An easy \"yes\" starts more conversations than a big one.",
  },
];

export default function ProvenPlaysPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Day one"
          title="Good from the first message"
          subtitle="Vantera doesn't start from a blank page. It starts from plays that already work — matched to your buyers, ready the moment you sign up."
        />
      </section>

      <section className="px-6 pb-14 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
          {INTRO_PARAS.map((t, i) => (
            <p key={i}>{t}</p>
          ))}
        </div>
      </section>

      {/* What's in a play */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground">
            What&apos;s inside a play
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] leading-relaxed text-[var(--ink-3)]">
            Not a template — a complete way of running a conversation. Four decisions, made well,
            before a single word is written.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {PLAY_ANATOMY.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Example plays */}
      <section className="px-6 pb-8 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="block text-[12.5px] font-semibold uppercase tracking-[0.18em] text-[var(--cyan-strong)]">
              Examples
            </span>
            <h2 className="mt-3 text-[1.6rem] font-semibold tracking-[-0.02em] text-foreground">
              What plays look like
            </h2>
          </div>
          <div className="mt-10 space-y-4">
            {EXAMPLE_PLAYS.map((p) => (
              <div
                key={p.name}
                className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                  {p.name}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Honesty label */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--hairline)] bg-[var(--cyan-tint)]/40 p-6">
          <p className="text-[14px] leading-[1.75] text-[var(--ink-3)]">
            <span className="font-semibold text-foreground">Where these come from, honestly: </span>
            our starting plays are proven on our own real LinkedIn outbound — the same numbers we
            publish on our homepage — and grounded in research on what buyers actually respond to.
            As more real conversations run through Vantera, the plays keep getting smarter. We
            don&apos;t claim results we haven&apos;t earned, and we never show you an invented
            number.
          </p>
        </div>
      </section>

      {/* Why starting proven matters */}
      <section className="px-6 pb-20 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[var(--hairline)] bg-white p-8 shadow-[var(--shadow-sm)]">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
            <TrendingUp className="size-5" />
          </span>
          <h2 className="mt-4 text-[1.35rem] font-semibold tracking-[-0.02em] text-foreground">
            Why starting proven matters
          </h2>
          <p className="mt-3 text-[15px] leading-[1.75] text-[var(--ink-3)]">
            The first two weeks decide whether outreach works at all. Start from a blank page and
            you spend those weeks burning your best prospects on guesses. Start from proven plays
            and your learning begins from a high floor — every test the system runs is an
            improvement on something that already works, not a shot in the dark.
          </p>
          <p className="mt-3 text-[15px] leading-[1.75] text-[var(--ink-3)]">
            That&apos;s the quiet advantage: you never pay the beginner&apos;s tax. And from day
            one, the loop takes over —{" "}
            <Link
              href="/how-it-learns"
              className="font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline"
            >
              testing, keeping winners, and getting smarter every week
            </Link>
            .
          </p>
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
              How it gets smarter
            </h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              The full loop — how plays are tested, measured, and improved every week.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-[14px] font-medium text-[var(--cyan-strong)]">
              How it learns <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
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
              What a blank-page sequencer costs you — and what a system that learns gives back.
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
            No credit card required · Your plays are matched at signup
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
