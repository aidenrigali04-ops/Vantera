import type { CSSProperties, ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accent, Band, CELL, CellGrid, SectionHead } from "./frame";
import { Reveal, RevealItem } from "./surface";
import {
  HubSpotLogo,
  IntuitLogo,
  NaverLogo,
  OktaLogo,
  ScribdLogo,
  ZendeskLogo,
} from "./brand-logos";

/**
 * The trial promise, after rankbox.xyz's guarantee band: a shield tile, the promise,
 * then the teams' marks as a row of hairline cells, like Rankaria's engine strip. The
 * marks rest in one calm grey like a press strip and take their own colour on hover;
 * heights are balanced per mark rather than set to one size. Where rankbox closes on a
 * rating, this closes on a quiet line: Vantera publishes no rating.
 */
const LOGOS: { name: string; color: string; node: ReactNode }[] = [
  { name: "HubSpot", color: "#ff5c35", node: <HubSpotLogo className="h-6 w-auto" /> },
  { name: "Intuit", color: "#236cff", node: <IntuitLogo className="h-[17px] w-auto" /> },
  { name: "NAVER", color: "#03c75a", node: <NaverLogo className="text-[20px]" /> },
  { name: "Okta", color: "#0a0c12", node: <OktaLogo className="h-[23px] w-auto" /> },
  { name: "Scribd", color: "#0a0c12", node: <ScribdLogo className="h-5 w-auto" /> },
  { name: "Zendesk", color: "#0a0c12", node: <ZendeskLogo className="h-[17px] w-auto" /> },
];

export function Guarantee() {
  return (
    <section>
      <SectionHead
        icon={ShieldCheck}
        title={
          <>
            Try it with <Accent>zero risk</Accent>
          </>
        }
        subtitle="Start with a free 7-day trial. No contracts, no surprises, and you can cancel anytime."
      />

      <Band>
        <Reveal>
          <CellGrid className="grid-cols-3 lg:grid-cols-6">
            {LOGOS.map((l, i) => (
              <li key={l.name} className={cn(CELL, "flex items-center justify-center py-8 sm:py-10")}>
                {/* Only the mark rises in; the cell's hairlines stay put. The inline
                    delay staggers marks the nth-child rule can't reach. */}
                <RevealItem style={{ transitionDelay: `${i * 0.05}s` }}>
                  <span
                    style={{ "--logo": l.color } as CSSProperties}
                    className="flex items-center text-[#8e96a1] transition-[color,transform] duration-300 hover:-translate-y-0.5 hover:text-[var(--logo)]"
                  >
                    {l.node}
                  </span>
                </RevealItem>
              </li>
            ))}
          </CellGrid>
        </Reveal>
      </Band>

      <Band inner="flex flex-col items-center gap-2 px-5 py-8 text-center">
        <p className="text-balance text-sm text-[var(--ink-3)]">Powering revenue for modern teams</p>
      </Band>
    </section>
  );
}
