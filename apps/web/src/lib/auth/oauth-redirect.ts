import { siteUrl } from "@/lib/site-url";
import { safeNext } from "./safe-next";

const INVITE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Landing-page site host or http(s) URL — never a javascript:/data: payload. */
export function safeSite(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim().slice(0, 300) : "";
  if (!v) return null;
  if (/^(javascript|data|vbscript):/i.test(v)) return null;
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      if (u.protocol !== "http:" && u.protocol !== "https:") return null;
      return v;
    } catch {
      return null;
    }
  }
  // bare host typed on the landing page, e.g. acme.com
  if (/^[\w.-]+\.[a-z]{2,}(?:[/?#].*)?$/i.test(v)) return v;
  return null;
}

export function safeInviteToken(raw: unknown): string | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  return INVITE_UUID.test(v) ? v : null;
}

/**
 * The URL Google/Supabase returns to after consent. Query params are the only way to
 * carry next/site/invite across the round-trip (the OAuth state is owned by the provider).
 */
export function googleOAuthRedirectTo(input: {
  next?: unknown;
  site?: unknown;
  invite?: unknown;
}): string {
  const url = new URL("/auth/callback", siteUrl());
  const next = safeNext(input.next);
  if (next) url.searchParams.set("next", next);
  const site = safeSite(input.site);
  if (site) url.searchParams.set("site", site);
  const invite = safeInviteToken(input.invite);
  if (invite) url.searchParams.set("invite", invite);
  return url.toString();
}
