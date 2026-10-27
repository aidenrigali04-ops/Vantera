"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LeadProfile } from "../types";
import { Field } from "./fields";
import { Section } from "./section";

/** Company: firmographics, tech stack, and the LinkedIn profile link. */
export function CompanySection({
  lead,
}: {
  lead: Pick<LeadProfile, "company_name" | "company_size" | "industry" | "location" | "tech_stack" | "linkedin_url">;
}) {
  return (
    <Section id="company" title="Company">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Company">{lead.company_name ?? "—"}</Field>
        <Field label="Headcount">{lead.company_size ?? "—"}</Field>
        <Field label="Industry">{lead.industry ?? "—"}</Field>
        <Field label="Location">{lead.location ?? "—"}</Field>
      </div>
      {lead.tech_stack && lead.tech_stack.length > 0 && (
        <div className="mt-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tech stack</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lead.tech_stack.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {/* LinkedIn-only platform: the prospect's profile link is the contact surface —
          email/phone stay internal (CRM-push dedupe data), never product UI. */}
      {lead.linkedin_url && (
        <a
          href={lead.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center gap-1 text-sm underline underline-offset-2"
        >
          LinkedIn profile <ExternalLink className="size-3" />
        </a>
      )}
    </Section>
  );
}
