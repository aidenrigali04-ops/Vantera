import Link from "next/link";
import { ArrowRight, Check, Users, X } from "lucide-react";
import { Reveal, RevealItem } from "./surface";
import { Accent, Band, CELL, CellGrid, PRIMARY_BUTTON, SectionHead } from "./frame";
import { CTA_HREF, CTA_LABEL, CTA_REASSURANCE } from "./claims";
import { cn } from "@/lib/utils";

/**
 * Built for — "Is this for someone like me?" Fit AND anti-fit: saying who Vantera is
 * NOT for is the cheapest trust on the page (almost absent in the category). The
 * anti-fit rows are true product boundaries: volume shops (hard ceilings), no clear
 * buyer yet (targeting learns from a customer profile), email-first teams
 * (LinkedIn-only by design). Two hairline cells typeset like rankbox.xyz's capability
 * cells — title, a muted line, then the rows as small bordered cards — over the page's
 * first primary CTA.
 */

const GOOD_FIT = [
  { role: "Solo founders", line: "You are the SDR. Now it runs on autopilot." },
  { role: "Small B2B teams", line: "One or two people selling a high-ticket product or service." },
  {
    role: "Agencies & consultants",
    line: "Your LinkedIn reputation is the asset, so every send stays inside hard safety limits.",
  },
];

const NOT_FIT = [
  {
    role: "Volume shops",
    line: "A thousand invites a week? The ceilings will frustrate you.",
  },
  {
    role: "No clear buyer yet",
    line: "No customer profile to start from? Targeting needs a buyer to learn from.",
  },
  {
    role: "Email-first teams",
    line: "LinkedIn-only by design. No cold email.",
  },
];

const COLUMNS = [
  {
    head: "Good fit",
    body: "Small teams whose pipeline lives on LinkedIn.",
    items: GOOD_FIT,
    icon: Check,
    fit: true,
  },
  {
    head: "Not a fit",
    body: "Real limits of the product, so nobody starts a trial for the wrong thing.",
    items: NOT_FIT,
    icon: X,
    fit: false,
  },
] as const;

/* rankbox's mini-UI row: a small white card ruled in a hairline. */
const ROW =
  "flex items-start gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]";

export function BuiltFor() {
  return (
    <section>
      <SectionHead
        id="built-for"
        icon={Users}
        eyebrow="Who it’s for"
        title={
          <>
            Built for people who <Accent>sell what they build</Accent>
          </>
        }
        subtitle="And honestly not for everyone — here's both sides."
      />

      <Band>
        <Reveal>
          <CellGrid className="sm:grid-cols-2">
            {COLUMNS.map((col, i) => (
              <li key={col.head} className={CELL}>
                {/* Only the content rises in, so the hairlines never move; the inline
                    delay restores the stagger the nth-child rule gives direct
                    children. */}
                <RevealItem
                  className="flex h-full flex-col p-6 sm:p-8"
                  style={{ transitionDelay: `${i * 0.06}s` }}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "grid size-7 shrink-0 place-items-center rounded-md",
                        col.fit ? "bg-[#d5efdf] text-[#13824a]" : "bg-[#eef0f3] text-[var(--ink-4)]",
                      )}
                    >
                      <col.icon className="size-3.5" strokeWidth={2.4} aria-hidden />
                    </span>
                    <h3 className="text-[1.05rem] font-semibold tracking-tight text-foreground">
                      {col.head}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-3)]">{col.body}</p>

                  <ul className="mt-6 flex flex-1 flex-col gap-2">
                    {col.items.map((it) => (
                      <li key={it.role} className={ROW}>
                        <span
                          aria-hidden
                          className={cn(
                            "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                            col.fit ? "bg-[#e3f5ea] text-[#13824a]" : "bg-[#f1f2f4] text-[var(--ink-4)]",
                          )}
                        >
                          <col.icon className="size-2.5" strokeWidth={3} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[0.85rem] font-semibold text-foreground">
                            {it.role}
                          </span>
                          <span className="mt-0.5 block text-[0.8rem] leading-relaxed text-[var(--ink-3)]">
                            {it.line}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </RevealItem>
              </li>
            ))}
          </CellGrid>
        </Reveal>
      </Band>

      {/* CTA #1 */}
      <Band inner="flex flex-col items-center gap-3.5 px-6 py-10 text-center sm:py-12">
        <Link href={CTA_HREF} className={cn(PRIMARY_BUTTON, "group")}>
          {CTA_LABEL}
          <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
        <p className="text-[0.82rem] text-[var(--ink-3)]">{CTA_REASSURANCE}</p>
      </Band>
    </section>
  );
}
