/**
 * `scheduled_sends.style_flags` is the humanizer's own output — `"<rule>: <detail>"` joined
 * by `"; "` (packages/agent-brains/src/copy/humanizer.ts). The rule id is an internal
 * identifier, so the peek shows a human label instead; the detail is the useful half and is
 * kept verbatim.
 *
 * Split on `;` ONLY: details legitimately contain commas
 * (`hedging: too much hedging (just, maybe)`), and splitting on them shredded one flag into
 * two chips, the second reading `maybe)`.
 */

const RULE_LABELS: Record<string, string> = {
  "banned-phrase": "Salesy phrase",
  dashes: "Dash as punctuation",
  semicolon: "Semicolon",
  "list-format": "List formatting",
  exclamations: "Exclamation marks",
  hedging: "Hedging",
  opener: "Weak opener",
  "parrot-opener": "Parrots their words",
  length: "Too long",
  restart: "Restarts the conversation",
  "ungrounded-claim": "Unbacked claim",
  "speculative-claim": "Speculative claim",
  "action-claim": "Claims an action",
  "unapproved-link": "Unapproved link",
};

export interface StyleFlag {
  /** the human label for the rule */
  label: string;
  /** the linter's detail, shown as the chip's tooltip */
  detail: string | null;
}

export function parseStyleFlags(raw: string | null): StyleFlag[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const at = part.indexOf(":");
      if (at === -1) return { label: part, detail: null };
      const rule = part.slice(0, at).trim();
      const detail = part.slice(at + 1).trim() || null;
      return { label: RULE_LABELS[rule] ?? rule.replace(/-/g, " "), detail };
    });
}
