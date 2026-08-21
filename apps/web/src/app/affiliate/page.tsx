import type { Metadata } from "next";
import { ArrowRight, Repeat, LineChart, Handshake } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { CARD, Reveal, RevealItem } from "@/components/landing/surface";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Affiliate Program | Vantera",
  description:
    "Earn recurring commission every month for teams you refer to Vantera. Real-time tracking, reliable payouts, and a product that keeps customers subscribed.",
  alternates: { canonical: "/affiliate" },
};

const INTRO_PARAS = [
  "Know a team that lives on LinkedIn? Send them to Vantera and get paid every month they stay. Our affiliate program rewards the people who introduce Vantera to the sellers, agencies, and founders who need it.",
  "You share a link. When a team you referred subscribes, you earn a recurring share of their plan for as long as they remain a customer — not a one-time bounty. Because the product is built to keep customers, referrals compound instead of churning.",
];

const PERKS = [
  {
    icon: Repeat,
    title: "Recurring commission",
    body: "Earn a percentage of every referred subscription, every month it renews — not a single upfront payout.",
  },
  {
    icon: LineChart,
    title: "Transparent tracking",
    body: "See clicks, signups, and active referrals in a real-time dashboard. Attribution is clear and payouts are on a predictable schedule.",
  },
  {
    icon: Handshake,
    title: "Built to retain",
    body: "Vantera keeps customers because it delivers meetings. Referrals that stick mean commission that keeps arriving.",
  },
];

export default function AffiliatePage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Affiliate program", url: `${SITE_URL}/affiliate` },
          ]),
        ]}
      />

      <section className="px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Partners"
          title="Refer teams. Earn every month."
          subtitle="The Vantera affiliate program pays recurring commission for every team you bring on — for as long as they stay a customer."
        />
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
            {INTRO_PARAS.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>

          <Reveal className="mt-14 grid gap-5 sm:grid-cols-3">
            {PERKS.map((p) => (
              <RevealItem key={p.title} className={cn(CARD, "p-6")}>
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)]">
                  <p.icon className="size-5" />
                </span>
                <h2 className="mt-4 text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
                  {p.title}
                </h2>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--ink-3)]">{p.body}</p>
              </RevealItem>
            ))}
          </Reveal>

          <div className="mx-auto mt-14 max-w-2xl text-center">
            <a
              href="#"
              className="group inline-flex items-center gap-2 rounded-full bg-[var(--fb)] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(24,119,242,0.7)] transition-all hover:bg-[var(--fb-strong)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(24,119,242,0.75)] active:scale-[0.98]"
            >
              Join the program
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <p className="mt-4 text-[13px] font-medium text-[var(--ink-4)]">
              Free to join · Recurring payouts · No cap on referrals
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
