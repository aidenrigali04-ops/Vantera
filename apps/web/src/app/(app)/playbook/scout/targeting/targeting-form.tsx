"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { TargetingRules } from "@vantera/agent-brains";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateScoutTargeting, type AgentActionState } from "../../actions";

const LISTS: { name: "competitors" | "customers" | "companies" | "keywords"; label: string; hint: string }[] = [
  { name: "competitors", label: "Competitors", hint: "One company per line. Their people are never contacted." },
  { name: "customers", label: "Existing customers", hint: "One company or website (acme.com) per line." },
  { name: "companies", label: "Other companies to skip", hint: "One company per line." },
  { name: "keywords", label: "Keywords to skip", hint: "Matched in job titles, companies, and industries. One per line or comma-separated." },
];

/** Plain functional form (owner restyles later). */
export function TargetingForm({ initial }: { initial: TargetingRules }) {
  const [state, action, pending] = useActionState<AgentActionState, FormData>(updateScoutTargeting, {});

  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Targeting rules</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Who your agents should skip, and who to favor. Applies to every new prospect, from search and from LinkedIn
        intent alike.
      </p>

      <form action={action} className="mt-8 space-y-8">
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Always skip</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="excludeAgencies" defaultChecked={initial.excludeAgencies} />
            Agencies and consultants
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="excludeFreelancers" defaultChecked={initial.excludeFreelancers} />
            Freelancers and self-employed
          </label>
        </fieldset>

        {LISTS.map((l) => (
          <div key={l.name} className="space-y-2">
            <Label htmlFor={l.name}>{l.label}</Label>
            <Textarea id={l.name} name={l.name} rows={3} defaultValue={initial[l.name].join("\n")} />
            <p className="text-xs text-muted-foreground">{l.hint}</p>
          </div>
        ))}

        <div className="space-y-2">
          <Label htmlFor="guidance">Who to prioritize or avoid</Label>
          <Textarea
            id="guidance"
            name="guidance"
            rows={3}
            maxLength={500}
            placeholder="e.g. Prioritize founders at B2B SaaS companies; avoid anyone in education."
            defaultValue={initial.guidance ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            In your own words. Your agent weighs this when scoring — it never lowers the quality bar.
          </p>
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save rules"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/playbook">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
