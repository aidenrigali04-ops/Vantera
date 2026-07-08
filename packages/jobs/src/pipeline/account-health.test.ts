import { describe, expect, it } from "vitest";
import { InMemoryLinkedInInfra } from "@vantera/linkedin-infra";
import { buildDisconnectAlert, runAccountHealth } from "./account-health";
import type { AccountHealthDeps, AccountHealthStore, HealthAlert, LinkedInAccountRow } from "./account-health";

function makeStore(rows: LinkedInAccountRow[]) {
  const statusWrites: { id: string; status: string }[] = [];
  const store: AccountHealthStore = {
    listLinkedInAccounts: async () => rows,
    setLinkedInAccountStatus: async (id, status) => {
      statusWrites.push({ id, status });
    },
    getAccountAdminEmails: async () => ["owner@acme.test"],
  };
  return { store, statusWrites };
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
  return { deps, sent };
}

const row = (over: Partial<LinkedInAccountRow> = {}): LinkedInAccountRow => ({
  id: "li1",
  accountId: "acc1",
  providerRef: "ref1",
  status: "active",
  ...over,
});

describe("runAccountHealth", () => {
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

  it("an unreachable provider reconciles NOTHING — a transient outage must not pause healthy tenants", async () => {
    const { store, statusWrites } = makeStore([row()]);
    const { deps } = makeDeps(store, []);
    deps.linkedin = {
      listAccounts: async () => {
        throw new Error("503");
      },
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

describe("buildDisconnectAlert", () => {
  it("is white-label (no vendor names) and links the reconnect surface", () => {
    const alert = buildDisconnectAlert("a@b.c", "https://app.test");
    const all = `${alert.subject} ${alert.html} ${alert.text}`;
    expect(all).not.toMatch(/unipile/i);
    expect(alert.text).toContain("https://app.test/settings/channels");
    expect(alert.html).toContain("https://app.test/settings/channels");
  });
});
