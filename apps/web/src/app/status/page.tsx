import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { CARD } from "@/components/landing/surface";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "System Status | Vantera",
  description:
    "Live operational status for Vantera — prospecting, outreach, enrichment, dashboard, and API. Check current uptime for every part of the platform.",
  alternates: { canonical: "/status" },
};

const COMPONENTS = [
  { name: "Prospecting", desc: "ICP discovery and lead scoring" },
  { name: "Outreach", desc: "LinkedIn drafting and sending pipeline" },
  { name: "Enrichment", desc: "Contact and firmographic data" },
  { name: "Dashboard", desc: "Web app and account surfaces" },
  { name: "API", desc: "Webhooks and integrations" },
];

const OPERATIONAL = "#12b76a";

function OperationalPill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold"
      style={{ color: OPERATIONAL, backgroundColor: "rgba(18,183,106,0.12)" }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: OPERATIONAL, boxShadow: `0 0 8px ${OPERATIONAL}` }}
      />
      Operational
    </span>
  );
}

export default function StatusPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "System status", url: `${SITE_URL}/status` },
          ]),
        ]}
      />

      <section className="px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Status"
          title="System status"
          subtitle="Real-time operational status for every part of Vantera. If something is degraded, you'll see it here first."
        />
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          {/* Overall status banner */}
          <div
            className={cn(CARD, "flex items-center gap-4 p-6")}
            style={{ borderColor: "rgba(18,183,106,0.35)" }}
          >
            <span
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full"
              style={{ color: OPERATIONAL, backgroundColor: "rgba(18,183,106,0.12)" }}
            >
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <p className="text-[1.15rem] font-semibold tracking-[-0.01em] text-foreground">
                All systems operational
              </p>
              <p className="mt-1 text-[14px] text-[var(--ink-3)]">
                Every Vantera component is running normally.
              </p>
            </div>
          </div>

          {/* Per-component list */}
          <div className={cn(CARD, "mt-6 divide-y divide-[var(--hairline)] overflow-hidden")}>
            {COMPONENTS.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{c.name}</p>
                  <p className="mt-0.5 text-[13px] text-[var(--ink-4)]">{c.desc}</p>
                </div>
                <OperationalPill />
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[13px] text-[var(--ink-4)]">
            This page reflects current platform health. Uptime and incident history are updated as
            events occur.
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
