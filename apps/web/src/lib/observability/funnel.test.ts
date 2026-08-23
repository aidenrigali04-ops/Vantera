import { describe, expect, it, vi } from "vitest";
import { recordFunnelEvent } from "./funnel";
import type { SecurityEventInput } from "@/lib/security/audit";

describe("recordFunnelEvent", () => {
  it("namespaces the event, defaults severity to warn, and maps user/account/email", async () => {
    const record = vi.fn(async (_e: SecurityEventInput) => {});
    await recordFunnelEvent(
      "onboarding.connect_link_failed",
      { userId: "u1", accountId: "a1", email: "x@y.com", extra: { reason: "hosted auth down" } },
      record
    );
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toEqual({
      eventType: "funnel.onboarding.connect_link_failed",
      severity: "warn",
      accountId: "a1",
      actorUserId: "u1",
      metadata: { email: "x@y.com", reason: "hosted auth down" },
    });
  });

  it("honors an explicit severity (info breadcrumbs) and omits absent fields", async () => {
    const record = vi.fn(async (_e: SecurityEventInput) => {});
    await recordFunnelEvent("onboarding.connect_link_issued", { userId: "u1", severity: "info" }, record);
    const arg = record.mock.calls[0][0];
    expect(arg.severity).toBe("info");
    expect(arg.accountId).toBeNull();
    expect(arg.metadata).toEqual({}); // no email, no error, no extra
  });

  it("truncates an error message and never leaks a stack/object", async () => {
    const record = vi.fn(async (_e: SecurityEventInput) => {});
    await recordFunnelEvent("signup.create_user_failed", { error: new Error("z".repeat(500)) }, record);
    const meta = record.mock.calls[0][0].metadata as { error: string };
    expect(meta.error.endsWith("…")).toBe(true);
    expect(meta.error.length).toBe(301); // 300 chars + ellipsis
    expect(meta.error.startsWith("zzz")).toBe(true);
  });

  it("accepts a string error as-is", async () => {
    const record = vi.fn(async (_e: SecurityEventInput) => {});
    await recordFunnelEvent("onboarding.personalize_save_failed", { error: "permission denied" }, record);
    expect((record.mock.calls[0][0].metadata as { error: string }).error).toBe("permission denied");
  });

  it("never throws into the caller even if the recorder rejects", async () => {
    const record = vi.fn(async () => {
      throw new Error("audit sink unreachable");
    });
    // must resolve, not reject — a logging failure can never break the observed flow
    await expect(recordFunnelEvent("onboarding.deploy_provision_failed", {}, record)).resolves.toBeUndefined();
  });
});
