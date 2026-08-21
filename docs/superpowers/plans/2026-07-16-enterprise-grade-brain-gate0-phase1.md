# Enterprise-Grade Brain — GATE 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship GATE 0 (autonomous adoption → suggest-only + live A/A canary) and Phase 1 foundations (schedule-quota guardrail, /api/version + post-deploy verification, migration drift check, prompt registry, statistics simulation harness) of the enterprise-grade-brain spec.

**Architecture:** Every change follows the locked repo skeleton — pure pipeline cores in `packages/jobs/src/pipeline/` with deps injected via `types.ts` interfaces and drizzle only in `pg-store.ts`; pure brains in `packages/agent-brains`; guardrail tests for locked decisions; thin trigger wrappers. GATE 0 reuses the existing `ready_to_adopt` status + manual adopt UI (already live in `optimize-actions.ts`) — no migration, no new UI. The A/A canary is a normal experiment whose challenger deep-equals its champion, detected by `strategySignature` equality — no schema change.

**Tech Stack:** TypeScript strict, Vitest 4, Trigger.dev v4, Drizzle/Supabase Postgres, Next.js App Router, GitHub Actions, pnpm + Turborepo.

**Spec:** `docs/superpowers/specs/2026-07-16-enterprise-grade-brain-optimization-design.md` (GREEN-LIT v1.0)

## Global Constraints

- Branch: `phase-egb-gate0-foundations` off the current tip (`trial-on-connect` = origin/main). Merge to main only with `pnpm lint && pnpm type-check && pnpm test && pnpm build` green (rule 12).
- TDD for all product code: write the failing test first, watch it fail, implement, watch it pass, commit (superpowers:test-driven-development).
- Brains stay pure (no Trigger.dev/drizzle/DB imports — `purity.test.ts` enforces). Pipeline cores stay pure (deps injected; drizzle only in `pg-store.ts` — `structure.test.ts` enforces).
- Only `packages/ai` imports `@ai-sdk/*` (`single-entry.test.ts` enforces).
- No vendor names on user-facing surfaces. No new `schedules.task()` registrations — quota is 10/10 (prod-ops gotcha 2026-07-16); new periodic work piggybacks the agent-scheduler tick.
- Tests are colocated `*.test.ts`. No `any`, no `@ts-ignore`.
- Commit after every task (at minimum); frequent commits within tasks are encouraged.
- Knowledge-sync (rule 09): the GATE 0 behavior change updates the matching help-content article in the same task.

---

### Task 1: GATE 0 — suggest-only flip (adopt verdict → `ready_to_adopt`, owner approves)

The decide loop currently adopts autonomously (`optimize.ts:74-79` calls `store.adoptChallenger` then chains). Spec GATE 0: between now and GATE 1, an `adopt_challenger` verdict must only *mark* the experiment `ready_to_adopt` (a status the DB already has — 0040 check constraint — and the manual `adoptExperiment` server action already requires, `apps/web/src/app/(app)/analytics/optimize-actions.ts:47`). Discard/halt stay autonomous (conservative safety actions). No chaining after a ready mark — the one-live unique index counts `ready_to_adopt` as live, so the slot is intentionally occupied until the owner acts.

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (~line 373-437, the OptimizeStore section)
- Modify: `packages/jobs/src/pipeline/optimize.ts`
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (~line 931 `getRunningExperiments`, and add `markReadyToAdopt` near `concludeExperiment` ~line 1056)
- Modify: `packages/jobs/src/pipeline/optimize.test.ts` (existing fake-store tests)
- Modify: the help-content article covering the What's-working / optimize loop — find it with `grep -rl "adopt" packages/help-content/content/` (likely the analytics/what's-working article)

**Interfaces:**
- Consumes: existing `OptimizeStore`, `decideExperiment`, `RunningExperiment`.
- Produces: `OptimizeStore.markReadyToAdopt(experimentId: string, reason: string): Promise<void>`; `RunningExperiment.challengerStrategy: CopyStrategy` (needed by Task 2's canary detection); `OptimizeSummary` gains `readied: number` (keep `adopted` — it stays 0 during the suggest-only window and returns at GATE 1).

- [ ] **Step 1: Write the failing tests** — in `packages/jobs/src/pipeline/optimize.test.ts`, update/add (adapt the file's existing fake-store helpers; every fake gets the two new members):

```ts
it("marks a winning challenger ready_to_adopt instead of adopting (GATE 0 suggest-only)", async () => {
  // fake store: one running experiment whose challenger clearly wins at n>=30 both arms
  const calls: string[] = [];
  const store = fakeStore({
    experiments: [exp({ id: "e1", stageKey: "reply" })],
    championFlags: flags({ denominator: 40, successes: 4, negatives: 0 }),
    challengerFlags: flags({ denominator: 40, successes: 16, negatives: 0 }),
    onMarkReady: (id, reason) => calls.push(`ready:${id}:${reason}`),
    onAdopt: () => calls.push("adopt"),
    onStart: () => calls.push("chain"),
  });
  const summary = await runOptimize({ store });
  expect(calls.some((c) => c.startsWith("ready:e1"))).toBe(true);
  expect(calls).not.toContain("adopt");
  expect(calls).not.toContain("chain"); // slot stays occupied — no chaining off a suggestion
  expect(summary.readied).toBe(1);
  expect(summary.adopted).toBe(0);
});

it("still discards and halts autonomously (conservative actions keep their autonomy)", async () => {
  // champion clearly better -> discard path unchanged: concludeExperiment + chainNext still fire
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter @vantera/jobs test -- optimize` → FAIL (`markReadyToAdopt`/`readied` don't exist).

- [ ] **Step 3: Implement.**

`types.ts` — inside `OptimizeStore` (after `concludeExperiment`):

```ts
  /**
   * GATE 0 (enterprise-grade-brain spec): a winning challenger is only MARKED ready_to_adopt
   * (suggest-only) — the owner's adopt action applies it. No concluded_at: the experiment still
   * occupies the account's one-live slot until the owner acts.
   */
  markReadyToAdopt(experimentId: string, reason: string): Promise<void>;
```

`RunningExperiment` gains:

```ts
  /** the challenger strategy under test (jsonb on the row) — canary detection compares it to the champion */
  challengerStrategy: CopyStrategy;
```

`OptimizeSummary` gains `readied: number;` (doc: suggestions surfaced this tick).

`optimize.ts` — the adopt branch becomes:

```ts
      case "adopt_challenger": {
        // GATE 0 (enterprise-grade-brain spec): suggest-only until the anytime-valid decision
        // core lands (GATE 1). The owner's Adopt button (ready_to_adopt) applies the win.
        await deps.store.markReadyToAdopt(exp.id, verdict.reason);
        readied++;
        break;
      }
```

Update the module docblock (it currently says "a proven winner is ADOPTED on the spot") to state the GATE 0 posture and name the spec. Keep discard/halt branches exactly as they are.

`pg-store.ts` — `getRunningExperiments` select adds `challengerStrategy: optimizationExperiments.challengerStrategy` and the mapper adds `challengerStrategy: (r.challengerStrategy ?? {}) as CopyStrategy`. New method next to `concludeExperiment`:

```ts
    async markReadyToAdopt(experimentId, reason) {
      await db
        .update(optimizationExperiments)
        .set({ status: "ready_to_adopt", decisionReason: reason })
        .where(eq(optimizationExperiments.id, experimentId));
    },
```

- [ ] **Step 4: Run tests** — `pnpm --filter @vantera/jobs test -- optimize` → PASS. Then `pnpm --filter @vantera/jobs type-check` (the fake stores in other tests must add the new members).

- [ ] **Step 5: Knowledge-sync** — find the article describing autonomous adoption (`grep -rl "adopt" packages/help-content/content/`) and update the relevant sentences: winners now appear as a "ready to adopt" suggestion the owner approves from What's-working. Run `pnpm --filter @vantera/help-content test`.

- [ ] **Step 6: Commit** — `git commit -m "feat(optimize): GATE 0 — winning challengers are suggest-only (ready_to_adopt), owner adopts"`

---

### Task 2: Live A/A canary (identical arms; any non-keep verdict = alert, never an action)

An A/A experiment (challenger deep-equals champion) measures the decide gate's live false-signal rate. Detection is pure: `strategySignature(champion) === strategySignature(challenger)` (exported from `@vantera/agent-brains`, `bandit.ts:14`). On a canary, ANY non-`keep_running` verdict is a calibration failure: count it, alert the admin, change nothing (the experiment keeps collecting). Seeding: the optimize trigger reads app-setting `aa_canary_account_id` and idempotently ensures a canary experiment exists for that account (50/50 allocation for maximum power; the one-live index makes seeding idempotent). Note in code: the canary occupies the account's experiment slot — it runs on the founder account during the GATE 0→GATE 1 window, before the F0 reveal pilot takes that slot.

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (OptimizeStore + OptimizeDeps + OptimizeSummary)
- Modify: `packages/jobs/src/pipeline/optimize.ts`
- Modify: `packages/jobs/src/pipeline/pg-store.ts`
- Modify: `packages/jobs/src/trigger/optimize.ts`
- Modify: `packages/jobs/src/pipeline/optimize.test.ts`

**Interfaces:**
- Consumes: `strategySignature` from `@vantera/agent-brains`; Task 1's `RunningExperiment.challengerStrategy`; `createTransactionalEmailFromEnv` from `@vantera/transactional-email` (wiring mirror: `packages/jobs/src/trigger/account-health.ts:4`).
- Produces: `OptimizeStore.getCanaryAccountId(): Promise<string | null>`; `OptimizeStore.ensureCanaryExperiment(accountId: string): Promise<boolean>`; `OptimizeDeps.notifyCanaryAlert?: (info: { experimentId: string; accountId: string; decision: string; reason: string }) => Promise<void>`; `OptimizeSummary.canaryAlerts: number`.

- [ ] **Step 1: Failing tests** in `optimize.test.ts`:

```ts
it("A/A canary: a non-keep verdict alerts and does NOT conclude, adopt, or mark ready", async () => {
  const same = { openWith: "pain" } as CopyStrategy; // identical arms = canary
  const alerts: string[] = [];
  const store = fakeStore({
    experiments: [exp({ id: "c1", championStrategy: same, challengerStrategy: same })],
    // rig flags so decideExperiment returns adopt_challenger (clear win at n>=30)
    championFlags: flags({ denominator: 40, successes: 4, negatives: 0 }),
    challengerFlags: flags({ denominator: 40, successes: 16, negatives: 0 }),
  });
  const summary = await runOptimize({
    store,
    notifyCanaryAlert: async (i) => { alerts.push(i.decision); },
  });
  expect(summary.canaryAlerts).toBe(1);
  expect(alerts).toEqual(["adopt_challenger"]);
  // no state change on the canary:
  expect(store.calls.markReadyToAdopt).toHaveLength(0);
  expect(store.calls.concludeExperiment).toHaveLength(0);
  expect(store.calls.adoptChallenger).toHaveLength(0);
});

it("A/A canary with keep_running verdict does nothing (no alert)", async () => { /* low n both arms */ });
```

- [ ] **Step 2: Verify failure** — `pnpm --filter @vantera/jobs test -- optimize` → FAIL.

- [ ] **Step 3: Implement.**

`optimize.ts` — import `strategySignature`; at the top of the per-experiment loop, after computing `verdict`:

```ts
    // Live A/A canary (enterprise-grade-brain spec, WS-1.8): identical arms mean ANY decisive
    // verdict is a false signal from the gate itself. Alert, count, change nothing — the canary
    // keeps collecting. It is exempt from every action branch below.
    const isCanary =
      strategySignature(exp.championStrategy) === strategySignature(exp.challengerStrategy);
    if (isCanary) {
      if (verdict.decision !== "keep_running") {
        canaryAlerts++;
        await deps.notifyCanaryAlert?.({
          experimentId: exp.id,
          accountId: exp.accountId,
          decision: verdict.decision,
          reason: verdict.reason,
        });
      }
      continue;
    }
```

`pg-store.ts`:

```ts
    async getCanaryAccountId(): Promise<string | null> {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "aa_canary_account_id"));
      const v = row?.value;
      return typeof v === "string" && v.length > 0 ? v : null;
    },

    async ensureCanaryExperiment(accountId): Promise<boolean> {
      // Champion vs an IDENTICAL challenger — zero user-facing difference; 50/50 split for power.
      // Idempotent via the one-live unique index (23505 → already live, skip). Occupies the
      // account's single experiment slot by design (runs GATE 0 → GATE 1 on the pilot account).
      const [pb] = await db
        .select({ championStrategy: optimizationPlaybook.championStrategy })
        .from(optimizationPlaybook)
        .where(eq(optimizationPlaybook.accountId, accountId))
        .limit(1);
      const champion = ((pb?.championStrategy as CopyStrategy | null) ?? {}) as CopyStrategy;
      try {
        await db.insert(optimizationExperiments).values({
          accountId,
          stageKey: "reply",
          championStrategy: champion,
          challengerStrategy: champion,
          allocationPct: 50,
          minSample: 30,
          status: "running",
        });
        return true;
      } catch (err) {
        if ((err as { code?: string }).code === "23505") return false;
        throw err;
      }
    },
```

`trigger/optimize.ts` — before `runOptimize`, seed; wire the alert to the transactional-email sender exactly the way `trigger/account-health.ts` wires its disconnect alert (same import, same env-derived sender, recipient = the admin alert address used there):

```ts
    const store = createPgStore(createDb());
    const canaryAccountId = await store.getCanaryAccountId();
    if (canaryAccountId) await store.ensureCanaryExperiment(canaryAccountId);

    const summary = await runOptimize({
      store,
      proposeCandidatesFn: (input) => proposeRecipeCandidates(input),
      notifyCanaryAlert: async (info) => {
        logger.error("A/A canary fired a decisive verdict — decide gate miscalibration", { ...info });
        await email.send({ /* mirror account-health's admin alert shape: subject
          "A/A canary alert: decide gate produced a decisive verdict", body with info fields */ });
      },
    });
```

- [ ] **Step 4: Run** — `pnpm --filter @vantera/jobs test -- optimize` → PASS; `pnpm --filter @vantera/jobs type-check` → clean.

- [ ] **Step 5: Commit** — `git commit -m "feat(optimize): live A/A canary — identical-arm experiment, decisive verdicts alert instead of acting"`

**Post-merge operational note (goes in the PR body):** set app-setting `aa_canary_account_id` to the founder account id to arm the canary.

---

### Task 3: Trigger schedule-quota guardrail test

The 11th `schedules.task()` broke every prod deploy for ~16h (prod-ops gotcha, fixed `c2e79f5`). Make the outage class a test failure.

**Files:**
- Create: `packages/jobs/src/schedule-quota.test.ts`

**Interfaces:** none — static-analysis guardrail (same genre as `structure.test.ts`).

- [ ] **Step 1: Write the test**

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trigger.dev cloud allows 10 declarative schedules on this plan. The 11th schedules.task()
 * broke EVERY prod deploy for ~16h (2026-07-15 → 07-16). New periodic work piggybacks the
 * agent-scheduler tick as a plain task — never a new schedule. This test turns that outage
 * class into a red build.
 */
const QUOTA = 10;

describe("trigger schedule quota", () => {
  it(`declares at most ${QUOTA} schedules.task registrations`, () => {
    const dir = join(__dirname, "trigger");
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      const count = (src.match(/schedules\.task\(/g) ?? []).length;
      for (let i = 0; i < count; i++) offenders.push(f);
    }
    expect(
      offenders.length,
      `schedules.task() registrations: ${offenders.join(", ")} — quota is ${QUOTA}. ` +
        "Piggyback new periodic work on the agent-scheduler tick instead of adding a schedule."
    ).toBeLessThanOrEqual(QUOTA);
  });
});
```

- [ ] **Step 2: Run** — `pnpm --filter @vantera/jobs test -- schedule-quota` → PASS (current count must be ≤ 10; if it prints exactly 10, that is correct and the test is doing its job). Temporarily append `schedules.task(` in a comment-free scratch string? No — verify the failure mode by asserting the count found is > 0 (sanity that the scan sees real files): add `expect(offenders.length).toBeGreaterThan(0);`.

- [ ] **Step 3: Commit** — `git commit -m "test(jobs): guardrail — trigger schedule quota (10) is a red build, not a prod outage"`

---

### Task 4: `/api/version` + post-deploy verification workflow

Kills two outage classes: the Vercel domain pin (ship not live until promote) and the silently-skipped Trigger deploy. After CI succeeds on main, a workflow polls the production domain until it serves the new SHA, and (when `packages/jobs` changed) asserts the Trigger deploy workflow for that SHA succeeded.

**Files:**
- Create: `apps/web/src/app/api/version/route.ts`
- Create: `apps/web/src/app/api/version/route.test.ts`
- Create: `.github/workflows/postdeploy-verify.yml`

**Interfaces:**
- Produces: `GET /api/version` → `{ sha: string }` (consumed by the workflow and any future monitor). Vercel exposes `VERCEL_GIT_COMMIT_SHA` when system env vars are enabled (they are — the analytics setup already relies on Vercel env inlining).

- [ ] **Step 1: Failing test** — `route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

describe("GET /api/version", () => {
  it("returns the deployed git sha from the Vercel env", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc1234");
    const { GET } = await import("./route");
    const res = await GET();
    expect(await res.json()).toEqual({ sha: "abc1234" });
    expect(res.headers.get("cache-control")).toContain("no-store");
    vi.unstubAllEnvs();
  });

  it("falls back to 'dev' outside Vercel", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    const { GET } = await import("./route");
    expect((await (await GET()).json()).sha).toBe("dev");
    vi.unstubAllEnvs();
  });
});
```

- [ ] **Step 2: Verify failure** — `pnpm --filter web test -- api/version` → FAIL (module not found).

- [ ] **Step 3: Implement** — `route.ts`:

```ts
import { NextResponse } from "next/server";

// Deploy-identity probe (enterprise-grade-brain spec, WS-4.2): postdeploy-verify polls this
// until the production domain serves the SHA that CI just built — a pinned/stale alias fails
// the workflow instead of silently serving old code. No auth: the SHA is public in the repo.
export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json({ sha }, { headers: { "cache-control": "no-store" } });
}
```

- [ ] **Step 4: Run** — `pnpm --filter web test -- api/version` → PASS.

- [ ] **Step 5: Workflow** — `.github/workflows/postdeploy-verify.yml`:

```yaml
name: Post-deploy verify

# The ship-isn't-live-until-proven rule, automated (enterprise-grade-brain spec, WS-4.2).
# After CI succeeds on main: (1) the production domain must serve the new SHA within 20 min
# (a pinned Vercel alias fails here instead of silently serving stale code); (2) if the push
# touched packages/jobs, the Trigger deploy workflow for the same SHA must succeed.
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  verify-web:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - name: Wait for production to serve the new SHA
        run: |
          SHA="${{ github.event.workflow_run.head_sha }}"
          echo "expecting $SHA on https://vanterasystem.dev/api/version"
          for i in $(seq 1 40); do
            live=$(curl -fsS --max-time 10 https://vanterasystem.dev/api/version | jq -r .sha || echo "")
            if [ "$live" = "$SHA" ]; then echo "live ✓"; exit 0; fi
            echo "attempt $i: live=$live — waiting 30s"; sleep 30
          done
          echo "::error::production never served $SHA — Vercel alias likely pinned; run vercel promote"
          exit 1

  verify-jobs:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with: { fetch-depth: 2 }
      - name: Assert Trigger deploy succeeded when packages/jobs changed
        env: { GH_TOKEN: "${{ github.token }}" }
        run: |
          SHA="${{ github.event.workflow_run.head_sha }}"
          git fetch --depth=2 origin "$SHA"
          if ! git diff --name-only "$SHA~1" "$SHA" | grep -q '^packages/jobs/'; then
            echo "no jobs changes — skipping"; exit 0
          fi
          for i in $(seq 1 50); do
            conclusion=$(gh run list --workflow "Deploy to Trigger.dev (prod)" \
              --commit "$SHA" --json conclusion --jq '.[0].conclusion // ""')
            case "$conclusion" in
              success) echo "trigger deploy ✓"; exit 0 ;;
              failure|cancelled) echo "::error::Trigger deploy $conclusion for $SHA"; exit 1 ;;
              *) echo "attempt $i: conclusion='$conclusion' — waiting 30s"; sleep 30 ;;
            esac
          done
          echo "::error::Trigger deploy for $SHA never concluded"; exit 1
```

- [ ] **Step 6: Validate YAML** — `npx --yes yaml-lint .github/workflows/postdeploy-verify.yml` (or `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/postdeploy-verify.yml'))"`). Expected: clean parse. (Live firing is proven on the first main merge — note it in the PR body as the verification step.)

- [ ] **Step 7: Commit** — `git commit -m "feat(ci): /api/version + post-deploy verify — pinned alias and skipped Trigger deploy become red workflows"`

---

### Task 5: Migration drift check (nightly, read-only, secret-gated)

Closes the documented gap (`docs/production-readiness.md:15,27`) at its safe scope: replay every migration onto a scratch Postgres, dump the schema, diff against a schema-only dump of PROD. Read-only against prod; auto-APPLY stays out of scope until the diff runs clean for a while (noted for Phase 2). Secret absent → loud skip, never a silent pass.

**Files:**
- Create: `.github/workflows/migration-drift.yml`
- Create: `scripts/replay-migrations.sh`

**Interfaces:**
- Consumes: `packages/db/migrations/*.sql` (gap-free ordered — enforced by `schema.test.ts`).
- Produces: nightly red/green drift signal. Owner dependency: `PROD_DB_URL` GH secret (read-only role preferred).

- [ ] **Step 1: Replay script** — `scripts/replay-migrations.sh`:

```bash
#!/usr/bin/env bash
# Replays packages/db/migrations in order onto $DATABASE_URL (a scratch postgres).
# Supabase migrations reference auth.users / auth.uid(); stub just enough of the auth
# schema first. Fails on the first SQL error.
set -euo pipefail

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create extension if not exists pgcrypto;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid());
create or replace function auth.uid() returns uuid
  language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create role authenticated nologin;
create role service_role nologin;
create role anon nologin;
SQL

for f in packages/db/migrations/*.sql; do
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
```

Run `chmod +x scripts/replay-migrations.sh`. Expect iteration here: run it locally against a throwaway container (`docker run -d -e POSTGRES_HOST_AUTH_METHOD=trust -p 54329:5432 postgres:15`, URL `postgresql://postgres@localhost:54329/postgres`) and extend the stub preamble until all 58 migrations replay clean. Every addition to the preamble must be an auth/roles/extension stub — never a change to a migration file. (Trust auth = no password in any URL — the repo's secret-scan commit hook rejects `user:pass@` URLs even for scratch containers; keep all workflow/scripts passwordless.)

- [ ] **Step 2: Workflow** — `.github/workflows/migration-drift.yml`:

```yaml
name: Migration drift check

# Read-only prod drift detector (enterprise-grade-brain spec, WS-4.1). Replays the committed
# migrations onto a scratch postgres and diffs the resulting public schema against prod's.
# Catches both unapplied migrations and out-of-repo prod edits (the applied-via-MCP class).
on:
  schedule: [{ cron: "17 5 * * *" }]
  push: { paths: ["packages/db/migrations/**"] }
  workflow_dispatch:

jobs:
  drift:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env: { POSTGRES_HOST_AUTH_METHOD: trust }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres" --health-interval 5s
          --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v6
      - name: Skip loudly without prod credentials
        if: ${{ !secrets.PROD_DB_URL }}
        run: |
          echo "::warning::PROD_DB_URL secret not set — drift check SKIPPED. The spec's WS-4.1 owner dependency is open."
      - name: Replay migrations onto scratch DB
        if: ${{ secrets.PROD_DB_URL }}
        env: { DATABASE_URL: "postgresql://postgres@localhost:5432/postgres" }
        run: ./scripts/replay-migrations.sh
      - name: Diff schemas
        if: ${{ secrets.PROD_DB_URL }}
        env:
          SCRATCH: "postgresql://postgres@localhost:5432/postgres"
          PROD: ${{ secrets.PROD_DB_URL }}
        run: |
          dump() { pg_dump "$1" --schema-only --schema=public --no-owner --no-privileges \
            | grep -vE '^(--|SET |SELECT pg_catalog)' | sed -e 's/[[:space:]]*$//' ; }
          dump "$SCRATCH" > /tmp/expected.sql
          dump "$PROD"    > /tmp/actual.sql
          if ! diff -u /tmp/expected.sql /tmp/actual.sql > /tmp/drift.diff; then
            echo "::error::schema drift between committed migrations and prod:"
            head -200 /tmp/drift.diff
            exit 1
          fi
          echo "no drift ✓"
```

(Note: `if: ${{ !secrets.PROD_DB_URL }}` isn't valid GH expression syntax for secrets — implement the guard as a first step that writes `has_prod=true/false` to `$GITHUB_OUTPUT` from `env: PROD_DB_URL: ${{ secrets.PROD_DB_URL }}` and gate later steps on it. The executor writes it that way; the intent above is normative.)

- [ ] **Step 3: Verify locally** — run the replay script against the throwaway container until green; validate workflow YAML parses. Expected: all migrations apply; local diff of scratch-vs-scratch is empty.

- [ ] **Step 4: Commit** — `git commit -m "feat(ci): nightly migration drift check — replayed migrations diffed against prod schema (read-only, secret-gated)"`

---

### Task 6: Prompt registry (identity for every system prompt, caching untouched)

Every `*_SYSTEM` prompt constant becomes a registered prompt with a stable content hash. Text stays a stable string (Anthropic prompt caching depends on it); the hash is metadata. SendRecipe v2 stamping arrives in Phase 2 — this task delivers identity + enforcement.

**Files:**
- Create: `packages/ai/src/prompts.ts`
- Create: `packages/ai/src/prompts.test.ts`
- Modify: `packages/ai/src/index.ts` (export)
- Modify (wrap + `.text` at call sites): `packages/agent-brains/src/prospect/rank.ts` (`RANK_SYSTEM`), `packages/agent-brains/src/copy/linkedin.ts` (`LINKEDIN_SYSTEM`), `packages/agent-brains/src/copy/fix.ts` (`FIX_SYSTEM`), `packages/agent-brains/src/optimize/generate.ts` (`GENERATE_SYSTEM`), `packages/agent-brains/src/prospect/derive-criteria.ts` (`DERIVE_SYSTEM`), `packages/agent-brains/src/prospect/website-scan.ts` (`SCAN_SYSTEM`), `packages/agent-brains/src/intent/classify.ts` (`INTENT_SYSTEM`), `packages/agent-brains/src/intent/watchlist.ts` (`WATCHLIST_SYSTEM`), `packages/agent-brains/src/reply/classify.ts` (its `*_SYSTEM`), `packages/agent-brains/src/reply/respond.ts` (`RESPOND_SYSTEM`), `packages/help-agent/src/prompt.ts` (`SYSTEM_PROMPT`)
- Create: `packages/agent-brains/src/prompt-registry.test.ts` (guardrail)

**Interfaces:**
- Produces:

```ts
export type RegisteredPrompt = { name: string; text: string; hash: string };
export function registerPrompt(name: string, text: string): RegisteredPrompt;
export function listPrompts(): RegisteredPrompt[];
```

Phase 2 consumes `RegisteredPrompt.hash` for SendRecipe v2 stamping and eval keying.

- [ ] **Step 1: Failing tests** — `packages/ai/src/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fnv1a64, listPrompts, registerPrompt } from "./prompts";

describe("prompt registry", () => {
  it("hashes deterministically (fnv1a64 known vector)", () => {
    expect(fnv1a64("hello")).toBe(fnv1a64("hello"));
    expect(fnv1a64("hello")).not.toBe(fnv1a64("hello!"));
    expect(fnv1a64("hello")).toMatch(/^[0-9a-f]{16}$/);
  });

  it("registers a prompt and exposes it in the listing", () => {
    const p = registerPrompt("test/one", "you are a test");
    expect(p).toEqual({ name: "test/one", text: "you are a test", hash: fnv1a64("you are a test") });
    expect(listPrompts().some((x) => x.name === "test/one")).toBe(true);
  });

  it("throws on duplicate registration under a different text", () => {
    registerPrompt("test/dup", "a");
    expect(() => registerPrompt("test/dup", "b")).toThrow(/already registered/);
  });
});
```

- [ ] **Step 2: Verify failure** — `pnpm --filter @vantera/ai test` → FAIL.

- [ ] **Step 3: Implement** — `packages/ai/src/prompts.ts`:

```ts
/**
 * Prompt registry (enterprise-grade-brain spec, WS-2.1): every system prompt is registered with
 * a stable content hash so generations become attributable to an exact prompt revision. The text
 * stays a stable string constant — Anthropic prompt caching depends on that; the hash is
 * metadata, never injected into the prompt. Phase 2 stamps `hash` into SendRecipe v2.
 * Pure TS (FNV-1a 64-bit) — no node:crypto, safe in every runtime.
 */
export type RegisteredPrompt = { name: string; text: string; hash: string };

const registry = new Map<string, RegisteredPrompt>();

export function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export function registerPrompt(name: string, text: string): RegisteredPrompt {
  const existing = registry.get(name);
  if (existing) {
    if (existing.text === text) return existing;
    throw new Error(`prompt "${name}" already registered with different text`);
  }
  const entry = { name, text, hash: fnv1a64(text) };
  registry.set(name, entry);
  return entry;
}

export function listPrompts(): RegisteredPrompt[] {
  return [...registry.values()];
}
```

Export from `packages/ai/src/index.ts`. Then wrap each `*_SYSTEM` constant, e.g. in `copy/linkedin.ts`:

```ts
const LINKEDIN_SYSTEM = registerPrompt("copy/linkedin", `…existing text unchanged…`);
```

and each call site becomes `system: LINKEDIN_SYSTEM.text`. Type errors flag every missed call site — that's the migration mechanism. Registry names use `<domain>/<file>` (`prospect/rank`, `copy/linkedin`, `copy/fix`, `optimize/generate`, `prospect/derive-criteria`, `prospect/website-scan`, `intent/classify`, `intent/watchlist`, `reply/classify`, `reply/respond`, `help-agent/system`).

- [ ] **Step 4: Guardrail test** — `packages/agent-brains/src/prompt-registry.test.ts` (structure-test genre):

```ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every *_SYSTEM prompt must be registered (WS-2.1) — a raw string constant is an
 *  unattributable prompt revision. */
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
  });
}

describe("prompt registry enforcement", () => {
  it("no raw *_SYSTEM string constants — use registerPrompt", () => {
    const offenders = walk(join(__dirname)).filter((p) =>
      /_SYSTEM\s*=\s*[`"']/.test(readFileSync(p, "utf8"))
    );
    expect(offenders, `raw prompt constants in: ${offenders.join(", ")}`).toEqual([]);
  });
});
```

- [ ] **Step 5: Run everything** — `pnpm --filter @vantera/ai test && pnpm --filter @vantera/agent-brains test && pnpm --filter @vantera/help-agent test && pnpm type-check` → all PASS (existing brain tests prove behavior unchanged — prompt text is byte-identical).

- [ ] **Step 6: Commit** — `git commit -m "feat(ai): prompt registry — every system prompt gets a stable content hash (WS-2.1)"`

---

### Task 7: Statistics simulation harness (the calibration testbed GATE 1 will gate on)

A seeded, pure-TS monte-carlo harness that runs experiment streams through `decideExperiment` exactly the way the daily cron does (evaluate-every-day = peeking included). Phase 1 delivers the harness + a characterization of the CURRENT core's false-adoption rate under the null (the documented evidence of the problem). The ≤5% CI gate lands with the new decision core (GATE 1).

**Files:**
- Create: `packages/agent-brains/src/optimize/sim/harness.ts`
- Create: `packages/agent-brains/src/optimize/sim/harness.test.ts`

**Interfaces:**
- Produces:

```ts
export function mulberry32(seed: number): () => number;
export type SimConfig = {
  championRate: number;      // true success prob per completed touch
  challengerRate: number;
  negativeRate: number;      // true negative-reply prob (both arms)
  perDayPerArm: number;      // completed touches added per day per arm
  horizonDays: number;
  decideOptions?: DecideOptions;
  rng: () => number;
};
export type SimResult = { decision: ExperimentDecision; day: number };
export function simulateDecisionPath(config: SimConfig): SimResult;
export function runMonteCarlo(runs: number, seed: number, config: Omit<SimConfig, "rng">): {
  adoptRate: number; discardRate: number; haltRate: number; inconclusiveRate: number; meanDecisionDay: number;
};
```

Phase 2 reuses `runMonteCarlo` to tune the e-process/shrinkage parameters and adds the hard gates.

- [ ] **Step 1: Failing tests** — `harness.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runMonteCarlo, simulateDecisionPath, mulberry32 } from "./harness";

describe("optimize sim harness", () => {
  it("is deterministic under a fixed seed", () => {
    const cfg = { championRate: 0.15, challengerRate: 0.15, negativeRate: 0.05,
      perDayPerArm: 8, horizonDays: 90 };
    expect(runMonteCarlo(200, 42, cfg)).toEqual(runMonteCarlo(200, 42, cfg));
  });

  it("adopts a genuinely large lift most of the time (power sanity)", () => {
    const r = runMonteCarlo(500, 7, { championRate: 0.10, challengerRate: 0.25,
      negativeRate: 0.05, perDayPerArm: 8, horizonDays: 90 });
    expect(r.adoptRate).toBeGreaterThan(0.6);
  });

  it("CHARACTERIZATION: current core's false-adoption rate under the null, daily peeking", () => {
    // A/A truth: any adopt is false. This documents the CURRENT gate's miscalibration —
    // the number below is the measured evidence behind GATE 0's suggest-only flip.
    // GATE 1 (Phase 2) requires the REPLACEMENT core to bring this ≤ 0.05.
    const r = runMonteCarlo(2000, 1234, { championRate: 0.15, challengerRate: 0.15,
      negativeRate: 0.05, perDayPerArm: 8, horizonDays: 90 });
    expect(r.adoptRate).toBeGreaterThan(0); // deterministic exact value recorded on first run:
    // expect(r.adoptRate).toBeCloseTo(<measured>, 3);  ← fill with the measured value + comment
  });
});
```

- [ ] **Step 2: Verify failure** — `pnpm --filter @vantera/agent-brains test -- sim` → FAIL.

- [ ] **Step 3: Implement** — `harness.ts`:

```ts
import { DECIDE_DEFAULTS, decideExperiment } from "../decide";
import type { DecideOptions, ExperimentDecision, VariantOutcome } from "../decide";

/**
 * Seeded monte-carlo testbed for the decide gate (enterprise-grade-brain spec, WS-1.7).
 * Simulates the production evaluation pattern faithfully: outcomes accumulate daily and the
 * gate re-evaluates EVERY day (the cron's peeking included), so measured error rates are the
 * rates the real loop experiences. Pure TS + injected RNG — runs in vitest, no LLM, no DB.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function binomial(n: number, p: number, rng: () => number): number {
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < p) k++;
  return k;
}

export type SimConfig = {
  championRate: number;
  challengerRate: number;
  negativeRate: number;
  perDayPerArm: number;
  horizonDays: number;
  decideOptions?: DecideOptions;
  rng: () => number;
};
export type SimResult = { decision: ExperimentDecision; day: number };

export function simulateDecisionPath(c: SimConfig): SimResult {
  const champ: VariantOutcome = { denominator: 0, successes: 0, negatives: 0 };
  const chal: VariantOutcome = { denominator: 0, successes: 0, negatives: 0 };
  for (let day = 1; day <= c.horizonDays; day++) {
    champ.denominator += c.perDayPerArm;
    champ.successes += binomial(c.perDayPerArm, c.championRate, c.rng);
    champ.negatives += binomial(c.perDayPerArm, c.negativeRate, c.rng);
    chal.denominator += c.perDayPerArm;
    chal.successes += binomial(c.perDayPerArm, c.challengerRate, c.rng);
    chal.negatives += binomial(c.perDayPerArm, c.negativeRate, c.rng);
    const verdict = decideExperiment(champ, chal, c.decideOptions ?? DECIDE_DEFAULTS);
    if (verdict.decision !== "keep_running") return { decision: verdict.decision, day };
  }
  return { decision: "keep_running", day: c.horizonDays };
}

export function runMonteCarlo(
  runs: number,
  seed: number,
  config: Omit<SimConfig, "rng">
): { adoptRate: number; discardRate: number; haltRate: number; inconclusiveRate: number; meanDecisionDay: number } {
  const rng = mulberry32(seed);
  let adopt = 0, discard = 0, halt = 0, inconclusive = 0, daySum = 0, decided = 0;
  for (let i = 0; i < runs; i++) {
    const r = simulateDecisionPath({ ...config, rng });
    if (r.decision === "adopt_challenger") adopt++;
    else if (r.decision === "discard_challenger") discard++;
    else if (r.decision === "halt") halt++;
    else inconclusive++;
    if (r.decision !== "keep_running") { daySum += r.day; decided++; }
  }
  return {
    adoptRate: adopt / runs,
    discardRate: discard / runs,
    haltRate: halt / runs,
    inconclusiveRate: inconclusive / runs,
    meanDecisionDay: decided ? daySum / decided : 0,
  };
}
```

- [ ] **Step 4: Run, then pin the characterization** — `pnpm --filter @vantera/agent-brains test -- sim` → PASS. Print the null `adoptRate` once (temporary `console.log` or read from a focused run), replace the placeholder assertion with `toBeCloseTo(<measured>, 3)` and a comment stating the measured value and that GATE 1 requires ≤ 0.05 from the replacement core. Re-run → PASS. (Purity check: `pnpm --filter @vantera/agent-brains test -- purity` still green — the sim imports nothing impure.)

- [ ] **Step 5: Commit** — `git commit -m "feat(brains): seeded monte-carlo harness for the decide gate + null-hypothesis characterization (WS-1.7)"`

---

### Final verification (before merge)

- [ ] `pnpm lint && pnpm type-check && pnpm test && pnpm build` — full gate green.
- [ ] Re-read the spec's GATE 0 + Phase 1 rows — every item maps to a landed task: suggest-only flip (T1), A/A canary (T2), schedule preflight (T3), post-deploy verify (T4), drift check (T5), prompt registry (T6), sim suite (T7).
- [ ] PR body lists the two operational arm-steps for the owner: set `aa_canary_account_id` app-setting; add `PROD_DB_URL` GH secret.
