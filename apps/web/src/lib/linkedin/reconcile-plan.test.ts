import { describe, it, expect } from "vitest";
import type { ConnectedAccount } from "@vantera/linkedin-infra";
import { planLinkedInReconcile, type ExistingRow } from "./reconcile-plan";

const US = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const THEM = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

const NOW = Date.parse("2026-08-23T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

/** A return from the connect flow — the only context in which adoption is allowed. */
const onReturn = { adoptNew: true, now: NOW };
const background = { adoptNew: false, now: NOW };

const remote = (over: Partial<ConnectedAccount> = {}): ConnectedAccount => ({
  providerRef: "ref-new",
  displayName: "Jane Doe",
  createdAt: minutesAgo(1),
  profileUrl: "https://www.linkedin.com/in/jane",
  status: "active",
  ...over,
});

const row = (over: Partial<ExistingRow> = {}): ExistingRow => ({
  id: "row-1",
  account_id: US,
  provider_ref: "ref-old",
  profile_url: "https://www.linkedin.com/in/jane",
  status: "active",
  connected_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("planLinkedInReconcile — adopting a new connection", () => {
  it("adopts the connection the user just made", () => {
    const { ops } = planLinkedInReconcile(US, [remote()], [], onReturn);
    expect(ops).toEqual([
      {
        kind: "insert",
        providerRef: "ref-new",
        profileUrl: "https://www.linkedin.com/in/jane",
        displayName: "Jane Doe",
        status: "active",
        setConnectedAt: true,
      },
    ]);
  });

  // The provider list spans every tenant in the shared workspace and carries no tenant
  // marker, so an unclaimed account is only safely attributable to the person who just
  // finished a login. A background refresh has no such person.
  it("never adopts anything on a background refresh", () => {
    const { ops, unclaimed } = planLinkedInReconcile(US, [remote()], [], background);
    expect(ops).toEqual([]);
    expect(unclaimed).toBe(1);
  });

  it("ignores an unclaimed account too old to be the one just connected", () => {
    const { ops, unclaimed } = planLinkedInReconcile(US, [remote({ createdAt: minutesAgo(60) })], [], onReturn);
    expect(ops).toEqual([]);
    expect(unclaimed).toBe(1);
  });

  it("never adopts an account with no creation time, since it cannot be bounded", () => {
    const { ops } = planLinkedInReconcile(US, [remote({ createdAt: null })], [], onReturn);
    expect(ops).toEqual([]);
  });

  // One connect flow produces exactly one connection. Taking every unclaimed account was
  // how one tenant ended up holding another tenant's LinkedIn identity as a sender.
  it("adopts only the newest candidate, never a batch", () => {
    const provider = [
      remote({ providerRef: "ref-a", createdAt: minutesAgo(9), profileUrl: "https://www.linkedin.com/in/a" }),
      remote({ providerRef: "ref-b", createdAt: minutesAgo(1), profileUrl: "https://www.linkedin.com/in/b" }),
      remote({ providerRef: "ref-c", createdAt: minutesAgo(5), profileUrl: "https://www.linkedin.com/in/c" }),
    ];
    const { ops, unclaimed } = planLinkedInReconcile(US, provider, [], onReturn);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "insert", providerRef: "ref-b" });
    expect(unclaimed).toBe(2);
  });

  it("never touches a ref another tenant already holds", () => {
    const rows = [row({ id: "theirs", account_id: THEM, provider_ref: "ref-new" })];
    const { ops } = planLinkedInReconcile(US, [remote()], rows, onReturn);
    expect(ops).toEqual([]);
  });

  it("never claims another tenant's human by profile identity", () => {
    const rows = [row({ id: "theirs", account_id: THEM, provider_ref: "ref-other" })];
    const { ops } = planLinkedInReconcile(US, [remote()], rows, onReturn);
    expect(ops).toEqual([]);
  });
});

describe("planLinkedInReconcile — refresh and reconnect", () => {
  it("refreshes a row we already hold without touching its ramp clock", () => {
    const rows = [row({ provider_ref: "ref-new", status: "restricted" })];
    const { ops } = planLinkedInReconcile(US, [remote()], rows, background);
    expect(ops).toEqual([
      {
        kind: "update",
        rowId: "row-1",
        status: "active",
        profileUrl: "https://www.linkedin.com/in/jane",
        displayName: "Jane Doe",
        setConnectedAt: false,
      },
    ]);
  });

  // A row first written before the provider reported its sources has a null connected_at.
  // Downstream the ramp reads a null clock as "day zero", pinning the sender at the lowest
  // invite allowance forever — so the backfill has to happen the moment it goes active.
  it("backfills a missing connected_at when a row goes active", () => {
    const rows = [row({ provider_ref: "ref-new", status: "connecting", connected_at: null })];
    const { ops } = planLinkedInReconcile(US, [remote()], rows, background);
    expect(ops[0]).toMatchObject({ kind: "update", status: "active", setConnectedAt: true });
  });

  it("revives our existing row in place when the same human reconnects under a fresh ref", () => {
    const { ops } = planLinkedInReconcile(US, [remote()], [row()], background);
    expect(ops).toEqual([
      {
        kind: "reconnect",
        rowId: "row-1",
        providerRef: "ref-new",
        supersededRef: "ref-old",
        profileUrl: "https://www.linkedin.com/in/jane",
        displayName: "Jane Doe",
      },
    ]);
  });

  it("matches identity across url casing and trailing slashes", () => {
    const rows = [row({ profile_url: "https://WWW.LinkedIn.com/in/Jane/" })];
    const { ops } = planLinkedInReconcile(US, [remote()], rows, background);
    expect(ops[0]).toMatchObject({ kind: "reconnect", rowId: "row-1" });
  });

  it("does not adopt a dead duplicate as a reconnect", () => {
    const { ops } = planLinkedInReconcile(US, [remote({ status: "disconnected" })], [row()], background);
    expect(ops).toEqual([]);
  });
});

describe("planLinkedInReconcile — the connecting state", () => {
  it("inserts a still-settling connection as connecting, with no ramp clock yet", () => {
    const { ops } = planLinkedInReconcile(US, [remote({ status: "connecting" })], [], onReturn);
    expect(ops).toEqual([
      {
        kind: "insert",
        providerRef: "ref-new",
        profileUrl: "https://www.linkedin.com/in/jane",
        displayName: "Jane Doe",
        status: "connecting",
        setConnectedAt: false,
      },
    ]);
  });

  // 'connecting' means "the provider hasn't told us yet", so it must never demote a row
  // we already know is live — the profile metadata is still worth refreshing.
  it("never lets a connecting report overwrite a known status", () => {
    const rows = [row({ provider_ref: "ref-new", status: "active" })];
    const { ops } = planLinkedInReconcile(US, [remote({ status: "connecting" })], rows, background);
    expect(ops).toEqual([
      {
        kind: "update",
        rowId: "row-1",
        status: null,
        profileUrl: "https://www.linkedin.com/in/jane",
        displayName: "Jane Doe",
        setConnectedAt: false,
      },
    ]);
  });
});
