import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendPaymentFailedEmail = vi.fn(async () => {});
vi.mock("@vantera/transactional-email", () => ({
  sendPaymentFailedEmail: (...args: unknown[]) => sendPaymentFailedEmail(...(args as [])),
}));

const { applyDunning } = await import("./billing-dunning");

type UpdateCall = { payload: Record<string, unknown> };

/**
 * Minimal postgrest-shaped fake. `onUpdate` lets a test make a specific UPDATE fail the way a real
 * one would when migration 0060 has not been applied to this environment.
 */
function fakeSupabase(opts: {
  account?: { lifecycle_emails_enabled: boolean; payment_failed_notified_at: string | null } | null;
  onUpdate?: (payload: Record<string, unknown>) => void;
} = {}) {
  const account =
    opts.account === undefined
      ? { lifecycle_emails_enabled: true, payment_failed_notified_at: null }
      : opts.account;
  const updates: UpdateCall[] = [];

  const client = {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: table === "accounts" ? account : null }),
                in: async () => ({ data: [{ user_id: "user-1" }] }),
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          const apply = () => {
            updates.push({ payload });
            opts.onUpdate?.(payload);
            return { error: null };
          };
          return {
            eq() {
              const result = { then: (r: (v: unknown) => unknown) => Promise.resolve(apply()).then(r) };
              return Object.assign(result, { not: () => result });
            },
          };
        },
      };
    },
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "owner@x.io" } } }) } },
  };
  return { supabase: client as unknown as SupabaseClient, updates };
}

const columns = (u: UpdateCall) => Object.keys(u.payload);

describe("applyDunning", () => {
  beforeEach(() => {
    sendPaymentFailedEmail.mockClear();
    sendPaymentFailedEmail.mockImplementation(async () => {});
  });

  it("emails owners/admins and stamps both flags on a past_due account", async () => {
    const { supabase, updates } = fakeSupabase();
    await applyDunning(supabase, "acc-1", "past_due");
    expect(sendPaymentFailedEmail).toHaveBeenCalledTimes(1);
    expect(updates.map(columns)).toEqual([["payment_failed_notified_at"], ["lifecycle_last_email_at"]]);
  });

  /**
   * The collision-guard stamp is bookkeeping for a DIFFERENT feature (the pull-back email) added
   * on top of dunning's own idempotence write. Folded into ONE update payload, an unapplied
   * migration 0060 makes Postgres reject the whole statement — payment_failed_notified_at never
   * lands, and the next past_due webhook emails the same account again. Two statements, idempotence
   * first, means a broken stamp costs at most one extra pull-back email.
   */
  it("writes payment_failed_notified_at in its own statement, before the stamp", async () => {
    const { supabase, updates } = fakeSupabase();
    await applyDunning(supabase, "acc-1", "past_due");
    expect(updates).toHaveLength(2);
    expect(columns(updates[0]!)).toEqual(["payment_failed_notified_at"]);
    expect(columns(updates[0]!)).not.toContain("lifecycle_last_email_at");
  });

  it("still lands payment_failed_notified_at when the lifecycle stamp throws", async () => {
    const { supabase, updates } = fakeSupabase({
      onUpdate: (payload) => {
        if ("lifecycle_last_email_at" in payload) {
          throw new Error('column "lifecycle_last_email_at" does not exist');
        }
      },
    });
    await expect(applyDunning(supabase, "acc-1", "past_due")).resolves.toBeUndefined();
    expect(updates.map(columns)).toContainEqual(["payment_failed_notified_at"]);
  });

  it("writes nothing when every send failed — the account retries next webhook", async () => {
    sendPaymentFailedEmail.mockImplementation(async () => {
      throw new Error("mail down");
    });
    const { supabase, updates } = fakeSupabase();
    await applyDunning(supabase, "acc-1", "past_due");
    expect(updates).toEqual([]);
  });

  it("skips an account that already got the email this spell", async () => {
    const { supabase, updates } = fakeSupabase({
      account: { lifecycle_emails_enabled: true, payment_failed_notified_at: "2026-07-01T00:00:00Z" },
    });
    await applyDunning(supabase, "acc-1", "past_due");
    expect(sendPaymentFailedEmail).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("clears the spell stamp on recovery so the next failure notifies again", async () => {
    const { supabase, updates } = fakeSupabase();
    await applyDunning(supabase, "acc-1", "active");
    expect(updates.map((u) => u.payload)).toEqual([{ payment_failed_notified_at: null }]);
  });
});
