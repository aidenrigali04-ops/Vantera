import { describe, expect, it } from "vitest";
import { planClaimsAnything, planReconcile, type ProviderAccountLike } from "./reconcile-plan";

const TENANT = "tenant-a";
const OTHER = "tenant-b";

const acct = (ref: string, over: Partial<ProviderAccountLike> = {}): ProviderAccountLike => ({
  providerRef: ref,
  displayName: `member ${ref}`,
  profileUrl: `https://www.linkedin.com/in/${ref}`,
  status: "active",
  ...over,
});
const row = (id: string, accountId: string, providerRef: string, profileUrl: string | null = `https://www.linkedin.com/in/${providerRef}`) => ({
  id,
  accountId,
  providerRef,
  profileUrl,
});

describe("planReconcile", () => {
  it("claims an unowned identity for this tenant", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1")],
      existingRows: [],
    });
    expect(plan).toEqual([{ kind: "insert", account: acct("a1") }]);
    expect(planClaimsAnything(plan)).toBe(true);
  });

  it("refreshes an identity this tenant already owns", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1")],
      existingRows: [row("row-1", TENANT, "a1")],
    });
    expect(plan).toEqual([{ kind: "update", rowId: "row-1", account: acct("a1") }]);
  });

  it("NEVER re-claims an identity owned by another tenant", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1")],
      existingRows: [row("row-1", OTHER, "a1")],
    });
    expect(plan).toEqual([{ kind: "skip", providerRef: "a1", reason: "owned-by-other-tenant" }]);
    expect(planClaimsAnything(plan)).toBe(false);
  });

  it("scoped to one providerRef, leaves every other unowned identity alone", () => {
    // The provider workspace is shared: an unscoped sync would hand all three to this tenant.
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1"), acct("a2"), acct("a3")],
      existingRows: [],
      providerRef: "a2",
    });
    expect(plan).toEqual([
      { kind: "skip", providerRef: "a1", reason: "out-of-scope" },
      { kind: "insert", account: acct("a2") },
      { kind: "skip", providerRef: "a3", reason: "out-of-scope" },
    ]);
  });

  it("scoping does not defeat the cross-tenant guard (a hand-typed ref cannot steal)", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1")],
      existingRows: [row("row-1", OTHER, "a1")],
      providerRef: "a1",
    });
    expect(plan).toEqual([{ kind: "skip", providerRef: "a1", reason: "owned-by-other-tenant" }]);
  });

  it("a scoped ref the provider doesn't list yields no claim at all", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1")],
      existingRows: [],
      providerRef: "does-not-exist",
    });
    expect(planClaimsAnything(plan)).toBe(false);
  });

  it("unscoped sync still reconciles every identity this tenant may hold", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1"), acct("a2")],
      existingRows: [row("row-1", TENANT, "a1")],
      providerRef: null,
    });
    expect(plan).toEqual([
      { kind: "update", rowId: "row-1", account: acct("a1") },
      { kind: "insert", account: acct("a2") },
    ]);
  });

  it("treats a blank providerRef as an unscoped sync, not a match-nothing filter", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("a1")],
      existingRows: [],
      providerRef: "   ",
    });
    expect(plan).toEqual([{ kind: "insert", account: acct("a1") }]);
  });
});

describe("planReconcile — profile identity (the 2026-07-08 triple-seat rule)", () => {
  const HUMAN = "https://www.linkedin.com/in/jane-doe/";

  it("revives OUR existing row when the same human reconnects under a fresh provider ref", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("new-ref", { profileUrl: "https://linkedin.com/in/jane-doe" })],
      existingRows: [row("row-1", TENANT, "old-ref", HUMAN)],
    });
    expect(plan).toEqual([
      { kind: "revive", rowId: "row-1", oldProviderRef: "old-ref", account: acct("new-ref", { profileUrl: "https://linkedin.com/in/jane-doe" }) },
    ]);
    expect(planClaimsAnything(plan)).toBe(true);
  });

  it("never claims a fresh ref whose PROFILE another tenant already holds", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("new-ref", { profileUrl: HUMAN })],
      existingRows: [row("row-1", OTHER, "their-ref", HUMAN)],
    });
    expect(plan).toEqual([{ kind: "skip", providerRef: "new-ref", reason: "identity-held-by-other-tenant" }]);
  });

  it("does not adopt a dead duplicate of a human we already hold", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("new-ref", { profileUrl: HUMAN, status: "disconnected" })],
      existingRows: [row("row-1", TENANT, "old-ref", HUMAN)],
    });
    expect(plan).toEqual([{ kind: "skip", providerRef: "new-ref", reason: "dead-duplicate" }]);
  });

  it("matches identity across casing and trailing slashes, and ignores rows with no profile", () => {
    const plan = planReconcile({
      accountId: TENANT,
      providerAccounts: [acct("new-ref", { profileUrl: "HTTPS://WWW.LinkedIn.com/in/Jane-Doe" })],
      existingRows: [row("row-0", TENANT, "x", null), row("row-1", TENANT, "old-ref", HUMAN)],
    });
    expect(plan[0]?.kind).toBe("revive");
  });
});
