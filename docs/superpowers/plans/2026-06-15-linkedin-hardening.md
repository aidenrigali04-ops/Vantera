# LinkedIn (Unipile) Production Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Harden the already-complete Unipile LinkedIn integration so the only remaining step to live LinkedIn outreach is Unipile credentials + the hosted-auth custom domain + the user connecting their account.

**Architecture:** Five targeted changes behind existing interfaces — a rolling 7-day invite ceiling in `send-dispatch`, a white-label hosted-auth domain assertion in the adapter, two server-managed-data migrations, and an account-restriction status mapping. No rebuilds.

**Tech Stack:** TypeScript strict, Vitest, Drizzle + Supabase RLS, Trigger.dev v4.

**Spec:** `docs/superpowers/specs/2026-06-15-linkedin-hardening-design.md`. **Branch:** `phase-linkedin-harden` (off `main`).

---

## File Structure
- `packages/linkedin-infra/src/types.ts` — widen `LinkedInEvent.account_status.status` to include `"restricted"`.
- `packages/linkedin-infra/src/unipile.ts` (+ `.test.ts`) — restriction status mapping; hosted-auth domain assertion + `hostedAuthDomain` config + factory env.
- `packages/linkedin-infra/src/in-memory.ts` — keep parity (no behavior change unless types require).
- `packages/jobs/src/pipeline/types.ts` — `countLinkedInInvitesLast7Days` signature; widen `upsertLinkedInAccountStatus` status param.
- `packages/jobs/src/pipeline/pg-store.ts` — `countLinkedInInvitesLast7Days` impl; widen `upsertLinkedInAccountStatus`.
- `packages/jobs/src/pipeline/send-dispatch.ts` (+ `.test.ts`) — weekly invite clamp.
- `packages/db/migrations/0022_linkedin_connected_at_grant.sql` + `0023_scheduled_sends_stage_check.sql`; `packages/db/src/schema.test.ts` — two guardrail tests.
- `.env.example` — add `HOSTED_AUTH_DOMAIN`.

---

## Task 1: Account-restriction status mapping (linkedin-infra)

**Files:** `packages/linkedin-infra/src/types.ts`, `src/unipile.ts`, `src/unipile.test.ts`

- [ ] **Step 1: Widen the event type** in `types.ts` — change the `account_status` member's `status` to `"active" | "restricted" | "disconnected"`.

- [ ] **Step 2: Write failing tests** in `unipile.test.ts` for `parseEventWebhook`:

```ts
it("maps checkpoint/credential states to restricted", () => {
  const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s" });
  for (const status of ["CREDENTIALS", "CHECKPOINT", "PERMISSIONS", "ERROR", "STOPPED", "SYNC_ERROR"]) {
    const ev = infra.parseEventWebhook({ event: "account_status", event_id: "e1", account_id: "a1", status, name: "acc_1" });
    expect(ev).toMatchObject({ type: "account_status", status: "restricted" });
  }
});
it("still maps OK->active and DISCONNECTED->disconnected", () => {
  const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s" });
  expect(infra.parseEventWebhook({ event: "account_status", event_id: "e", account_id: "a", status: "OK", name: "x" })).toMatchObject({ status: "active" });
  expect(infra.parseEventWebhook({ event: "account_status", event_id: "e", account_id: "a", status: "DISCONNECTED", name: "x" })).toMatchObject({ status: "disconnected" });
});
```

- [ ] **Step 3: Run → fail.** `pnpm --filter @vantera/linkedin-infra test unipile`

- [ ] **Step 4: Implement** — in `unipile.ts` `parseEventWebhook` `account_status` branch, replace the if/else with:

```ts
        const rawStatus = p.status;
        let status: "active" | "restricted" | "disconnected";
        if (rawStatus === "OK" || rawStatus === "CREATION_SUCCESS") status = "active";
        else if (rawStatus === "DISCONNECTED") status = "disconnected";
        else if (rawStatus === "CREDENTIALS" || rawStatus === "CHECKPOINT" || rawStatus === "PERMISSIONS" || rawStatus === "ERROR" || rawStatus === "STOPPED" || rawStatus === "SYNC_ERROR") status = "restricted";
        else return null;
```

- [ ] **Step 5: Run → pass.** Commit: `feat(linkedin-infra): map checkpoint/credential states to restricted`

---

## Task 2: Hosted-auth custom-domain assertion (linkedin-infra)

**Files:** `packages/linkedin-infra/src/unipile.ts`, `src/unipile.test.ts`

- [ ] **Step 1: Write failing tests:**

```ts
it("throws if hostedAuthDomain set and returned url is off-domain", async () => {
  const fetchFn = (async () => new Response(JSON.stringify({ url: "https://accounts.unipile.com/abc" }), { status: 200 })) as unknown as typeof fetch;
  const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn, hostedAuthDomain: "connect.vanterasystem.com" });
  await expect(infra.createHostedAuthLink("acc_1")).rejects.toThrow(/custom domain/i);
});
it("passes when hostedAuthDomain matches the returned url host", async () => {
  const fetchFn = (async () => new Response(JSON.stringify({ url: "https://connect.vanterasystem.com/abc" }), { status: 200 })) as unknown as typeof fetch;
  const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn, hostedAuthDomain: "connect.vanterasystem.com" });
  await expect(infra.createHostedAuthLink("acc_1")).resolves.toMatchObject({ url: expect.stringContaining("connect.vanterasystem.com") });
});
it("warns but proceeds when hostedAuthDomain is unset", async () => {
  const fetchFn = (async () => new Response(JSON.stringify({ url: "https://accounts.unipile.com/abc" }), { status: 200 })) as unknown as typeof fetch;
  const infra = new UnipileLinkedInInfra({ apiKey: "k", dsn: "d", webhookSecret: "s", fetchFn });
  await expect(infra.createHostedAuthLink("acc_1")).resolves.toMatchObject({ url: expect.any(String) });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Implement** — add `hostedAuthDomain?: string` to `UnipileConfig`; store it on the instance. At the end of `createHostedAuthLink`, before `return`:

```ts
    const url = requireString(data.url, "url");
    if (this.hostedAuthDomain) {
      const host = new URL(url).host;
      if (host !== this.hostedAuthDomain) {
        throw new Error(`hosted-auth URL host ${host} is not the configured custom domain ${this.hostedAuthDomain}`);
      }
    } else {
      console.warn("HOSTED_AUTH_DOMAIN unset — hosted-auth URL may expose the provider domain (white-label, rule 04)");
    }
    return { url, expiresAt: expiresOn };
```

- [ ] **Step 4: Update the factory** — `createLinkedInInfraFromEnv` passes `hostedAuthDomain: process.env.HOSTED_AUTH_DOMAIN` to the constructor.

- [ ] **Step 5: Run → pass.** Commit: `feat(linkedin-infra): white-label hosted-auth domain assertion`

---

## Task 3: Rolling 7-day weekly invite ceiling (jobs)

**Files:** `packages/jobs/src/pipeline/types.ts`, `pg-store.ts`, `send-dispatch.ts`, `send-dispatch.test.ts`

- [ ] **Step 1: Add the store signature** to the relevant store interface in `types.ts` (next to `countLinkedInSentToday`):

```ts
  /** Rolling 7-day (168h) count of LinkedIn invites actually sent for the account. */
  countLinkedInInvitesLast7Days(accountId: string, now: Date): Promise<number>;
```

- [ ] **Step 2: Implement in `pg-store.ts`** — copy `countLinkedInSentToday`'s exact `select/from/join` structure; hardcode `linkedinStage = "invite"` and bound by 7 days:

```ts
    async countLinkedInInvitesLast7Days(accountId: string, now: Date): Promise<number> {
      const since = new Date(now.getTime() - 7 * 86_400_000);
      const rows = await db
        .select({ id: outreachSends.id })
        .from(outreachSends)
        .innerJoin(scheduledSends, eq(outreachSends.scheduledSendId, scheduledSends.id))
        .where(
          and(
            eq(outreachSends.accountId, accountId),
            eq(outreachSends.channel, "linkedin"),
            eq(scheduledSends.linkedinStage, "invite"),
            gte(outreachSends.sentAt, since)
          )
        );
      return rows.length;
    },
```

(Mirror the actual join column used by `countLinkedInSentToday` — read it and match exactly; `scheduledSendId` is illustrative.)

- [ ] **Step 3: Write the failing send-dispatch test** — a LinkedIn account with 97 invites in the last 7 days dispatches at most 3:

```ts
it("clamps invites to the rolling weekly ceiling", async () => {
  // build deps where countLinkedInInvitesLast7Days returns 97, dailyAllowance would allow more,
  // and there are 10 queued invite rows; assert dispatched invites <= 3 (100 - 97).
});
```

(Use the existing `send-dispatch.test.ts` fake-store harness; set `countLinkedInSentToday`→0, `countLinkedInInvitesLast7Days`→97, `getLinkedInAccountAgeDays`→60.)

- [ ] **Step 4: Run → fail.**

- [ ] **Step 5: Implement the clamp** in `send-dispatch.ts` — import `LINKEDIN_WEEKLY_INVITE_CEILING` from `./safety-limits`, and change `inviteBudget`:

```ts
      const weeklyRemaining =
        LINKEDIN_WEEKLY_INVITE_CEILING - (await deps.store.countLinkedInInvitesLast7Days(accountId, now));
      let inviteBudget = Math.max(
        0,
        Math.min(
          dailyAllowance("linkedin", ageDays) - (await deps.store.countLinkedInSentToday(accountId, "invite", dayStart)),
          weeklyRemaining
        )
      );
```

- [ ] **Step 6: Run → pass** (and the existing send-dispatch tests stay green). Commit: `feat(jobs): enforce rolling 7-day LinkedIn invite ceiling`

---

## Task 4: Accept "restricted" in the account-status store path (jobs)

**Files:** `packages/jobs/src/pipeline/types.ts`, `pg-store.ts`

- [ ] **Step 1: Widen the type** — in `types.ts`, the `upsertLinkedInAccountStatus` param `status` type (currently `"active" | "disconnected"`) becomes `"active" | "restricted" | "disconnected"`. (The inbound handler already passes `event.status` straight through, so no inbound change is needed once the type widens end-to-end.)

- [ ] **Step 2: Confirm the impl** in `pg-store.ts` `upsertLinkedInAccountStatus` writes `status` directly to `linkedin_accounts.status` (whose enum already includes `restricted`) and sets `connectedAt: status === "active" ? new Date() : null`. No SQL change needed; just ensure the widened type compiles.

- [ ] **Step 3: Type-check + run jobs tests** (`pnpm --filter @vantera/jobs type-check && pnpm --filter @vantera/jobs test`) → green. Commit: `feat(jobs): persist restricted LinkedIn account status`

---

## Task 5: Migration 0022 — server-manage linkedin_connected_at

**Files:** `packages/db/migrations/0022_linkedin_connected_at_grant.sql`, `packages/db/src/schema.test.ts`

- [ ] **Step 1: Migration** (`0022_linkedin_connected_at_grant.sql`):

```sql
-- leads.linkedin_connected_at is set ONLY by the inbound relationship_accepted handler
-- (service role). Block client writes as defense-in-depth (RLS already scopes leads per account).
REVOKE UPDATE (linkedin_connected_at) ON leads FROM authenticated, anon;
```

- [ ] **Step 2: Guardrail test** in `schema.test.ts` (mirror the `0021`/`0019` blocks):

```ts
describe("linkedin_connected_at server-managed (0022)", () => {
  it("0022 revokes client UPDATE on linkedin_connected_at", () => {
    const sql = readFileSync(join(migrationsDir, "0022_linkedin_connected_at_grant.sql"), "utf8");
    expect(sql).toMatch(/REVOKE UPDATE \(linkedin_connected_at\) ON leads FROM authenticated/);
  });
});
```

- [ ] **Step 3: Run `pnpm --filter @vantera/db test` → green.** Commit: `feat(db): 0022 server-manage linkedin_connected_at`

---

## Task 6: Migration 0023 — scheduled_sends stage/channel CHECK

**Files:** `packages/db/migrations/0023_scheduled_sends_stage_check.sql`, `packages/db/src/schema.test.ts`

- [ ] **Step 1: Migration** (`0023_scheduled_sends_stage_check.sql`):

```sql
-- linkedin_stage only applies to LinkedIn sends; enforce it so a non-linkedin row
-- can never carry a stage (data integrity for the sequence orchestrator).
ALTER TABLE scheduled_sends
  ADD CONSTRAINT scheduled_sends_linkedin_stage_channel
  CHECK (linkedin_stage IS NULL OR channel = 'linkedin');
```

- [ ] **Step 2: Guardrail test** in `schema.test.ts`:

```ts
describe("scheduled_sends stage/channel integrity (0023)", () => {
  it("0023 constrains linkedin_stage to linkedin channel", () => {
    const sql = readFileSync(join(migrationsDir, "0023_scheduled_sends_stage_check.sql"), "utf8");
    expect(sql).toMatch(/CHECK \(linkedin_stage IS NULL OR channel = 'linkedin'\)/);
  });
});
```

- [ ] **Step 3: Run `pnpm --filter @vantera/db test` → green.** Commit: `feat(db): 0023 scheduled_sends stage/channel check`

---

## Task 7: Env + smoke doc + full gate

**Files:** `.env.example`, spec smoke section already documents the live plan.

- [ ] **Step 1: `.env.example`** — under the Unipile/linkedin-infra section add:

```bash
# Custom domain for the white-labeled hosted-auth page (rule 04). When set, the adapter
# asserts the hosted-auth URL is on this domain; unset = warn-only.
HOSTED_AUTH_DOMAIN=
```

- [ ] **Step 2: Full gate** — `pnpm lint && pnpm type-check && pnpm test && pnpm build` → green.
- [ ] **Step 3: Audits** — `rls-auditor` on `0022`/`0023`; `whitelabel-auditor` (no "Unipile" on user surfaces); confirm suppression tests green.
- [ ] **Step 4: Commit** `docs: HOSTED_AUTH_DOMAIN env manifest`, push branch, report PR link.

## Activation checklist (needs creds; not code)
1. Set `UNIPILE_API_KEY` / `UNIPILE_DSN` / `UNIPILE_WEBHOOK_SECRET` (Vercel + Trigger).
2. Configure the Unipile hosted-auth **custom domain** vendor-side; set `HOSTED_AUTH_DOMAIN` to it (flips the assertion from warn → enforce).
3. Register the Unipile webhook at `/api/webhooks/linkedin` with the shared secret.
4. Live smoke per the spec (hosted-auth + domain assertion, webhook 200/401, invite/message, account_status incl. restricted).

## Self-Review
Spec coverage: weekly ceiling (T3) ✓; hosted-auth assertion (T2) ✓; linkedin_connected_at grant (T5) ✓; stage/channel check (T6) ✓; restriction mapping (T1 + T4) ✓; env + smoke (T7) ✓. Types: `"active"|"restricted"|"disconnected"` consistent across linkedin-infra `LinkedInEvent` (T1) and jobs `upsertLinkedInAccountStatus` (T4); `countLinkedInInvitesLast7Days` defined T3 used T3. No placeholders except the deliberately-illustrative join column in T3 Step 2 (implementer mirrors the real `countLinkedInSentToday` join).
