export type SuppressionKind = "email" | "linkedin";

export type ParsedSuppression =
  | { ok: true; values: { kind: SuppressionKind; value: string; note: string | null } }
  | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOTE_MAX = 500;

/** Must agree with pg-store.isSuppressed (lowercase) and copy-draft normalizeLinkedInUrl (trailing slashes). */
export function normalizeSuppressionValue(kind: SuppressionKind, raw: string): string {
  const v = raw.trim().toLowerCase();
  return kind === "linkedin" ? v.replace(/\/+$/, "") : v;
}

export function parseSuppressionInput(
  kind: string,
  rawValue: string,
  note: string | null
): ParsedSuppression {
  if (kind !== "email" && kind !== "linkedin") return { ok: false, error: "Pick a channel." };
  const value = normalizeSuppressionValue(kind, rawValue ?? "");
  if (!value) return { ok: false, error: "Enter a value to suppress." };
  if (kind === "email" && !EMAIL_RE.test(value)) {
    return { ok: false, error: "That doesn't look like an email address." };
  }
  if (kind === "linkedin" && !value.includes("linkedin.com/")) {
    return { ok: false, error: "Enter a LinkedIn profile URL (linkedin.com/…)." };
  }
  const trimmedNote = note?.trim() ? note.trim() : null;
  if (trimmedNote && trimmedNote.length > NOTE_MAX) {
    return { ok: false, error: "Keep the note under 500 characters." };
  }
  return { ok: true, values: { kind, value, note: trimmedNote } };
}
