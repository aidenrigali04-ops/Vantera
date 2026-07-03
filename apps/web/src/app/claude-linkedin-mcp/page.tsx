import type { Metadata } from "next";
import { Bot, MessageSquare, Search } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { PrimaryCta, SecondaryCta } from "@/components/landing/cta";

export const metadata: Metadata = {
  title: "Claude & MCP — Vantera",
  description:
    "Drive Vantera from Claude over the Model Context Protocol: ask about your pipeline, review drafted outreach, and check on your agents without opening the dashboard. Early access.",
  alternates: { canonical: "/claude-linkedin-mcp" },
};

/** What driving Vantera from Claude looks like — capability framing, no fake install docs. */
const USES = [
  {
    icon: Search,
    title: "Ask about your pipeline",
    body: "“Who replied this week?” “Which in-market leads cleared the bar today?” — answered from your own workspace data.",
  },
  {
    icon: MessageSquare,
    title: "Review drafts in the conversation",
    body: "Pull up what your Outreach agent has queued and give direction — the approve-before-send contract stays intact.",
  },
  {
    icon: Bot,
    title: "Check on your agents",
    body: "Run status, pacing headroom, and what's scheduled next — without switching to the dashboard.",
  },
];

export default function ClaudeMcpPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Claude & MCP"
          title="Drive Vantera from Claude"
          subtitle="Connect your workspace to Claude over the Model Context Protocol and work your LinkedIn pipeline in plain conversation."
        />
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-3">
          {USES.map((u) => (
            <div
              key={u.title}
              className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                <u.icon className="size-5" />
              </span>
              <h2 className="mt-4 text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">{u.title}</h2>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">{u.body}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-14 flex max-w-2xl flex-col items-center gap-4 text-center">
          <p className="text-[15px] leading-relaxed text-[var(--ink-3)]">
            The MCP connection is in early access — we&apos;re onboarding workspaces one at a time.
            Tell us you want in and we&apos;ll set you up.
          </p>
          <PrimaryCta href="mailto:sales@vanterasystem.com?subject=Claude%20%2B%20MCP%20early%20access" size="lg">
            Request early access
          </PrimaryCta>
          <p className="mt-2 text-[14px] text-[var(--ink-3)]">New to Vantera?</p>
          <SecondaryCta href="/signup">Start free</SecondaryCta>
        </div>
      </section>
    </MarketingShell>
  );
}
