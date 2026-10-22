import type { CopyStrategy } from "./shared";

const KNOB_LABEL: Record<string, string> = {
  "openWith:trigger": "lead with the prospect's trigger",
  "openWith:pain": "lead with the prospect's pain",
  "followupLength:tight": "a tighter, one-sentence follow-up",
  "followupLength:standard": "a standard-length follow-up",
  "askStyle:soft": "a softer, low-pressure ask",
  "askStyle:specific": "a concrete, specific ask",
};

/** Human label for a copy strategy. Pure. */
export function describeStrategy(strategy: CopyStrategy): string {
  const parts = Object.entries(strategy)
    .filter(([, v]) => v)
    .map(([k, v]) =>
      k === "openerAngle"
        ? `open with the angle "${String(v)}"`
        : (KNOB_LABEL[`${k}:${String(v)}`] ?? `${k}: ${String(v)}`)
    );
  return parts.length > 0 ? parts.join(", ") : "the current approach";
}
