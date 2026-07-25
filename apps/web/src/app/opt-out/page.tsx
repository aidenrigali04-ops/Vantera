import type { Metadata } from "next";
import { MarketingShell } from "@/components/landing/marketing-shell";
import { MarketingHeader } from "@/components/landing/marketing-header";
import { PrimaryCta } from "@/components/landing/cta";

export const metadata: Metadata = {
  title: "Opt Out — Vantera",
  description:
    "Got a LinkedIn message sent through Vantera and don't want to hear from that sender again? Opt out here — it's permanent and honored before every send.",
  alternates: { canonical: "/opt-out" },
};

/**
 * Public opt-out page for prospects contacted by a Vantera customer. Grounded in the
 * platform's actual compliance behavior: "not interested" replies are suppressed
 * automatically, manual requests go to the suppression list, entries never expire,
 * and the list is checked before every send (see privacy policy + suppression design).
 */
export default function OptOutPage() {
  return (
    <MarketingShell>
      <section className="px-6 pt-36 pb-10 sm:pt-40 lg:px-8">
        <MarketingHeader
          eyebrow="Opt out"
          title="Don't want to be contacted?"
          subtitle="Vantera sends LinkedIn messages on behalf of the businesses that use it. If you'd rather not hear from a sender again, here's how to stop it — permanently."
        />
      </section>

      <section className="px-6 pb-24 sm:pb-28 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-5">
          <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              The fastest way: just reply
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              Reply to the message with something like &ldquo;not interested&rdquo;. That response is
              recognized automatically and adds you to that sender&apos;s suppression list, so their
              outreach to you stops. Suppression entries never expire and are checked before every send.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--hairline)] bg-white p-6 shadow-[var(--shadow-sm)]">
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              Or ask us directly
            </h2>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--ink-3)]">
              Email us with your LinkedIn profile URL (and, if you have it, the name of the business
              that contacted you). We&apos;ll add you to the relevant suppression list and — on request —
              erase the prospect data held about you, in line with our privacy policy and GDPR.
            </p>
            <div className="mt-5">
              <PrimaryCta href="mailto:privacy@vanterasystem.com?subject=Opt-out%20request">
                Email an opt-out request
              </PrimaryCta>
            </div>
          </div>

          <p className="pt-2 text-center text-[13px] text-[var(--ink-4)]">
            More detail on how prospect data is handled is in our{" "}
            <a href="/privacy" className="font-medium text-[var(--cyan-strong)] underline-offset-4 hover:underline">
              privacy policy
            </a>
            .
          </p>
        </div>
      </section>
    </MarketingShell>
  );
}
