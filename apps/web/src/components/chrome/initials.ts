/**
 * Two-letter initials for the avatar tile: first + last initial of the display name
 * ("Ada Lovelace" → "AL", "Ada" → "A"), with the session's single `initial` (the email's
 * first letter) as the fallback when no display name is set. Email-shaped input drops the
 * domain first so "ada.lovelace@x.com" still reads "AL".
 */
export function initialsFrom(displayName: string | null | undefined, fallback: string): string {
  const base = (displayName ?? "").replace(/@.*$/, "").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return fallback.trim().charAt(0).toUpperCase() || "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}
