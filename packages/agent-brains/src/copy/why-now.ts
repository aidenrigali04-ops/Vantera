import type { Violation } from "./humanizer";

/**
 * ML-3 signal-cited openers. The strongest reason to reach out is a real, captured "why now" — the
 * intent agent's verdict ("commented asking for a churn tool on a RevOps post") or a fresh company
 * event (raised a round, new exec). It is passed to the copy brain as a verified fact, and the
 * connection note must reference it. Pure.
 */

export type WhyNow = { kind: string; text: string; ageDays?: number | null };
export type SignalLike = { kind: string; label: string | null; detail: string | null; observedAt: string | Date | null };

/** A signal older than this is history, not a reason to reach out now. */
export const WHY_NOW_MAX_AGE_DAYS = 90;
const WHY_NOW_MAX_CHARS = 200;

/** Reach-out-worthy kinds, strongest first. Negative events (legal, cost cutting, security) are
 *  never an opener — congratulating someone on layoffs is the worst possible first touch. */
const PRIORITY = [
  "intent",
  // a follow is the person's own action toward the seller — warmer than company news (ML-8)
  "follow",
  "funding",
  "exec_hire",
  "m_and_a",
  "product_launch",
  "partnership",
  "office_opening",
  "hiring",
  "award",
];

export function pickWhyNow(signals: SignalLike[], now: Date = new Date()): WhyNow | null {
  let best: { rank: number; ageDays: number; s: SignalLike } | null = null;
  for (const s of signals) {
    const rank = PRIORITY.indexOf(s.kind);
    if (rank === -1 || !s.observedAt) continue;
    const ageDays = Math.floor((now.getTime() - new Date(s.observedAt).getTime()) / 86_400_000);
    if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > WHY_NOW_MAX_AGE_DAYS) continue;
    const text = (s.label ?? s.detail ?? "").trim();
    if (!text) continue;
    if (!best || rank < best.rank || (rank === best.rank && ageDays < best.ageDays)) best = { rank, ageDays, s };
  }
  if (!best) return null;
  const text = (best.s.label ?? best.s.detail ?? "").trim().replace(/\s+/g, " ").slice(0, WHY_NOW_MAX_CHARS);
  return { kind: best.s.kind, text, ageDays: best.ageDays };
}

/** Words that carry no signal-specific meaning — overlap on these doesn't count as a reference. */
const STOP = new Set(
  "about after again also always been being both could does doing from great have hello here hope into just know like love more most much need only other over really same some such than thank thanks that their them then there these they thing think this those through very want what when where which while with would your yours connect connecting noticed".split(
    " "
  )
);

/** Per-kind words a natural reference uses even when it paraphrases the signal text. */
const KIND_WORDS: Record<string, string[]> = {
  follow: ["follow"],
  funding: ["rais", "fund", "round", "series", "seed", "capital", "invest"],
  exec_hire: ["join", "welcom", "congrat", "appoint", "promot", "new role"],
  m_and_a: ["acqui", "merg"],
  product_launch: ["launch", "releas", "ship"],
  partnership: ["partner"],
  office_opening: ["office", "open", "expan"],
  hiring: ["hiring", "hire", "team", "grow"],
  award: ["award", "congrat", "win", "won"],
};

/** Content-word stems (first 5 letters of words ≥ 4 letters, stopwords removed). */
function stems(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z][a-z0-9]{3,}/g) ?? []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 5))
  );
}

/**
 * Deterministic check that the connection note references the why-now: it shares a content word
 * with the signal text (other than the prospect's own name/company — `identity`), or uses a word
 * that naturally names that kind of event. Lenient on purpose —
 * it catches a note that ignores the signal entirely, not a good paraphrase.
 */
export function findMissingWhyNow(note: string, whyNow: WhyNow | null | undefined, identity?: string | null): Violation[] {
  if (!whyNow) return [];
  const noteLower = note.toLowerCase();
  const noteStems = stems(note);
  // the prospect's own name/company words appear in many signals ("Acme raised…") — naming them is
  // not citing the event
  const own = stems(identity ?? "");
  for (const s of stems(whyNow.text)) if (!own.has(s) && noteStems.has(s)) return [];
  for (const w of KIND_WORDS[whyNow.kind] ?? []) if (noteLower.includes(w)) return [];
  return [
    {
      rule: "why-now-missing",
      detail: `the connection note must reference the verified why-now ("${whyNow.text}") in your own words`,
    },
  ];
}
