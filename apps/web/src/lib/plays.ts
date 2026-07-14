import { matchStarterPlays, SOURCE_LABEL } from "@vantera/agent-brains";

/**
 * Starter plays as UI surfaces render them (Stage 0, spec 2026-07-14) — serializable cards with
 * the honest source label baked in. Always computed SERVER-side (server components / server
 * actions) and passed down as data, so the brains package never enters a client bundle.
 */
export type PlayCard = { slug: string; name: string; description: string; sourceLabel: string };

export function playCards(input: { industry?: string | null; icp?: string | null }): PlayCard[] {
  return matchStarterPlays(input).map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    sourceLabel: SOURCE_LABEL[p.source],
  }));
}
