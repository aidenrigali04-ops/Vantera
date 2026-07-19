import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { type Db, createDb, sequenceRuns, campaignLeads, optimizationPlaybook } from "@vantera/db";
import {
  createLeadEventEmailStore,
  createPgStore,
  createTrialEndingStore,
  createWeeklySummaryStore,
  toLeadSignalRow,
} from "./pg-store";

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

  it("does NOT credit an administrative conclusion ({ credit: false } — the identical-arm heal)", async () => {
    // The heal path concludes as "discarded" but is a slot-freeing cleanup, not a decisive
    // verdict — and it typically closes an UNFUNDED manual experiment, so crediting it would
    // mint alpha wealth that was never spent. The caller opts out; the status flip still runs.
    const { db, inserts, updateCount } = fakeTransactionDb([{ accountId: "acct-1" }]);
    await createPgStore(db).concludeExperiment("e1", "discarded", "identical arms — heal", {
      credit: false,
    });
    expect(updateCount()).toBe(1);
    expect(inserts).toHaveLength(0);
  });
});

// ── adoptChallenger claim-first ordering (WS-3.2 review fix) ────────────────────────────────
// GATE 1's auto-adopt tick is the first concurrent actor racing the owner's manual dashboard
// buttons (discard/adopt), which also transition this same experiment row. adoptChallenger's
// status-guarded claim (UPDATE ... WHERE status IN (running, ready_to_adopt) RETURNING) must run
// FIRST and gate EVERY subsequent write — a claim that returns no row means someone else already
// transitioned the experiment, and the playbook must be left untouched. The original ordering
// wrote the playbook unconditionally (guarded only by "does a row with this id exist", true
// regardless of status) and gated only the wealth credit on the claim, so a lost race could still
// commit a rejected challenger as the account's champion. No DB harness exists in this repo (see
// the concludeExperiment suite above) — this drives adoptChallenger through a minimal fake
// transaction that records every select/insert, so "did the playbook get written" is directly
// observable.
describe("adoptChallenger claim-first ordering", () => {
  type RecordedInsert = { table: unknown; values: Record<string, unknown> };

  function fakeAdoptTx(
    claimReturns: { accountId: string; challengerStrategy: unknown }[],
    playbookVersionRow?: { version: number }
  ) {
    const inserts: RecordedInsert[] = [];
    let updates = 0;
    let selects = 0;
    const tx = {
      update: (_table: unknown) => ({
        set: (_vals: unknown) => ({
          where: (_cond: unknown) => ({
            returning: (_sel: unknown) => {
              updates++;
              return Promise.resolve(claimReturns);
            },
          }),
        }),
      }),
      select: (_sel: unknown) => ({
        from: (_table: unknown) => ({
          where: (_cond: unknown) => ({
            limit: (_n: number) => {
              selects++;
              return Promise.resolve(playbookVersionRow ? [playbookVersionRow] : []);
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
    return {
      db: db as unknown as Db,
      inserts,
      updateCount: () => updates,
      selectCount: () => selects,
    };
  }

  it("returns null and leaves the playbook untouched when the claim fails (row already terminal)", async () => {
    // Simulates the exact race: the owner's own discard/adopt action already transitioned this
    // row out of running/ready_to_adopt, so the status-guarded UPDATE...RETURNING matches zero
    // rows before this call ever gets a chance to write anything.
    const { db, inserts, updateCount, selectCount } = fakeAdoptTx([]);

    const result = await createPgStore(db).adoptChallenger("e1", "grace re-check still wins");

    expect(result).toBeNull();
    expect(updateCount()).toBe(1); // the claim was attempted
    expect(selectCount()).toBe(0); // never even reads the playbook version
    expect(inserts).toHaveLength(0); // — and never writes it
  });

  it("adopts on a successful claim: writes the playbook, credits wealth, returns the champion", async () => {
    const challengerStrategy = { openWith: "trigger" };
    const { db, inserts } = fakeAdoptTx([{ accountId: "acct-1", challengerStrategy }], { version: 2 });

    const result = await createPgStore(db).adoptChallenger("e1", "grace re-check still wins");

    expect(result).toEqual(challengerStrategy);
    expect(inserts).toHaveLength(2); // champion write + wealth credit, both playbook upserts
    expect(inserts[0]?.table).toBe(optimizationPlaybook);
    expect(inserts[0]?.values).toMatchObject({
      accountId: "acct-1",
      championStrategy: challengerStrategy,
      version: 3, // cur.version (2) + 1
    });
    expect(inserts[1]?.table).toBe(optimizationPlaybook); // creditAlphaWealth's own upsert
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

// ── lifecycle_last_email_at stamping (Task 8) ─────────────────────────────────────────────────
// The pull-back collision guard reads accounts.lifecycle_last_email_at and yields for 48h after
// ANY other lifecycle email. trial-ending.test.ts's own coverage stubs the store entirely, so it
// cannot catch a regression in what the REAL store writes — these tests drive the real
// createTrialEndingStore/createWeeklySummaryStore through a minimal fake `db` that records the
// UPDATE's .set() payload, same fake-db idiom as the concludeExperiment/adoptChallenger suites
// above (no DB harness exists in this repo).
describe("createTrialEndingStore.markTrialEndingNotified stamps lifecycle_last_email_at", () => {
  function fakeUpdateDb() {
    const sets: Record<string, unknown>[] = [];
    let updateCalls = 0;
    const db = {
      update: (_table: unknown) => {
        updateCalls++;
        return {
          set: (vals: Record<string, unknown>) => {
            sets.push(vals);
            return { where: (_cond: unknown) => Promise.resolve() };
          },
        };
      },
    };
    return { db: db as unknown as Db, sets, updateCalls: () => updateCalls };
  }

  it("sets trialEndingNotifiedAt AND lifecycleLastEmailAt to the same instant in one UPDATE", async () => {
    const { db, sets } = fakeUpdateDb();
    await createTrialEndingStore(db).markTrialEndingNotified(["acc-1"]);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.trialEndingNotifiedAt).toBeInstanceOf(Date);
    expect(sets[0]?.lifecycleLastEmailAt).toBeInstanceOf(Date);
    expect(sets[0]?.trialEndingNotifiedAt).toBe(sets[0]?.lifecycleLastEmailAt);
  });

  it("is a no-op with an empty id list — no UPDATE attempted", async () => {
    const { db, updateCalls } = fakeUpdateDb();
    await createTrialEndingStore(db).markTrialEndingNotified([]);
    expect(updateCalls()).toBe(0);
  });
});

describe("createWeeklySummaryStore.stampLifecycleEmail", () => {
  it("UPDATEs only lifecycle_last_email_at for the given account", async () => {
    const sets: Record<string, unknown>[] = [];
    const db = {
      update: (_table: unknown) => ({
        set: (vals: Record<string, unknown>) => {
          sets.push(vals);
          return { where: (_cond: unknown) => Promise.resolve() };
        },
      }),
    } as unknown as Db;
    const at = new Date("2026-07-19T00:00:00Z");
    await createWeeklySummaryStore(db).stampLifecycleEmail!("acc-1", at);
    expect(sets).toEqual([{ lifecycleLastEmailAt: at }]);
  });
});

// Fix round 1: the lead-event sender (interested_reply/meeting_booked/needs_human) was the one
// sender Task 8 missed — same regression-coverage reasoning as the two describe blocks above:
// createLeadEventNotifier's own tests stub stampLifecycleEmail entirely, so they cannot catch a
// bug in what the REAL store writes.
describe("createLeadEventEmailStore.stampLifecycleEmail", () => {
  it("UPDATEs only lifecycle_last_email_at for the given account", async () => {
    const sets: Record<string, unknown>[] = [];
    const db = {
      update: (_table: unknown) => ({
        set: (vals: Record<string, unknown>) => {
          sets.push(vals);
          return { where: (_cond: unknown) => Promise.resolve() };
        },
      }),
    } as unknown as Db;
    const at = new Date("2026-07-19T00:00:00Z");
    await createLeadEventEmailStore(db).stampLifecycleEmail("acc-1", at);
    expect(sets).toEqual([{ lifecycleLastEmailAt: at }]);
  });
});

