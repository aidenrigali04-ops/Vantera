import { describe, expect, it, vi } from "vitest";
import { completeGoogleOAuth, OAUTH_NEW_USER_MS } from "./oauth-complete";

function user(over: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "dana@acme.example",
    created_at: new Date().toISOString(),
    user_metadata: { full_name: "Dana Whitfield", avatar_url: "https://lh3.googleusercontent.com/a/x" },
    ...over,
  };
}

function deps(over: Partial<Parameters<typeof completeGoogleOAuth>[1]> = {}) {
  const calls = {
    exchanged: [] as string[],
    updated: [] as Record<string, unknown>[],
    profiles: [] as Record<string, unknown>[],
    invites: [] as string[],
    welcomes: [] as string[],
    signedOut: 0,
  };
  return {
    calls,
    deps: {
      exchangeCode: async (code: string) => {
        calls.exchanged.push(code);
        return { error: null };
      },
      getUser: async () => user(),
      updateUser: async (attrs: { data: Record<string, unknown> }) => {
        calls.updated.push(attrs.data);
      },
      upsertProfile: async (row: Record<string, unknown>) => {
        calls.profiles.push(row);
      },
      hasMembership: async () => false,
      acceptInvite: async (token: string) => {
        calls.invites.push(token);
        return { error: null };
      },
      sendWelcome: async (email: string) => {
        calls.welcomes.push(email);
      },
      signOut: async () => {
        calls.signedOut += 1;
      },
      now: () => new Date(),
      ...over,
    },
  };
}

describe("completeGoogleOAuth", () => {
  it("missing or failed code exchange sends the user back to login", async () => {
    const missing = await completeGoogleOAuth({ code: null }, deps().deps);
    expect(missing).toEqual({ ok: false, redirectTo: "/login?error=oauth" });

    const { deps: failing } = deps({
      exchangeCode: async () => ({ error: { message: "bad code" } }),
    });
    const failed = await completeGoogleOAuth({ code: "abc" }, failing);
    expect(failed).toEqual({ ok: false, redirectTo: "/login?error=oauth" });
  });

  it("a successful exchange lands on dashboard (or a safe next)", async () => {
    const { deps: d, calls } = deps();
    const ok = await completeGoogleOAuth({ code: "pkce" }, d);
    expect(ok).toEqual({ ok: true, redirectTo: "/dashboard" });
    expect(calls.exchanged).toEqual(["pkce"]);

    const next = await completeGoogleOAuth({ code: "pkce", next: "/invite/x" }, deps().deps);
    expect(next).toEqual({ ok: true, redirectTo: "/invite/x" });

    const evil = await completeGoogleOAuth(
      { code: "pkce", next: "https://evil.example" },
      deps().deps
    );
    expect(evil).toEqual({ ok: true, redirectTo: "/dashboard" });
  });

  it("stashes the landing-page site, prefills name from Google, and welcomes a fresh user", async () => {
    const { deps: d, calls } = deps();
    await completeGoogleOAuth({ code: "pkce", site: "acme.com" }, d);
    expect(calls.updated).toEqual([{ pending_site: "acme.com" }]);
    expect(calls.profiles[0]).toMatchObject({
      user_id: "user-1",
      display_name: "Dana Whitfield",
      avatar_url: "https://lh3.googleusercontent.com/a/x",
    });
    expect(calls.welcomes).toEqual(["dana@acme.example"]);
  });

  it("does not re-welcome a returning user or an invitee", async () => {
    const { deps: oldDeps, calls: oldCalls } = deps({
      getUser: async () =>
        user({ created_at: new Date(Date.now() - OAUTH_NEW_USER_MS - 1_000).toISOString() }),
    });
    expect((await completeGoogleOAuth({ code: "pkce" }, oldDeps)).ok).toBe(true);
    expect(oldCalls.welcomes).toEqual([]);
    expect(oldCalls.profiles).toEqual([]);

    const { deps: memberDeps, calls: memberCalls } = deps({ hasMembership: async () => true });
    await completeGoogleOAuth({ code: "pkce" }, memberDeps);
    expect(memberCalls.welcomes).toEqual([]);

    const { deps: inviteDeps, calls: inviteCalls } = deps();
    await completeGoogleOAuth(
      { code: "pkce", invite: "11111111-2222-3333-4444-555555555555" },
      inviteDeps
    );
    expect(inviteCalls.invites).toEqual(["11111111-2222-3333-4444-555555555555"]);
    expect(inviteCalls.welcomes).toEqual([]);
  });

  it("an expired invite still signs them in so they can create their own workspace", async () => {
    const { deps: d, calls } = deps({
      acceptInvite: async () => ({ error: { message: "invite not found or no longer valid" } }),
    });
    const out = await completeGoogleOAuth(
      { code: "pkce", invite: "11111111-2222-3333-4444-555555555555" },
      d
    );
    expect(out).toEqual({ ok: true, redirectTo: "/dashboard" });
    expect(calls.signedOut).toBe(0);
    expect(calls.welcomes).toEqual(["dana@acme.example"]);
  });

  it("an invite bound to a different Google email returns to signup with an honest error", async () => {
    const { deps: d, calls } = deps({
      acceptInvite: async () => ({ error: { message: "invite was issued to a different email" } }),
    });
    const out = await completeGoogleOAuth(
      { code: "pkce", invite: "11111111-2222-3333-4444-555555555555" },
      d
    );
    expect(out.ok).toBe(false);
    expect(out.redirectTo).toContain("/signup?");
    expect(out.redirectTo).toContain("error=invite-email");
    expect(out.redirectTo).toContain("invite=11111111-2222-3333-4444-555555555555");
    expect(calls.signedOut).toBe(1);
    expect(calls.welcomes).toEqual([]);
  });
});
