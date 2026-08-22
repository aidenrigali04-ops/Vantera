/**
 * Command-palette destinations and the ranking filter. Pure: the palette component maps each
 * `key` to a lucide glyph; nothing here touches React or the DOM.
 */
export type PaletteKey =
  | "today"
  | "approvals"
  | "inbox"
  | "prospects"
  | "playbook"
  | "meetings"
  | "analytics"
  | "pipeline"
  | "settings"
  | "senders"
  | "billing"
  | "team"
  | "integrations"
  | "suppression";

export type PaletteDestination = {
  key: PaletteKey;
  label: string;
  href: string;
  /** Synonyms a person might type — matched after the label and the path. */
  keywords: readonly string[];
};

export const PALETTE_DESTINATIONS: readonly PaletteDestination[] = [
  { key: "today", label: "Today", href: "/today", keywords: ["home", "dashboard", "engine"] },
  { key: "approvals", label: "Approvals", href: "/approvals", keywords: ["review", "queue", "drafts", "approve"] },
  { key: "inbox", label: "Inbox", href: "/inbox", keywords: ["replies", "conversations", "messages"] },
  { key: "prospects", label: "Prospects", href: "/prospects", keywords: ["leads", "people", "contacts"] },
  { key: "playbook", label: "Playbook", href: "/playbook", keywords: ["agents", "icp", "strategy", "targeting"] },
  { key: "meetings", label: "Meetings", href: "/meetings", keywords: ["calendar", "booked", "calls"] },
  { key: "analytics", label: "Analytics", href: "/dashboard?view=analytics", keywords: ["results", "stats", "reports", "numbers"] },
  { key: "pipeline", label: "Pipeline", href: "/dashboard?view=pipeline", keywords: ["deals", "stages", "kanban", "closed"] },
  { key: "settings", label: "Settings", href: "/settings", keywords: ["preferences", "workspace", "account", "profile"] },
  { key: "senders", label: "Senders", href: "/settings/senders", keywords: ["linkedin", "accounts", "channels", "connect"] },
  { key: "billing", label: "Billing", href: "/settings/billing", keywords: ["plan", "subscription", "invoices", "payment"] },
  { key: "team", label: "Team", href: "/settings/team", keywords: ["members", "seats", "invite", "people"] },
  { key: "integrations", label: "Integrations", href: "/settings/integrations", keywords: ["crm", "connect", "handoff", "webhooks"] },
  { key: "suppression", label: "Suppression", href: "/settings/suppression", keywords: ["blocklist", "do not contact", "opt-out", "unsubscribe"] },
];

/**
 * Rank a destination against the query tokens. Every token must land somewhere; the score is
 * the sum of how far each one had to reach (label prefix 0 → label word prefix 1 → label
 * substring 2 → path/keyword 3). Lower is better; null means no match.
 */
function scoreDestination(item: PaletteDestination, tokens: readonly string[]): number | null {
  const label = item.label.toLowerCase();
  const words = label.split(/\s+/);
  const reach = [item.href.toLowerCase(), ...item.keywords.map((k) => k.toLowerCase())].join(" ");
  let score = 0;
  for (const token of tokens) {
    if (label.startsWith(token)) continue;
    if (words.some((w) => w.startsWith(token))) score += 1;
    else if (label.includes(token)) score += 2;
    else if (reach.includes(token)) score += 3;
    else return null;
  }
  return score;
}

/** Filter + rank destinations for a query. Empty query → every destination in list order;
 *  ties keep list order, so the ranking is stable and predictable. */
export function filterDestinations(
  query: string,
  items: readonly PaletteDestination[] = PALETTE_DESTINATIONS
): PaletteDestination[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...items];
  return items
    .map((item, index) => ({ item, index, score: scoreDestination(item, tokens) }))
    .filter((entry): entry is { item: PaletteDestination; index: number; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.item);
}
