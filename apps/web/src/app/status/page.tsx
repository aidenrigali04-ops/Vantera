import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { SecondaryCta } from "@/components/landing/cta";

export const metadata: Metadata = {
  title: "System Status — Vantera",
  description:
    "Current operational status of the Vantera platform. Incidents and maintenance windows are posted here.",
  alternates: { canonical: "/status" },
  robots: { index: false },
};

/** The one surface pillar users actually feel; keep it to what we can state honestly. */
const SERVICES = ["Web app & dashboard", "Agent runs & outreach scheduling", "Reply capture & CRM sync"];

export default function StatusPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="System status"
          title="Platform status"
          subtitle="Incidents and maintenance windows are posted on this page as they happen."
        />
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <p className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
              <span className="size-2.5 rounded-full bg-[#1a9e4b]" aria-hidden />
              No incidents currently reported
            </p>
            <ul className="mt-5 flex flex-col gap-3 border-t border-[var(--hairline)] pt-5">
              {SERVICES.map((s) => (
                <li key={s} className="flex items-center justify-between gap-4 text-[14px]">
                  <span className="text-[var(--ink-2)]">{s}</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eafaf0] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#1a9e4b]">
                    <span className="size-1.5 rounded-full bg-[#1a9e4b]" />
                    Operational
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-[14px] text-[var(--ink-3)]">
              Seeing something that doesn&apos;t look right? Tell us and we&apos;ll look immediately.
            </p>
            <SecondaryCta href="mailto:support@vanterasystem.com?subject=Vantera%20status">
              Report an issue
            </SecondaryCta>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
