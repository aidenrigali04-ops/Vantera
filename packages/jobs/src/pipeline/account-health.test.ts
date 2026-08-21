import { describe, expect, it } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { buildDisconnectAlert, runAccountHealth } from "./account-health";
import type { AccountHealthDeps, AccountHealthStore, HealthAlert, LinkedInAccountRow } from "./account-health";

function makeStore(rows: LinkedInAccountRow[]) {
  const statusWrites: { id: string; status: string }[] = [];
  const reassigned: { fromIds: string[]; toId: string }[] = [];
  const deletedRows: string[][] = [];
  const repointed: { id: string; providerRef: string }[] = [];
  const store: AccountHealthStore = {
    listLinkedInAccounts: async () => rows,
    setLinkedInAccountStatus: async (id, status) => {
      statusWrites.push({ id, status });
    },
    reassignSenderHistory: async (fromIds, toId) => {
      reassigned.push({ fromIds, toId });
    },
    deleteLinkedInAccountRows: async (ids) => {
      deletedRows.push(ids);
    },
    repointLinkedInAccount: async (id, providerRef) => {
      repointed.push({ id, providerRef });
    },
    getAccountAdminEmails: async () => ["owner@acme.test"],
  };
  return { store, statusWrites, reassigned, deletedRows, repointed };
}

function makeDeps(
  store: AccountHealthStore,
  providerAccounts: { providerRef: string; status: "active" | "restricted" | "disconnected" }[]
) {
  const linkedin = new InMemoryLinkedInInfra();
  for (const a of providerAccounts) {
    linkedin.accounts.push({ providerRef: a.providerRef, displayName: null, profileUrl: null, status: a.status });
  }
  const sent: HealthAlert[] = [];
  const deps: AccountHealthDeps = {
    store,
    linkedin,
    send: async (alert) => {
      sent.push(alert);
    },
    appUrl: "https://app.test",
  };
  return { deps, linkedin, sent };
}

const row = (over: Partial<LinkedInAccountRow> = {}): LinkedInAccountRow => ({
  id: "li1",
  accountId: "acc1",
  providerRef: "ref1",
  status: "active",
  profileUrl: "https://www.linkedin.com/in/person-a",
  createdAt: new Date("2026-06-27T00:00:00Z"),
  assignedLeads: 0,
  ...over,
});

describe("runAccountHealth — status reconcile", () => {
  it("reconciles a stale 'active' row when the provider reports the session dead, and alerts the admins", async () => {
    const { store, statusWrites } = makeStore([row()]);
    // CREDENTIALS-type failures surface as 'restricted' from the provider mapping
    const { deps, sent } = makeDeps(store, [{ providerRef: "ref1", status: "restricted" }]);

    const summary = await runAccountHealth(deps);

    expect(statusWrites).toEqual([{ id: "li1", status: "restricted" }]);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("owner@acme.test");
    expect(sent[0]!.subject).toMatch(/LinkedIn/);
    expect(summary).toMatchObject({ status: "completed", checked: 1, reconciled: 1, alerted: 1 });
  });

  it("a row the provider no longer holds at all is disconnected", async () => {
    const { store, statusWrites } = makeStore([row()]);
    const { deps } = makeDeps(store, []); // provider workspace is empty

    await runAccountHealth(deps);

    expect(statusWrites).toEqual([{ id: "li1", status: "disconnected" }]);
  });

  it("matching statuses write nothing and alert no one", async () => {
    const { store, statusWrites } = makeStore([row()]);
    const { deps, sent } = makeDeps(store, [{ providerRef: "ref1", status: "active" }]);

    const summary = await runAccountHealth(deps);

    expect(statusWrites).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(summary.reconciled).toBe(0);
  });

  it("a reconnect flips the row back to active WITHOUT an alert (only healthy→unhealthy alerts)", async () => {
    const { store, statusWrites } = makeStore([row({ status: "disconnected" })]);
    const { deps, sent } = makeDeps(store, [{ providerRef: "ref1", status: "active" }]);

    await runAccountHealth(deps);

    expect(statusWrites).toEqual([{ id: "li1", status: "active" }]);
    expect(sent).toHaveLength(0);
  });

  it("mid-flow 'connecting' rows are left alone — the connect webhook owns that state", async () => {
    const { store, statusWrites } = makeStore([row({ status: "connecting" })]);
    const { deps } = makeDeps(store, []);

    await runAccountHealth(deps);

    expect(statusWrites).toHaveLength(0);
  });

  it("an unreachable provider reconciles NOTHING — a transient outage must not pause healthy tenants", async () => {
    const { store, statusWrites } = makeStore([row()]);
    const { deps } = makeDeps(store, []);
    deps.linkedin = {
      listAccounts: async () => {
        throw new Error("503");
      },
      deleteConnectedAccount: async () => {},
    };

    const summary = await runAccountHealth(deps);

    expect(summary).toMatchObject({ status: "skipped", reconciled: 0 });
    expect(statusWrites).toHaveLength(0);
  });

  it("a failing alert send never blocks the status write", async () => {
    const { store, statusWrites } = makeStore([row()]);
    const { deps } = makeDeps(store, [{ providerRef: "ref1", status: "disconnected" }]);
    deps.send = async () => {
      throw new Error("mail down");
    };

    const summary = await runAccountHealth(deps);

    expect(statusWrites).toEqual([{ id: "li1", status: "disconnected" }]);
    expect(summary).toMatchObject({ reconciled: 1, alerted: 0 });
  });
});

describe("runAccountHealth — duplicate-seat sweep", () => {
  // The 2026-07-08 prod scenario: a reconnect minted TWO fresh provider accounts for the
  // same human; the original row (all the lead history) sat 'restricted' on a dead ref.
  // Factories, not shared objects — each test gets fresh fixtures.
  const original = () =>
    row({
      id: "orig",
      providerRef: "dead_ref",
      status: "restricted",
      assignedLeads: 82,
      createdAt: new Date("2026-06-27T00:00:00Z"),
    });
  const dupA = () =>
    row({
      id: "dupA",
      providerRef: "new_ref_a",
      status: "active",
      assignedLeads: 0,
      createdAt: new Date("2026-07-08T09:04:29Z"),
    });
  const dupB = () =>
    row({
      id: "dupB",
      providerRef: "new_ref_b",
      status: "active",
      assignedLeads: 0,
      createdAt: new Date("2026-07-08T09:04:58Z"),
    });

  it("merges same-identity rows onto the history keeper, points it at the live seat, deletes the rest", async () => {
    const { store, repointed, reassigned, deletedRows, statusWrites } = makeStore([original(), dupA(), dupB()]);
    const { deps, linkedin, sent } = makeDeps(store, [
      { providerRef: "dead_ref", status: "restricted" },
      { providerRef: "new_ref_a", status: "active" },
      { providerRef: "new_ref_b", status: "active" },
    ]);

    const summary = await runAccountHealth(deps);

    // keeper = the row with the lead history, revived onto the NEWEST live connection
    expect(reassigned).toEqual([{ fromIds: ["dupA", "dupB"], toId: "orig" }]);
    expect(deletedRows).toEqual([["dupA", "dupB"]]);
    expect(repointed).toEqual([{ id: "orig", providerRef: "new_ref_b" }]);
    // superseded seats deleted provider-side: the dead one AND the extra live one
    expect(linkedin.disconnected.sort()).toEqual(["dead_ref", "new_ref_a"]);
    expect(summary.merged).toBe(2);
    // the keeper is live now — no status flip-flop, no disconnect alert
    expect(statusWrites).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("all connections dead → rows still merge to one, keeper keeps its ref, reconcile flags it", async () => {
    const { store, repointed, deletedRows, statusWrites } = makeStore([
      { ...original(), status: "active" }, // stale-active: nobody told us yet
      dupA(),
    ]);
    const { deps, linkedin, sent } = makeDeps(store, [
      { providerRef: "dead_ref", status: "restricted" },
      { providerRef: "new_ref_a", status: "restricted" },
    ]);

    const summary = await runAccountHealth(deps);

    expect(deletedRows).toEqual([["dupA"]]);
    expect(repointed).toHaveLength(0); // nothing live to repoint to
    expect(linkedin.disconnected).toEqual(["new_ref_a"]);
    // keeper was stale-active and its ref is dead → reconciled + alerted
    expect(statusWrites).toEqual([{ id: "orig", status: "restricted" }]);
    expect(sent).toHaveLength(1);
    expect(summary.merged).toBe(1);
  });

  it("different humans on the same tenant never merge", async () => {
    const { store, deletedRows } = makeStore([
      row({ id: "a", providerRef: "r1", profileUrl: "https://linkedin.com/in/person-a" }),
      row({ id: "b", providerRef: "r2", profileUrl: "https://linkedin.com/in/person-b" }),
    ]);
    const { deps } = makeDeps(store, [
      { providerRef: "r1", status: "active" },
      { providerRef: "r2", status: "active" },
    ]);

    const summary = await runAccountHealth(deps);

    expect(deletedRows).toHaveLength(0);
    expect(summary.merged).toBe(0);
  });

  it("the same human on two different tenants never merges (identity is per-tenant)", async () => {
    const { store, deletedRows } = makeStore([
      row({ id: "a", accountId: "acc1", providerRef: "r1" }),
      row({ id: "b", accountId: "acc2", providerRef: "r2" }),
    ]);
    const { deps } = makeDeps(store, [
      { providerRef: "r1", status: "active" },
      { providerRef: "r2", status: "active" },
    ]);

    const summary = await runAccountHealth(deps);

    expect(deletedRows).toHaveLength(0);
    expect(summary.merged).toBe(0);
  });
});

describe("buildDisconnectAlert", () => {
  it("is white-label (no vendor names) and links the reconnect surface", () => {
    const alert = buildDisconnectAlert("a@b.c", "https://app.test");
    const all = `${alert.subject} ${alert.html} ${alert.text}`;
    expect(all).not.toMatch(/unipile/i);
    expect(alert.text).toContain("https://app.test/settings/channels");
    expect(alert.html).toContain("https://app.test/settings/channels");
  });
});
