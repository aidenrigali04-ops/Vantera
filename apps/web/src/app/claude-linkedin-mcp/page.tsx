import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Radar,
  PenLine,
  CheckCheck,
  Inbox,
  Plug,
  Terminal,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { Reveal, RevealItem, CARD, CARD_INTERACTIVE } from "@/components/landing/surface";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Claude LinkedIn MCP — Run LinkedIn Outreach From Claude | Vantera",
  description:
    "Connect Vantera's MCP server to Claude and run your LinkedIn outreach from a prompt: prospect in-market buyers, draft messages in your voice, and book meetings — every send waits for your approval.",
  alternates: { canonical: "/claude-linkedin-mcp" },
  keywords: [
    "Claude LinkedIn MCP",
    "LinkedIn outreach from Claude",
    "MCP server LinkedIn automation",
    "Claude MCP prospecting",
    "Vantera MCP",
  ],
};

/* ── "What MCP unlocks" cards ─────────────────────────────────────────────── */
const UNLOCKS = [
  {
    icon: Radar,
    label: "Prospect",
    title: "Prospect from a prompt",
    body: "Ask Claude for in-market buyers that fit your ICP. Vantera sources, scores, and returns a qualified shortlist — no dashboards, no manual filters.",
  },
  {
    icon: PenLine,
    label: "Draft",
    title: "Draft in your voice",
    body: "Claude writes each message from the prospect's real activity and your positioning, then hands it to Vantera as a ready-to-review draft.",
  },
  {
    icon: CheckCheck,
    label: "Approve",
    title: "Approve, then send",
    body: "Nothing leaves your account without a yes. Approve a draft in chat and Vantera sends it on LinkedIn at a safe, human-like pace.",
  },
  {
    icon: Inbox,
    label: "Track",
    title: "See every reply",
    body: "Replies flow back into the thread. Ask Claude what came in, who's warm, and what to book — the full conversation stays visible.",
  },
] as const;

/* ── "Set it up in 3 steps" ──────────────────────────────────────────────── */
const STEPS = [
  {
    n: "01",
    icon: Plug,
    title: "Connect Vantera + LinkedIn",
    body: "Create your Vantera account and connect your LinkedIn through our guided, secure sign-in. This is the account Claude will act through.",
  },
  {
    n: "02",
    icon: Terminal,
    title: "Add the MCP server to Claude",
    body: "Paste Vantera's MCP endpoint and your key into Claude's connector settings. Claude discovers the prospecting, drafting, and sending tools automatically.",
  },
  {
    n: "03",
    icon: Sparkles,
    title: "Prompt Claude to run outreach",
    body: "Describe who you want and what you're offering. Claude calls Vantera's tools, returns drafts for review, and books meetings once you approve.",
  },
] as const;

/* ── "Why Claude + Vantera" value points ─────────────────────────────────── */
const WHY = [
  {
    icon: Zap,
    title: "Your whole motion, one prompt",
    body: "Sourcing, qualifying, drafting, sending, and reply-tracking run behind a single conversation. No context-switching between tools.",
  },
  {
    icon: ShieldCheck,
    title: "Approval and safety by design",
    body: "Every send waits for your yes, and human-like pacing plus hard limits are enforced in Vantera — never something the prompt can override.",
  },
  {
    icon: PenLine,
    title: "Personal, not spray",
    body: "Claude drafts from each prospect's real activity, so messages read like you wrote them — and only qualified, in-market people ever enter the queue.",
  },
] as const;

export default function ClaudeLinkedinMcpPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Claude LinkedIn MCP", url: `${SITE_URL}/claude-linkedin-mcp` },
          ]),
        ]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Claude + MCP"
          title={
            <>
              Run your LinkedIn outreach <span className="text-[var(--cyan-strong)]">from Claude</span>
            </>
          }
          subtitle="Connect Vantera's MCP server and Claude can prospect, draft, and book on LinkedIn for you — sourcing in-market buyers and writing each message in your voice, with your approval on every send."
        />

        <div className="mx-auto mt-9 flex max-w-2xl flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-strong)] px-6 py-3 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1461d1] hover:shadow-[0_10px_30px_-8px_rgba(24,119,242,0.7)] active:scale-[0.98]"
          >
            Start free
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#setup"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-6 py-3 text-[15px] font-medium text-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[rgba(12,16,26,0.16)]"
          >
            Read the docs
          </a>
        </div>

        <p className="mx-auto mt-5 max-w-2xl text-center text-[13px] text-[var(--ink-4)]">
          Works with Claude&rsquo;s Model Context Protocol · Free 3-day trial
        </p>
      </section>

      {/* ── What MCP unlocks ─────────────────────────────────────────────── */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[1.85rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[2.15rem]">
              What the MCP server unlocks
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--ink-3)] sm:text-[17px]">
              Four tools, one conversation. Claude drives your outreach end to end while you stay in control.
            </p>
          </div>

          <Reveal className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {UNLOCKS.map((u) => (
              <RevealItem key={u.title} className={cn(CARD_INTERACTIVE, "group flex flex-col p-6")}>
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(24, 119, 242,0.2)] transition-transform duration-300 group-hover:scale-105">
                    <u.icon className="size-5" />
                  </span>
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--ink-4)]">
                    {u.label}
                  </span>
                </div>
                <h3 className="mt-5 text-[1.1rem] font-semibold tracking-[-0.01em] text-foreground">
                  {u.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{u.body}</p>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Set it up in 3 steps ─────────────────────────────────────────── */}
      <section
        id="setup"
        className="relative scroll-mt-24 border-y border-[var(--hairline)] bg-[var(--tint)] py-16 sm:py-20"
      >
        {/* faint cyan wash, top-center */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72"
          style={{ background: "radial-gradient(50% 100% at 50% 0%, rgba(24, 119, 242,0.08), transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[1.85rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[2.15rem]">
              Set it up in 3 steps
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--ink-3)] sm:text-[17px]">
              A few minutes to connect. Then it&rsquo;s all a conversation with Claude.
            </p>
          </div>

          <div className="mt-14 grid items-start gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
            {/* numbered steps */}
            <Reveal className="flex flex-col gap-5">
              {STEPS.map((s) => (
                <RevealItem key={s.n} className={cn(CARD, "group flex gap-4 p-6")}>
                  <span className="grid size-11 flex-none place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(24, 119, 242,0.2)]">
                    <s.icon className="size-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[12px] font-semibold tracking-[0.14em] text-[var(--ink-4)]">
                        {s.n}
                      </span>
                      <h3 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                        {s.title}
                      </h3>
                    </div>
                    <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{s.body}</p>
                  </div>
                </RevealItem>
              ))}
            </Reveal>

            {/* prompt + MCP tool-call mockup */}
            <div className="lg:sticky lg:top-28">
              <PromptMock />
            </div>
          </div>
        </div>
      </section>

      {/* ── Why Claude + Vantera ─────────────────────────────────────────── */}
      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[1.85rem] font-semibold tracking-[-0.02em] text-foreground sm:text-[2.15rem]">
              Why Claude + Vantera
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed text-[var(--ink-3)] sm:text-[17px]">
              Claude is the interface. Vantera is the engine — qualification, personalization, safety, and
              sending — so a prompt turns into real, booked pipeline.
            </p>
          </div>

          <Reveal className="mt-14 grid gap-5 sm:grid-cols-3">
            {WHY.map((w) => (
              <RevealItem
                key={w.title}
                className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                  <w.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-[1.1rem] font-semibold tracking-[-0.01em] text-foreground">
                  {w.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{w.body}</p>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Closing CTA band ─────────────────────────────────────────────── */}
      <section className="relative border-t border-[var(--hairline)] bg-[var(--tint)] py-20 sm:py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72"
          style={{ background: "radial-gradient(50% 100% at 50% 0%, rgba(24, 119, 242,0.08), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-2xl px-6 text-center lg:px-8">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] bg-white px-3 py-1 text-[12.5px] font-medium text-[var(--ink-2)] shadow-[var(--shadow-sm)]">
            <span className="size-1.5 rounded-full bg-[var(--cyan)] shadow-[0_0_8px_rgba(24, 119, 242,0.8)]" />
            Claude + MCP
          </span>
          <h2 className="mt-5 text-[2rem] font-semibold leading-[1.08] tracking-[-0.02em] text-foreground sm:text-[2.5rem]">
            Run LinkedIn outreach from your next prompt.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-[var(--ink-3)] sm:text-[17.5px]">
            Connect Vantera to Claude and let a conversation do the prospecting, drafting, and booking — with
            your approval on every send.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fb-strong)] px-7 py-3.5 text-[15px] font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-[#1461d1] hover:shadow-[0_10px_30px_-8px_rgba(24,119,242,0.7)] active:scale-[0.98]"
            >
              Start free
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#setup"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-white px-7 py-3.5 text-[15px] font-medium text-foreground shadow-[var(--shadow-sm)] transition-all hover:-translate-y-0.5 hover:border-[rgba(12,16,26,0.16)]"
            >
              Read the docs
            </a>
          </div>
          <p className="mt-5 text-[13px] text-[var(--ink-4)]">
            Free 3-day trial · Live in minutes · Cancel anytime
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Prompt + MCP tool-call mockup — the contract's light-card recipe, monochrome
   + cyan. Decorative (aria-hidden). No real vendor internals.
──────────────────────────────────────────────────────────────────────────── */
const CARD_INNER = "rounded-[12px] border border-[#E6EAEE] bg-white";

function PromptMock() {
  return (
    <div className={cn(CARD, "overflow-hidden p-4 sm:p-5")} aria-hidden>
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-[var(--hairline)] pb-3">
        <span className="size-2.5 rounded-full bg-[#E6EAEE]" />
        <span className="size-2.5 rounded-full bg-[#E6EAEE]" />
        <span className="size-2.5 rounded-full bg-[#E6EAEE]" />
        <span className="ml-2 flex items-center gap-1.5 text-[11px] font-medium text-[var(--ink-4)]">
          <Sparkles className="size-3 text-[var(--cyan-strong)]" />
          Claude · Vantera MCP
        </span>
      </div>

      {/* user prompt */}
      <div className="mt-4">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">You</span>
        <div className="mt-1.5 rounded-[10px] bg-[#F4F6F8] px-3.5 py-3 text-[13px] leading-relaxed text-[#3A444D]">
          Find 25 in-market RevOps leaders at Series A–C SaaS companies and draft a first message for each.
        </div>
      </div>

      {/* tool call */}
      <div className="mt-4">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
          Tool call
        </span>
        <div className={cn(CARD_INNER, "mt-1.5 p-3")}>
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-[6px] bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
              <Radar className="size-3.5" />
            </span>
            <span className="font-mono text-[11.5px] font-semibold text-[#0F172A]">
              vantera.prospect
            </span>
            <span className="ml-auto flex items-center gap-1 rounded-full bg-[var(--cyan-tint)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.08em] text-[var(--cyan-strong)]">
              <span className="size-1 rounded-full bg-[var(--cyan)] shadow-[0_0_6px_rgba(24, 119, 242,0.9)]" />
              Running
            </span>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-[8px] bg-[#0d1017] px-3 py-2.5 font-mono text-[10.5px] leading-relaxed text-[#c7d0da]">
            <code>{`{
  "icp": "RevOps · Series A–C SaaS",
  "count": 25,
  "min_fit": 80
}`}</code>
          </pre>
        </div>
      </div>

      {/* tool response */}
      <div className="mt-3">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-[var(--ink-4)]">
          Response
        </span>
        <div className={cn(CARD_INNER, "mt-1.5 p-3")}>
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold text-[#0F172A]">25 qualified · 25 drafts ready</span>
            <span className="flex items-center gap-1 rounded-full bg-[#eafaf0] px-2 py-[3px] text-[8.5px] font-bold uppercase tracking-[0.08em] text-[#1a9e4b]">
              <CheckCheck className="size-2.5" strokeWidth={2.6} />
              Awaiting approval
            </span>
          </div>

          {/* mini drafted-lead rows */}
          <div className="mt-2.5 space-y-1.5">
            {[
              { initials: "DM", name: "Dana Meyer", role: "VP RevOps · Northwind", fit: "94" },
              { initials: "JR", name: "Jordan Ruiz", role: "Head of Ops · Halcyon", fit: "88" },
            ].map((l) => (
              <div
                key={l.initials}
                className="flex items-center gap-2.5 rounded-[9px] bg-[#F4F6F8] px-2.5 py-2"
              >
                <span className="grid size-7 flex-none place-items-center rounded-full bg-gradient-to-br from-[#e2e8f0] to-[#cbd5e1] text-[9px] font-bold text-[#475569]">
                  {l.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold leading-tight text-[#0F172A]">{l.name}</p>
                  <p className="truncate text-[9px] leading-tight text-[#64748B]">{l.role}</p>
                </div>
                <span className="flex-none rounded-full bg-[var(--cyan-tint)] px-2 py-[3px] text-[9px] font-bold tabular-nums text-[var(--cyan-strong)]">
                  {l.fit} fit
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-[10.5px] text-[var(--ink-4)]">
        You review the drafts, then approve to send on LinkedIn.
      </p>
    </div>
  );
}
