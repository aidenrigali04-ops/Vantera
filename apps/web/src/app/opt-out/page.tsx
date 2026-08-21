import type { Metadata } from "next";
import { Mail, ShieldOff, Ban } from "lucide-react";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { CARD, Reveal, RevealItem } from "@/components/landing/surface";
import { JsonLd, breadcrumbLd, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Opt Out & Data Removal | Vantera",
  description:
    "Request removal from Vantera outreach. Once you opt out, your details are added to a permanent suppression list and honored across every campaign, everywhere.",
  alternates: { canonical: "/opt-out" },
};

const INTRO_PARAS = [
  "If you have received outreach powered by Vantera and no longer wish to be contacted, you can opt out at any time. We take removal requests seriously — outreach is only worthwhile when it reaches people who want to hear from it.",
  "Vantera sends on behalf of its customers, and every account maintains a suppression list: a permanent, write-only record of people who should never be contacted again. Opting out adds you to it. The check runs before every message, on every channel, so a suppressed contact is skipped by design — not by anyone remembering to.",
];

const POINTS = [
  {
    icon: ShieldOff,
    title: "Suppression is permanent",
    body: "Once you are on the suppression list, entries never expire. There is no re-verification window and no way for a later campaign to reach you again.",
  },
  {
    icon: Ban,
    title: "Honored across all campaigns",
    body: "Your request applies to the entire account that contacted you — not just the message you replied to. Every current and future campaign respects it.",
  },
  {
    icon: Mail,
    title: "GDPR erasure on request",
    body: "Beyond suppression, you can request full erasure of the personal data held about you. We delete it and pass the request to any data provider holding it on our behalf.",
  },
];

export default function OptOutPage() {
  return (
    <MarketingShell>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", url: SITE_URL },
            { name: "Opt out & data removal", url: `${SITE_URL}/opt-out` },
          ]),
        ]}
      />

      <section className="px-6 pt-36 pb-12 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Privacy"
          title="Opt out & data removal"
          subtitle="Stop receiving outreach and remove your data from our systems. Requests are honored permanently, across every campaign."
        />
      </section>

      <section className="relative py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-6 lg:px-8">
          <div className="space-y-5 text-[17px] leading-[1.78] text-[var(--ink-3)]">
            {INTRO_PARAS.map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>

          <Reveal className="mt-14 grid gap-5 sm:grid-cols-3">
            {POINTS.map((p) => (
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

          <div className={cn(CARD, "mt-8 p-8")}>
            <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-foreground">
              How to request removal
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--ink-3)]">
              Email us from the address or profile that was contacted and we will add you to the
              suppression list and confirm. If you would also like your personal data erased, say so
              in the message and we will process the erasure and instruct our data providers to do
              the same.
            </p>
            <a
              href="mailto:privacy@vanterasystem.com?subject=Opt%20out%20%2F%20data%20removal"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--fb)] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_10px_30px_-10px_rgba(24,119,242,0.7)] transition-all hover:bg-[var(--fb-strong)] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(24,119,242,0.75)] active:scale-[0.98]"
            >
              <Mail className="size-4" />
              privacy@vanterasystem.com
            </a>
            <p className="mt-4 text-[13px] text-[var(--ink-4)]">
              Removal requests are honored permanently and across every campaign on the account.
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
