"use client";

import { LeadFitControls } from "@/components/lead-fit-controls";
import type { FitVerdict } from "@/lib/learning/fit";
import { Section } from "./section";

/**
 * Fit: the owner's Good fit / Not a fit verdict. `ask` > 0 means the footer's "Not a fit"
 * asked for a reason — the section remounts (keyed by `ask`) focused with the reason open.
 */
export function FitSection({ leadId, verdict, reason, ask }: { leadId: string; verdict: FitVerdict | null; reason: string | null; ask: number }) {
  return (
    <Section key={`fit-${ask}`} id="fit" title="Fit" focus={ask > 0}>
      <LeadFitControls key={leadId} leadId={leadId} verdict={verdict} reason={reason} askReason={ask > 0} />
    </Section>
  );
}
