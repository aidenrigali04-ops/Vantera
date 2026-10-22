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
describe("createTrialEndingStore separates the idempotence write from the lifecycle stamp", () => {
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

  // The whole point of the split: markTrialEndingNotified is the write that stops the 15-minute
  // agent-scheduler tick re-sending, and it runs AFTER the emails are out. If lifecycle_last_email_at
  // (migration 0060) rode in this same UPDATE, an unapplied migration would reject the statement
  // and trial_ending_notified_at would never land. Nothing else may be in this .set() payload.
  it("markTrialEndingNotified writes ONLY trialEndingNotifiedAt", async () => {
    const { db, sets } = fakeUpdateDb();
    await createTrialEndingStore(db).markTrialEndingNotified(["acc-1"]);
    expect(sets).toHaveLength(1);
    expect(Object.keys(sets[0]!)).toEqual(["trialEndingNotifiedAt"]);
    expect(sets[0]?.trialEndingNotifiedAt).toBeInstanceOf(Date);
  });

  it("stampLifecycleEmails writes ONLY lifecycleLastEmailAt, in its own UPDATE", async () => {
    const { db, sets, updateCalls } = fakeUpdateDb();
    const at = new Date("2026-07-19T00:00:00Z");
    await createTrialEndingStore(db).stampLifecycleEmails(["acc-1", "acc-2"], at);
    expect(updateCalls()).toBe(1);
    expect(sets).toEqual([{ lifecycleLastEmailAt: at }]);
  });

  it("is a no-op with an empty id list — no UPDATE attempted", async () => {
    const { db, updateCalls } = fakeUpdateDb();
    const store = createTrialEndingStore(db);
    await store.markTrialEndingNotified([]);
    await store.stampLifecycleEmails([], new Date());
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

