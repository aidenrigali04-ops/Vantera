import { NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@vantera/transactional-email";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * RFC 8058 one-click unsubscribe for lifecycle emails. Must work with no session — the whole
 * point is that a lapsed user can opt out without logging in.
 *
 * GET performs NO write. Link-scanning proxies (Microsoft Defender SafeLinks and similar) issue
 * a GET against every URL in an email body with no human involved; a route that writes on GET
 * silently unsubscribes people who never clicked anything. GET instead renders a minimal,
 * unauthenticated confirmation page whose one button POSTs to this same URL. POST is what
 * actually flips the flag — driven either by a mail client's header-based `List-Unsubscribe-Post`
 * one-click call, or by a plain `application/x-www-form-urlencoded` submit from the confirmation
 * page's form. Both look identical to this route: neither handler reads the request body, so the
 * token in the URL path is the only input that matters either way.
 *
 * Multi-account decision: the token signs a USER id, not an account id (see
 * packages/jobs/src/pipeline/pg-store.ts `canonical_user` — one signed identity per pull-back
 * email, however many owner/admin addresses it went to). `account_members` has no unique
 * constraint on `user_id` alone — team seats mean one user can belong to more than one account,
 * so a naive `.eq("user_id", userId).maybeSingle()` sets `data = null` (postgrest-js code
 * PGRST116, status 406 — it does not throw) instead of returning a row the moment that happens,
 * turning "click to opt out" into a 400 for exactly the accounts most likely to have a second
 * seat. This opts the USER out everywhere they administer: every `lifecycle_emails_enabled` flip
 * happens in a single best-effort update, so a person who says "stop emailing me" stops getting
 * lifecycle email from every account they administer, not just the one that happened to trigger
 * this send.
 *
 * Role filter: lifecycle emails only ever go to `role IN ('owner','admin')` — the account's real
 * administrators (packages/jobs/src/pipeline/pg-store.ts `getAccountAdminEmails` and the R5/L3
 * lifecycle recipient queries). Without a role filter here, a plain `member` on someone else's
 * workspace could click an unsubscribe link that workspace never sent them and silence that
 * workspace's real owner — an account-level flag flipped by someone with no authority over the
 * account. Scoping the lookup to owner/admin rows means this write can only ever touch accounts
 * the clicking user actually administers.
 */

type OptOutResult = "ok" | "invalid" | "error";

async function optOut(token: string): Promise<OptOutResult> {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return "invalid";

  const svc = createServiceClient();
  const { data: members, error: lookupError } = await svc
    .from("account_members")
    .select("account_id")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"]);
  if (lookupError) return "error";
  if (!members || members.length === 0) return "invalid";

  const accountIds = [...new Set(members.map((m) => m.account_id as string))];
  const { error } = await svc
    .from("accounts")
    .update({ lifecycle_emails_enabled: false })
    .in("id", accountIds);
  return error ? "error" : "ok";
}

function statusFor(result: OptOutResult): number {
  if (result === "ok") return 200;
  if (result === "invalid") return 400;
  return 500;
}

function messageFor(result: OptOutResult): string {
  if (result === "ok") {
    return "You're unsubscribed from Vantera lifecycle emails. You can turn them back on in Settings → Notifications.";
  }
  if (result === "invalid") {
    return "That unsubscribe link isn't valid. You can change email settings in Settings → Notifications.";
  }
  return "We couldn't process your unsubscribe request right now — please try again in a few minutes.";
}

function confirmHtml(token: string): string {
  const action = `/api/lifecycle-unsubscribe/${encodeURIComponent(token)}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribe</title>
  <style>
    body { margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: system-ui, sans-serif; background: #f9fafb; }
    main { text-align: center; max-width: 28rem; padding: 2rem; }
    p { color: #374151; font-size: 1rem; }
    button { margin-top: 1rem; padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 0.5rem; border: none; background: #111827; color: #fff; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <p>Stop receiving Vantera lifecycle emails (trial and billing updates)?</p>
    <form method="POST" action="${action}">
      <button type="submit">Unsubscribe</button>
    </form>
  </main>
</body>
</html>`;
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const result = await optOut(token);
  return new NextResponse(messageFor(result), {
    status: statusFor(result),
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  // No DB write here — see the file-level comment. GET only ever renders the confirmation form.
  return new NextResponse(confirmHtml(token), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
