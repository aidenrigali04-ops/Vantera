import "server-only";
import { pickWhyNow, type DraftInput, type StoredInsights } from "@vantera/agent-brains";
import type { createClient } from "@/lib/supabase/server";

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The first-touch copy brain's grounding from RLS-scoped reads — the web-side twin of the jobs
 * pipeline's `toDraftInput` (copy-draft.ts) fed by getCopyContext/getDraftableLeads. Used by the
 * Approvals/peek "Regenerate" so a redraft is grounded exactly like the original.
 *
 * Deliberately NO bookingUrl: the first touch is link-free by rule; the link belongs to the
 * conversation stage. Manual re-roll: mirrors the pipeline's first-touch grounding (lead, insights,
 * account positioning, CTA, website); the pipeline's strategy/exemplar/avoid steering is
 * intentionally not replayed here. Null when the lead isn't visible/has no insights, or no live Outreach agent.
 */
export async function buildFirstTouchDraftInput(
  supabase: SessionClient,
  leadId: string
): Promise<DraftInput | null> {
  const [{ data: lead }, { data: agent }, { data: account }, { data: signals }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, last_name, title, company_name, industry, ai_insights")
      .eq("id", leadId)
      .maybeSingle<{
        id: string;
        first_name: string | null;
        last_name: string | null;
        title: string | null;
        company_name: string | null;
        industry: string | null;
        ai_insights: StoredInsights | null;
      }>(),
    supabase
      .from("agents")
      .select("config")
      .eq("kind", "copy")
      .eq("status", "live")
      .limit(1)
      .maybeSingle<{ config: { cta?: string; websiteUrl?: string | null } | null }>(),
    supabase
      .from("accounts")
      .select("name, onboarding_industry, value_prop, brand_voice, guardrails, website_scan")
      .limit(1)
      .maybeSingle<{
        name: string | null;
        onboarding_industry: string | null;
        value_prop: string | null;
        brand_voice: string | null;
        guardrails: string | null;
        website_scan: { summary?: string } | null;
      }>(),
    supabase
      .from("lead_signals")
      .select("kind, label, detail, observed_at")
      .eq("lead_id", leadId)
      .returns<{ kind: string; label: string | null; detail: string | null; observed_at: string | null }[]>(),
  ]);
  if (!lead?.ai_insights || !agent) return null;

  return {
    lead: {
      firstName: lead.first_name,
      lastName: lead.last_name,
      title: lead.title,
      companyName: lead.company_name,
      industry: lead.industry,
      whyNow: pickWhyNow(
        (signals ?? []).map((s) => ({ kind: s.kind, label: s.label, detail: s.detail, observedAt: s.observed_at })),
        new Date()
      ),
    },
    insights: lead.ai_insights,
    context: {
      cta: agent.config?.cta ?? "a quick look",
      websiteUrl: agent.config?.websiteUrl ?? null,
      accountName: account?.name ?? null,
      accountIndustry: account?.onboarding_industry ?? null,
      valueProp: account?.value_prop ?? account?.website_scan?.summary ?? null,
      brandVoice: account?.brand_voice ?? null,
      guardrails: account?.guardrails ?? null,
    },
  };
}
