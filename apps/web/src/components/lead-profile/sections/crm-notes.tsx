"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LeadCrmControls } from "@/components/lead-crm-controls";
import { Section } from "./section";

/** CRM: push / status controls for the lead. */
export function CrmSection({ leadId, status }: { leadId: string; status: string }) {
  return (
    <Section id="crm" title="CRM">
      <LeadCrmControls leadId={leadId} status={status} />
    </Section>
  );
}

/** Notes need server data the row doesn't carry — the peek stays fetch-free and links through. */
export function NotesSection({ fullProfileHref }: { fullProfileHref: string }) {
  return (
    <Section id="notes" title="Notes" defaultOpen={false}>
      <Link href={`${fullProfileHref}#notes`} className="inline-flex items-center gap-1 text-sm underline underline-offset-2">
        Read and add notes in the full brief <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </Section>
  );
}
