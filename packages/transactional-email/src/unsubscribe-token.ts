import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * One-click unsubscribe for the lifecycle lane. A lapsed user cannot be asked to log in to opt
 * out, so the token carries its own proof — HMAC over the user id, no table, no expiry sweep.
 *
 * Lives here rather than in apps/web because packages/jobs signs these links and apps/web
 * verifies them; this package is the only thing both already depend on.
 *
 * Its own secret, deliberately: deriving from RESEND_API_KEY would invalidate every link already
 * sitting in an inbox the moment that key rotates, and a dead unsubscribe link is a compliance
 * failure.
 */
function secret(): string {
  const s = process.env.LIFECYCLE_UNSUBSCRIBE_SECRET;
  if (!s) throw new Error("LIFECYCLE_UNSUBSCRIBE_SECRET missing");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signUnsubscribeToken(userId: string): string {
  const payload = Buffer.from(userId).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null; // reject extra segments (`${token}.GARBAGE`), not just missing ones
  const [payload, signature] = parts;
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const userId = Buffer.from(payload, "base64url").toString("utf8");
  return userId || null;
}
