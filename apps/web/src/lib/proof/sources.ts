import { signalKindLabel } from "../analytics";
import type { ProofInput, ProofRow } from "./types";

export type LeadSets = {
  contacted: Set<string>;
  accepted: Set<string>;
  replied: Set<string>;
  interested: Set<string>;
  closed: Set<string>;
};
type Category = "keywords" | "competitors" | "creators" | "hashtags" | "removed";

export function leadSets(input: ProofInput): LeadSets {
  const ids = new Set(input.leads.map((l) => l.id));
  const contacted = new Set<string>();
  for (const id of input.sendLeadIds) if (ids.has(id)) contacted.add(id);
  const accepted = new Set<string>();
  const closed = new Set<string>();
  for (const l of input.leads) {
    if (l.linkedin_invited_at) contacted.add(l.id);
    if (l.linkedin_connected_at) accepted.add(l.id);
    if (l.status === "converted") closed.add(l.id);
  }
  const replied = new Set<string>();
  const interested = new Set<string>();
  for (const r of input.replies) {
    if (!ids.has(r.lead_id)) continue;
    replied.add(r.lead_id);
    if (r.classification === "interested") interested.add(r.lead_id);
  }
  return { contacted, accepted, replied, interested, closed };
}

const norm = (s: string) => s.trim().toLowerCase();
const slug = (s: string) => /linkedin\.com\/in\/([^/?#\s]+)/.exec(s)?.[1] ?? null;

export function watchCategory(
  target: string | null,
  watch: ProofInput["watch"]
): Category | null {
  if (target === null) return null;
  const t = norm(target);
  if (!watch) return "removed";
  if (watch.keywords.some((k) => norm(k) === t)) return "keywords";
  if (watch.competitors.some((k) => norm(k) === t)) return "competitors";
  const tag = (s: string) => norm(s).replace(/^#/, "");
  if (watch.hashtags.some((h) => tag(h) === tag(target))) return "hashtags";
  const ts = slug(t);
  if (
    watch.creators.some((c) => {
      const n = norm(c);
      if (n === t) return true;
      const cs = slug(n);
      return !!(ts && cs && ts === cs) || (!!ts && n.includes(`linkedin.com/in/${ts}`)) || (!!cs && t.includes(`linkedin.com/in/${cs}`));
    })
  )
    return "creators";
  return "removed";
}

function makeRow(
  key: string,
  label: string,
  group: ProofRow["group"],
  members: Set<string>,
  sets: LeadSets,
  found: number | null = members.size
): ProofRow {
  const n = (s: Set<string>) => { let c = 0; for (const id of members) if (s.has(id)) c++; return c; };
  return {
    key, label, group, found,
    contacted: n(sets.contacted), accepted: n(sets.accepted),
    replied: n(sets.replied), interested: n(sets.interested), closed: n(sets.closed),
  };
}

const INTENT_ROWS: [Category, string][] = [
  ["keywords", "Keyword mentions"],
  ["competitors", "Competitor engagers"],
  ["creators", "Creator engagers"],
  ["hashtags", "Hashtag activity"],
  ["removed", "Removed watch targets"],
];

export function sourceRows(input: ProofInput, sets: LeadSets): ProofRow[] {
  const ids = new Set(input.leads.map((l) => l.id));
  const byKind = new Map<string, Set<string>>();
  const withSignal = new Set<string>();
  for (const s of input.signals) {
    if (!ids.has(s.lead_id)) continue;
    withSignal.add(s.lead_id);
    if (!byKind.has(s.kind)) byKind.set(s.kind, new Set());
    byKind.get(s.kind)!.add(s.lead_id);
  }
  const byCat = new Map<Category, Set<string>>(INTENT_ROWS.map(([c]) => [c, new Set<string>()]));
  const withObs = new Set<string>();
  for (const o of input.observations) {
    if (!ids.has(o.lead_id)) continue;
    withObs.add(o.lead_id);
    // A null target can't be matched to config; keep it visible under "removed" so nothing is dropped.
    byCat.get(watchCategory(o.watch_target, input.watch) ?? "removed")!.add(o.lead_id);
  }
  const none = new Set<string>();
  for (const l of input.leads) if (!withSignal.has(l.id) && !withObs.has(l.id)) none.add(l.id);

  const signalRows = [...byKind.entries()]
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .map(([k, m]) => makeRow(k, signalKindLabel(k), "signal", m, sets));
  const intentRows = INTENT_ROWS.map(([c, label]) =>
    makeRow(`intent:${c}`, label, "intent", byCat.get(c)!, sets)
  );
  return [...signalRows, ...intentRows, makeRow("none", "No signal captured", "other", none, sets)];
}

export function agentRows(input: ProofInput, sets: LeadSets): ProofRow[] {
  const pick = (f: (src: string) => boolean) =>
    new Set(input.leads.filter((l) => f(l.source)).map((l) => l.id));
  const all = new Set(input.leads.map((l) => l.id));
  return [
    makeRow("agent:scout", "Scout", "agent", pick((s) => s === "discovery"), sets),
    makeRow("agent:intent", "Intent", "agent", pick((s) => s === "intent"), sets),
    makeRow("agent:added", "Added by you", "agent",
      pick((s) => ["manual", "import", "inbound", "ad"].includes(s)), sets),
    makeRow("agent:outreach", "Outreach", "agent", all, sets, null),
  ];
}
