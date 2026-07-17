import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { type Db, createDb, sequenceRuns, campaignLeads, optimizationPlaybook } from "@vantera/db";
import { createPgStore, toLeadSignalRow } from "./pg-store";

describe("toLeadSignalRow", () => {
  it("maps a provider signal to a lead_signals row with an ISO→Date observed_at", () => {
    expect(
      toLeadSignalRow("acc", "lead", {
        kind: "funding",
        label: "Raised new funding",
        detail: "Series B, $40M",
        observedAt: "2026-06-01",
      })
    ).toEqual({
      accountId: "acc",
      leadId: "lead",
      kind: "funding",
      label: "Raised new funding",
      detail: "Series B, $40M",
      level: undefined,
      observedAt: new Date("2026-06-01"),
      source: "prospect-data",
    });
  });

  it("falls back to detail for the label and null for a missing observed_at", () => {
    const row = toLeadSignalRow("acc", "lead", { kind: "intent", detail: "Sales Automation", level: "in_depth" });
    expect(row.label).toBe("Sales Automation");
    expect(row.observedAt).toBeNull();
    expect(row.level).toBe("in_depth");
  });
});

// pg-store has no DB integration harness in this repo (siblings are pure-function
// unit tests). createPgStore only wires closures over `db` — it touches no rows at
// construction — so this is a signature/shape check that the SequenceStore methods
// are wired onto the returned store. Behavioral coverage lives in the pure cores
// (sequence-advance.test.ts) and the query shapes are guarded by type-check.
describe("createPgStore: sequence store surface", () => {
  const store = createPgStore(undefined as unknown as Db);

  it("exposes the SequenceStore methods", () => {
    expect(typeof store.getDueSequenceRuns).toBe("function");
    expect(typeof store.suppressionFlags).toBe("function");
    expect(typeof store.applyRunPatch).toBe("function");
    expect(typeof store.archiveLead).toBe("function");
    expect(typeof store.enrollPendingLeads).toBe("function");
    expect(typeof store.isKillSwitchOn).toBe("function");
  });

  it("applyRunPatch is the optimistic claim (runId, expectNextActionAt, patch)", () => {
    // 3-arity guard: a stale expectNextActionAt is what makes a second tick a no-op.
    expect(store.applyRunPatch.length).toBe(3);
  });
});

// Regression guard for the enrollPendingLeads enrolment query. type-check does NOT catch this
// class of bug: Drizzle's insert().select() requires the projection to enumerate every table
// column in order (haveSameKeys), so a partial projection throws at runtime build time — exactly
// what type-check cannot see. These build the queries offline (postgres-js connects lazily, so
// .toSQL() never opens a socket) to lock the shape.
describe("enrollPendingLeads enrolment query shape", () => {
  // dummy URL (no credentials): postgres-js does not connect until a query executes; .toSQL() only builds.
  const db = createDb("postgresql://localhost:5432/db");

  it("inserts the column subset via .values() (defaults fill the rest) with the idempotent ON CONFLICT", () => {
    const build = () =>
      db
        .insert(sequenceRuns)
        .values([
          {
            accountId: "00000000-0000-0000-0000-000000000001",
            campaignId: "00000000-0000-0000-0000-000000000002",
            leadId: "00000000-0000-0000-0000-000000000003",
            nextActionAt: new Date("2026-06-17T00:00:00Z"),
          },
        ])
        .onConflictDoNothing({ target: [sequenceRuns.campaignId, sequenceRuns.leadId] })
        .returning({ id: sequenceRuns.id })
        .toSQL();
    expect(build).not.toThrow();
    const { sql: text } = build();
    expect(text).toMatch(/insert into "sequence_runs"/i);
    expect(text).toMatch(/on conflict/i);
  });

  it("rejects INSERT…SELECT — Drizzle demands all 13 columns in order, which is why enrol uses .values()", () => {
    expect(() =>
      db.insert(sequenceRuns).select((qb) =>
        qb
          .select({
            accountId: campaignLeads.accountId,
            campaignId: campaignLeads.campaignId,
            leadId: campaignLeads.leadId,
            nextActionAt: sql`now()`.as("next_action_at"),
          })
          .from(campaignLeads)
      )
    ).toThrow(/selected fields are not the same/);
  });
});

// ── concludeExperiment wealth credit (Task 7 / WS-1.1 review fix) ─────────────────────────────
// The alpha-investing EARN rule was calibrated (calibration.test.ts's CHAINED FAMILY gate) with
// halts explicitly EXCLUDED from earning ("a safety stop, not a statistical conclusion") — the
// production ledger must match that family-wise evidence, or the measured guarantee doesn't
// describe production (reviewer measured crediting halts launches ~5.6-5.8 of 10 chain
// experiments vs the calibrated ~4.0). No DB harness exists in this repo, so this drives
// concludeExperiment through a minimal fake transaction that records which tables get written:
// the credit is an INSERT..ON CONFLICT upsert into optimization_playbook, so "did the playbook
// get an insert" is exactly "did the credit fire".
describe("concludeExperiment wealth credit", () => {
  type RecordedInsert = { table: unknown; values: Record<string, unknown> };

  function fakeTransactionDb(updateReturns: { accountId: string }[]) {
    const inserts: RecordedInsert[] = [];
    let updates = 0;
    const tx = {
      update: (_table: unknown) => ({
        set: (_vals: unknown) => ({
          where: (_cond: unknown) => ({
            returning: (_sel: unknown) => {
              updates++;
              return Promise.resolve(updateReturns);
            },
          }),
        }),
      }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoUpdate: (_cfg: unknown) => {
            inserts.push({ table, values });
            return Promise.resolve();
          },
        }),
      }),
    };
    const db = {
      transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => fn(tx),
    };
    return { db: db as unknown as Db, inserts, updateCount: () => updates };
  }

  it("credits the playbook on a discard transition (decisive conclusion earns)", async () => {
    const { db, inserts } = fakeTransactionDb([{ accountId: "acct-1" }]);
    await createPgStore(db).concludeExperiment("e1", "discarded", "champion holds");
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.table).toBe(optimizationPlaybook);
  });

  it("does NOT credit on a halt transition — a safety stop is not a statistical conclusion", async () => {
    // Matches calibration.test.ts's applyEarn: only adopt/discard earn; a breaker halt does not.
    const { db, inserts, updateCount } = fakeTransactionDb([{ accountId: "acct-1" }]);
    await createPgStore(db).concludeExperiment("e1", "halted", "harmful challenger");
    expect(updateCount()).toBe(1); // the experiment still concludes (status flip happens)
    expect(inserts).toHaveLength(0); // ...but earns nothing back
  });

  it("does NOT credit when the row was already terminal (no transition happened)", async () => {
    // The status-guarded UPDATE returned no row — a repeat call must stay a no-op credit-wise.
    const { db, inserts } = fakeTransactionDb([]);
    await createPgStore(db).concludeExperiment("e1", "discarded", "again");
    expect(inserts).toHaveLength(0);
  });
});

// Regression: a prospect with no email/phone/tech enrichment must not trigger an empty UPDATE.
describe("saveEnrichment with no persistable fields", () => {
  const store = createPgStore(createDb("postgresql://localhost:5432/db"));

  it("skips the UPDATE instead of throwing Drizzle 'No values to set'", async () => {
    // all enrich fields undefined → empty patch → no db call → resolves (offline, no connection)
    await expect(
      store.saveEnrichment(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        { externalRef: "r1", companyName: "Acme" }
      )
    ).resolves.toBeUndefined();
  });
});

