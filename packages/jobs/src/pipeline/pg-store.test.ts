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


// A reply must never demote a closed-won lead: status='converted' is the close-stage label the
// CRM push and conversion metrics depend on. setLeadReplied guards the leads UPDATE in SQL.
describe("setLeadReplied never overwrites a converted lead", () => {
  it("scopes the leads UPDATE to status <> 'converted'", async () => {
    const { PgDialect } = await import("drizzle-orm/pg-core");
    const wheres: unknown[] = [];
    const db = {
      update: (_table: unknown) => ({
        set: (_vals: Record<string, unknown>) => ({
          where: (cond: unknown) => {
            wheres.push(cond);
            return Promise.resolve();
          },
        }),
      }),
    };
    await createPgStore(db as unknown as Db).setLeadReplied("lead-1", null);
    expect(wheres).toHaveLength(1);
    const q = new PgDialect().sqlToQuery(wheres[0] as never);
    expect(q.sql).toMatch(/"status" <> \$\d/);
    expect(q.params).toContain("converted");
  });
});

// Right-censoring: an invite younger than the maturation window hasn't had time to be accepted or
// answered, so counting it as a failure biases the ICP allocator + tilt against new segments.
// The outcome rows behind both read only matured invites.
describe("outcome rows read only matured invites", () => {
  it("bounds linkedin_invited_at by the maturation cutoff", async () => {
    const { PgDialect } = await import("drizzle-orm/pg-core");
    const { OUTCOME_MATURATION_DAYS } = await import("./pg-store");
    const wheres: unknown[] = [];
    const db = {
      select: () => ({
        from: () => ({
          where: (cond: unknown) => {
            wheres.push(cond);
            return Promise.resolve([]);
          },
        }),
      }),
    };
    const before = Date.now();
    await createPgStore(db as unknown as Db).getIcpOutcomeRows("acc-1");
    const q = new PgDialect().sqlToQuery(wheres[0] as never);
    expect(q.sql).toMatch(/"linkedin_invited_at" <= \$\d/);
    const cutoff = q.params.find((p) => typeof p === "string" && /^\d{4}-\d{2}-\d{2}T/.test(p)) as string;
    const ageDays = (before - new Date(cutoff).getTime()) / 86_400_000;
    expect(Math.round(ageDays)).toBe(OUTCOME_MATURATION_DAYS);
  });
});

// Regression: in a select list drizzle renders ${leads.id} as a bare "id" — inside a correlated
// subquery that binds to the subquery's own table (lead_signals.id), silently matching nothing.
describe("learner feature columns correlate on the OUTER lead id", () => {
  it("qualifies leads.id inside every subquery", async () => {
    const { learnerFeatureCols } = await import("./pg-store");
    const { leads } = await import("@vantera/db");
    const db = createDb("postgresql://localhost:5432/db");
    const q = db.select(learnerFeatureCols).from(leads).toSQL().sql;
    expect(q.match(/ls\.lead_id = "leads"\."id"/g)?.length).toBe(2);
    expect(q).not.toMatch(/lead_id = "id"/);
  });
});

// ML-4: a "Not a fit" verdict keeps a lead out of drafting — correlated on the OUTER lead id.
describe("notMarkedNotFit", () => {
  it("excludes leads with a not_fit verdict, correlated on leads.id", async () => {
    const { notMarkedNotFit } = await import("./pg-store");
    const { leads } = await import("@vantera/db");
    const db = createDb("postgresql://localhost:5432/db");
    const q = db.select({ id: leads.id }).from(leads).where(notMarkedNotFit).toSQL().sql;
    expect(q).toContain('not exists (select 1 from "lead_feedback" f where f.lead_id = "leads"."id" and f.verdict = \'not_fit\')');
  });
});

describe("mergeExemplars", () => {
  it("merges sources newest first, dedupes lines, caps the result", async () => {
    const { mergeExemplars } = await import("./pg-store");
    const d = (iso: string) => new Date(iso);
    const out = mergeExemplars(
      [
        [{ line: "A", at: d("2026-10-01") }, { line: "B", at: d("2026-10-05") }],
        [{ line: "B", at: d("2026-10-03") }, { line: "C", at: d("2026-10-10") }],
      ],
      2
    );
    expect(out).toEqual(["C", "B"]);
  });
});

// ML-7 guardrail: the service role bypasses RLS, so tenant isolation for lead_embeddings lives in
// the queries — every statement touching the table must scope by account (rls-auditor 2026-10-21).
describe("lead_embeddings queries are always account-scoped", () => {
  it("every reference sits in a statement that filters or joins on the account", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./pg-store.ts", import.meta.url), "utf8");
    // every use (the bare `  leadEmbeddings,` import-list entry is not a query)
    const refs = [...src.matchAll(/leadEmbeddings/g)]
      .map((m) => m.index!)
      .filter((at) => !/^\s*leadEmbeddings,\s*$/.test(src.slice(src.lastIndexOf("\n", at) + 1, src.indexOf("\n", at))));
    expect(refs.length).toBeGreaterThan(3);
    for (const at of refs) {
      const window = src.slice(Math.max(0, at - 700), at + 700);
      expect(window, `lead_embeddings reference near offset ${at}`).toMatch(/account_id|accountId/);
    }
  });
});
