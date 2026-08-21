import type { UseCaseSummary } from "./types";

/**
 * The use-case catalog — the single source for the hub grid, the sibling cross-links, and
 * (as they ship) nav/footer/sitemap entries. `live` gates whether a card links out or reads
 * "Coming soon"; flip it to true when a persona page ships.
 */
export const USE_CASES: UseCaseSummary[] = [
  {
    slug: "for-sales-teams",
    persona: "Sales teams",
    title: "LinkedIn automation for sales teams",
    blurb:
      "Give every rep an AI SDR that finds in-market buyers, qualifies them, and books meetings — safely, on your approval.",
    icon: "users",
    metric: { value: "3×", label: "more selling time" },
    live: true,
  },
  {
    slug: "for-founders",
    persona: "Founders",
    title: "LinkedIn automation for founders",
    blurb:
      "Pipeline while you build. Founder-led outbound that qualifies every prospect before it ever sends a message.",
    icon: "rocket",
    metric: { value: "Week 1", label: "first replies" },
    live: true,
  },
  {
    slug: "for-agencies",
    persona: "Agencies",
    title: "LinkedIn automation for agencies",
    blurb:
      "Run safe, quality-first outbound for every client from one place — seats, senders, and reporting built in.",
    icon: "layers",
    metric: { value: "1", label: "login, every client" },
    live: true,
  },
  {
    slug: "for-recruiters",
    persona: "Recruiters",
    title: "LinkedIn automation for recruiters",
    blurb:
      "Source and reach qualified candidates on LinkedIn with personal outreach, safe pacing, and human approval.",
    icon: "search",
    metric: { value: "0", label: "account risk" },
    live: true,
  },
];

export function useCaseBySlug(slug: string): UseCaseSummary | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}
