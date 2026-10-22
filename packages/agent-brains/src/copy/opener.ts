import type { Violation } from "./humanizer";

/**
 * Opener skeletons (copy-quality fix, 2026-10-21). The avoid-list used to carry raw 70-char clips
 * of recent openers, which INCLUDED the prospect's name/company — so "Thanks for connecting, Sarah.
 * Curious how…" and "Thanks for connecting, Tom. Curious how…" read as different strings and the
 * model satisfied "don't reuse" by renaming. A skeleton is the first few normalized words with the
 * prospect's identity stripped, so the template is visible as a template and can be enforced in
 * code (findRepeatedOpener), not just prompted.
 *
 * Pure: no DB, no model. The jobs layer queries the openers; this module only shapes/compares them.
 */

/** How many leading words make up an opener's skeleton. */
export const OPENER_SKELETON_WORDS = 5;
/** A skeleton shorter than this is too generic to call a repeat (e.g. "hi there"). */
const MIN_SKELETON_WORDS = 3;

const IDENTITY_MIN_LEN = 2;

function identityWords(identity?: string | null): Set<string> {
  return new Set(
    (identity ?? "")
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .match(/[a-z0-9']+/g)
      ?.filter((w) => w.length >= IDENTITY_MIN_LEN) ?? []
  );
}

function tokens(text: string): string[] {
  return text.toLowerCase().replace(/[‘’]/g, "'").match(/[a-z0-9']+/g) ?? [];
}

/**
 * Remove the prospect's name/company words from `text` (case-insensitive, whole words), tidying
 * the punctuation they leave behind ("Thanks for connecting, Sarah." → "Thanks for connecting.").
 * Used before an opener is stored in the avoid list, so a rename can't dodge it.
 */
export function stripIdentity(text: string, identity?: string | null): string {
  const words = [...identityWords(identity)];
  if (words.length === 0) return text.trim();
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(?:${escaped.join("|")})(?:'s)?\\b`, "gi");
  return text
    .replace(/[‘’]/g, "'")
    .replace(re, "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/,\s*([.!?])/g, "$1")
    .replace(/,{2,}/g, ",")
    .replace(/^[\s,]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * The opener's skeleton: its first OPENER_SKELETON_WORDS words, lowercased, punctuation dropped,
 * the prospect's identity words removed. "" when nothing is left.
 */
export function openerSkeleton(text: string, identity?: string | null): string {
  const drop = identityWords(identity);
  return tokens(text)
    .filter((t) => !drop.has(t) && !drop.has(t.replace(/'s$/, "")))
    .slice(0, OPENER_SKELETON_WORDS)
    .join(" ");
}

/**
 * Flags a message whose opening skeleton matches a recent opener's skeleton — the
 * "same template, different name" repeat. Comparison is on the shared leading words (at least
 * MIN_SKELETON_WORDS of them) so a short recent opener still counts. Feeds the bounded
 * regenerate; a persistent repeat routes the draft to review.
 */
export function findRepeatedOpener(
  text: string,
  recentSkeletons: readonly string[] | null | undefined,
  identity?: string | null
): Violation[] {
  const mine = openerSkeleton(text, identity).split(" ").filter(Boolean);
  if (mine.length < MIN_SKELETON_WORDS) return [];
  for (const skel of recentSkeletons ?? []) {
    const theirs = skel.split(" ").filter(Boolean);
    const n = Math.min(mine.length, theirs.length);
    if (n < MIN_SKELETON_WORDS) continue;
    if (mine.slice(0, n).join(" ") === theirs.slice(0, n).join(" ")) {
      return [
        {
          rule: "repeated-opener",
          detail: `the follow-up opens like a recent message ("${theirs.slice(0, n).join(" ")}…"); open on something specific to this prospect with different first words`,
        },
      ];
    }
  }
  return [];
}

/** Distinct, non-trivial skeletons for a list of openers (identity already stripped or absent). */
export function openerSkeletons(openers: readonly string[], identity?: string | null): string[] {
  const out = new Set<string>();
  for (const o of openers) {
    const s = openerSkeleton(o, identity);
    if (s.split(" ").filter(Boolean).length >= MIN_SKELETON_WORDS) out.add(s);
  }
  return [...out];
}
