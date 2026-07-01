"use client";

import { Database, Bell, CalendarClock, Webhook, Terminal } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { cn } from "@/lib/utils";

/** LinkedIn brand glyph — lucide dropped brand icons, so we render it inline. */
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

const TILES = [
  { icon: LinkedinMark, name: "LinkedIn", status: "Connected" as const },
  { icon: Database, name: "CRM sync", status: "Live" as const },
  { icon: Bell, name: "Slack alerts", status: "Soon" as const },
  { icon: CalendarClock, name: "Calendar booking", status: "Soon" as const },
  { icon: Webhook, name: "Webhooks & API", status: "Soon" as const },
  { icon: Terminal, name: "MCP access", status: "Soon" as const },
];

const STATUS_STYLES: Record<string, string> = {
  Connected: "bg-[#eafaf0] text-[#1a9e4b]",
  Live: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)]",
  Soon: "bg-[#f1f2f4] text-[var(--ink-4)]",
};

export function Integrations() {
  return (
    <section id="integrations" className="relative py-24 sm:py-28">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Integrations"
          title="Connect the tools you already run"
          subtitle="Closed deals push straight into your CRM today — and more connections are on the way so Vantera fits the stack you already use."
        />

        <Reveal className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {TILES.map((t) => (
            <RevealItem key={t.name} className={cn(CARD_INTERACTIVE, "flex items-center gap-3 p-4")}>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[rgba(11, 87, 171,0.2)]">
                <t.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-foreground">{t.name}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${STATUS_STYLES[t.status]}`}>
                  {t.status}
                </span>
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
