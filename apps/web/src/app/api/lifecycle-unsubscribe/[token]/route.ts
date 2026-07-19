import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@vantera/transactional-email";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * RFC 8058 one-click unsubscribe for lifecycle emails. Must work with no session — the whole
 * point is that a lapsed user can opt out without logging in. POST is what mail clients call;
 * GET is what a human clicking the footer link hits.
 *
 * Multi-account decision: the token signs a USER id, not an account id (see
 * packages/jobs/src/pipeline/pg-store.ts `canonical_user` — one signed identity per pull-back
 * email, however many owner/admin addresses it went to). `account_members` has no unique
 * constraint on `user_id` alone — team seats mean one user can belong to more than one account,
 * so a naive `.eq("user_id", userId).maybeSingle()` throws instead of returning a row the moment
 * that happens, turning "click to opt out" into a 400 for exactly the accounts most likely to
 * have a second seat. This opts the USER out everywhere they are owner/admin: every
 * `lifecycle_emails_enabled` flip is best-effort and independent, so one bad row never blocks the
 * rest, and a person who says "stop emailing me" stops getting lifecycle email from every
 * account they administer, not just the one that happened to trigger this send.
 */
async function optOut(token: string): Promise<boolean> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;

  const svc = createServiceClient();
  const { data: members, error: lookupError } = await svc
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId);
  if (lookupError || !members || members.length === 0) return false;

  const accountIds = [...new Set(members.map((m) => m.account_id as string))];
  const { error } = await svc
    .from("accounts")
    .update({ lifecycle_emails_enabled: false })
    .in("id", accountIds);
  return !error;
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await optOut(token);
  return new NextResponse(null, { status: ok ? 200 : 400 });
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const ok = await optOut(token);
  const body = ok
    ? "You're unsubscribed from Vantera lifecycle emails. You can turn them back on in Settings → Notifications."
    : "That unsubscribe link isn't valid. You can change email settings in Settings → Notifications.";
  return new NextResponse(body, {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
