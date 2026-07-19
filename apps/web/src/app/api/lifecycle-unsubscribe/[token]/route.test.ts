import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

beforeAll(() => {
  process.env.LIFECYCLE_UNSUBSCRIBE_SECRET = "test-secret";
});

// ── Fake account_members / accounts store ───────────────────────────────────

type Member = { account_id: string; user_id: string; role: "owner" | "admin" | "member" };

let members: Member[] = [];
let accountFlags: Record<string, boolean> = {};
let updateCalls: Array<{ ids: string[]; value: boolean }> = [];

// Minimal thenable query-builder mirroring postgrest-js: `.eq()` alone is awaitable (the
// pre-fix route shape), and `.eq().in()` is also awaitable (the post-fix, role-filtered shape) —
// so reverting the route's `.in("role", ...)` call still exercises a realistic mock instead of
// throwing on a missing method.
function membersQuery(predicates: Array<[string, unknown]>) {
  const resolve = () => {
    const data = members
      .filter((m) => predicates.every(([col, val]) => (m as Record<string, unknown>)[col] === val))
      .map((m) => ({ account_id: m.account_id }));
    return { data, error: null };
  };
  return {
    eq: (col: string, val: unknown) => membersQuery([...predicates, [col, val]]),
    in: (col: string, vals: unknown[]) => {
      const data = members
        .filter(
          (m) =>
            predicates.every(([c, v]) => (m as Record<string, unknown>)[c] === v) &&
            vals.includes((m as Record<string, unknown>)[col])
        )
        .map((m) => ({ account_id: m.account_id }));
      return Promise.resolve({ data, error: null });
    },
    then: (onFulfilled: (v: { data: unknown; error: null }) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(resolve()).then(onFulfilled, onRejected),
  };
}

function makeServiceClient() {
  return {
    from: (table: string) => {
      if (table === "account_members") {
        return {
          select: (_cols: string) => membersQuery([]),
        };
      }
      if (table === "accounts") {
        return {
          update: (vals: { lifecycle_emails_enabled: boolean }) => ({
            in: (_col: string, ids: string[]) => {
              updateCalls.push({ ids, value: vals.lifecycle_emails_enabled });
              for (const id of ids) accountFlags[id] = vals.lifecycle_emails_enabled;
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => makeServiceClient(),
}));

// ── Import route + real token helpers AFTER mocks ────────────────────────────

import { GET, POST } from "./route";
import { signUnsubscribeToken } from "@vantera/transactional-email";

function ctxFor(token: string) {
  return { params: Promise.resolve({ token }) };
}

function postRequest(token: string, contentType: string, body: string | null) {
  return new Request(`http://localhost/api/lifecycle-unsubscribe/${token}`, {
    method: "POST",
    headers: contentType ? { "content-type": contentType } : {},
    body,
  });
}

function getRequest(token: string) {
  return new Request(`http://localhost/api/lifecycle-unsubscribe/${token}`, { method: "GET" });
}

describe("lifecycle-unsubscribe route", () => {
  beforeEach(() => {
    members = [
      { account_id: "acct-owned", user_id: "user-1", role: "owner" },
      { account_id: "acct-admin", user_id: "user-1", role: "admin" },
      { account_id: "acct-member-only", user_id: "user-2", role: "member" },
    ];
    accountFlags = { "acct-owned": true, "acct-admin": true, "acct-member-only": true };
    updateCalls = [];
  });

  it("POST opts out every account the user administers (owner + admin)", async () => {
    const token = signUnsubscribeToken("user-1");
    const res = await POST(postRequest(token, "", null), ctxFor(token));
    expect(res.status).toBe(200);
    expect(accountFlags["acct-owned"]).toBe(false);
    expect(accountFlags["acct-admin"]).toBe(false);
    expect(updateCalls).toHaveLength(1);
    expect(new Set(updateCalls[0].ids)).toEqual(new Set(["acct-owned", "acct-admin"]));
  });

  it("ROLE FILTER: a member-only account is never opted out, and the write is rejected as invalid", async () => {
    const token = signUnsubscribeToken("user-2");
    const res = await POST(postRequest(token, "", null), ctxFor(token));
    // user-2 administers nothing (member-only) — no accounts row is a valid opt-out target.
    expect(res.status).toBe(400);
    expect(accountFlags["acct-member-only"]).toBe(true);
    expect(updateCalls).toHaveLength(0);
  });

  it("POST handles a plain HTML-form submit (application/x-www-form-urlencoded), not just an empty one-click body", async () => {
    const token = signUnsubscribeToken("user-1");
    const res = await POST(
      postRequest(token, "application/x-www-form-urlencoded", "unsubscribe=1"),
      ctxFor(token)
    );
    expect(res.status).toBe(200);
    expect(accountFlags["acct-owned"]).toBe(false);
    expect(accountFlags["acct-admin"]).toBe(false);
  });

  it("GET performs no write and returns an unauthenticated confirmation page with a POST form", async () => {
    const token = signUnsubscribeToken("user-1");
    const res = await GET(getRequest(token), ctxFor(token));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(res.headers.get("cache-control")).toBe("no-store");

    // No write happened — the accounts this token administers are untouched.
    expect(accountFlags["acct-owned"]).toBe(true);
    expect(accountFlags["acct-admin"]).toBe(true);
    expect(updateCalls).toHaveLength(0);

    const html = await res.text();
    expect(html).toContain("<form");
    expect(html).toContain('method="POST"');
    expect(html).toContain(`/api/lifecycle-unsubscribe/${token}`);
  });

  it("GET on a garbage/unverifiable token still performs no write", async () => {
    const res = await GET(getRequest("garbage-token"), ctxFor("garbage-token"));
    expect(res.status).toBe(200);
    expect(updateCalls).toHaveLength(0);
  });

  it("sets Cache-Control: no-store on every response shape", async () => {
    const token = signUnsubscribeToken("user-1");
    const okPost = await POST(postRequest(token, "", null), ctxFor(token));
    expect(okPost.headers.get("cache-control")).toBe("no-store");

    const badToken = "not-a-real-token";
    const badPost = await POST(postRequest(badToken, "", null), ctxFor(badToken));
    expect(badPost.status).toBe(400);
    expect(badPost.headers.get("cache-control")).toBe("no-store");
  });

  it("distinguishes an invalid/unsigned token (400) from a DB lookup failure (500) with different wording", async () => {
    const badToken = "not-a-real-token";
    const invalidRes = await POST(postRequest(badToken, "", null), ctxFor(badToken));
    expect(invalidRes.status).toBe(400);
    const invalidText = await invalidRes.text();
    expect(invalidText).toMatch(/isn't valid/i);
    expect(invalidText).not.toMatch(/try again/i);

    // Force a DB lookup failure for a validly-signed token.
    const token = signUnsubscribeToken("user-1");
    const failingClient = {
      from: (table: string) => {
        if (table === "account_members") {
          return {
            select: () => ({
              eq: () => ({
                in: () => Promise.resolve({ data: null, error: { message: "connection reset" } }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as unknown as SupabaseClient;

    const svcModule = await import("@/lib/supabase/service");
    const spy = vi.spyOn(svcModule, "createServiceClient").mockReturnValueOnce(failingClient);

    const errorRes = await POST(postRequest(token, "", null), ctxFor(token));
    expect(errorRes.status).toBe(500);
    const errorText = await errorRes.text();
    expect(errorText).toMatch(/try again/i);
    expect(errorText).not.toMatch(/isn't valid/i);

    spy.mockRestore();
  });
});
