# Seller-Authored Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each seller author a value proposition, brand voice, and guardrails, and feed them into the copy/reply brains through the existing `leadBlock` path — with zero regression when the fields are blank.

**Architecture:** 3 nullable `accounts` columns + a client `UPDATE` grant. Capture the value prop at onboarding (scan-prefilled) and all three in a new Settings › Positioning page. The DB loaders map the columns onto the brain's `CopyContext` with `value_prop ?? website_scan.summary` precedence; `leadBlock` already renders all three, so no prompt change.

**Tech Stack:** Next.js App Router (server actions), Supabase Postgres + Drizzle, TypeScript strict, Vitest, pnpm.

## Global Constraints

- **Account resolution:** every write resolves the account from the session via an RLS-scoped `supabase.from("accounts").select("id").limit(1).maybeSingle()` — never an accountId param (rule 02/13).
- **Column grant (load-bearing):** `accounts` table-level UPDATE was revoked in `0013`; each client-writable column needs an explicit `grant update (col) on public.accounts to authenticated;`. New columns without it → onboarding/Settings save fails "permission denied". The migration MUST grant the 3 new columns.
- **No prompt rewrite:** `leadBlock` ([shared.ts:244-268](../../../packages/agent-brains/src/copy/shared.ts#L244)) already renders `Seller offer`/`Brand voice`/`Guardrails` when present. This is capture + storage + loader wiring only.
- **No regression when blank:** `valueProp = accounts.value_prop ?? website_scan.summary`; `brandVoice`/`guardrails` null → `leadBlock` omits them (byte-identical to today).
- **Opener stays de-pitched:** no change to `linkedin.ts` — it already forbids pitching the offer in the connection request; the value prop informs the conversation.
- **Never-hallucinate:** value prop + guardrails are seller-attested (same basis as proof points); voice = tone only; guardrails only add constraints. No new numeric-claim surface beyond what `findUngroundedClaims` already whitelists from grounding.
- **DoD (rule 12):** RLS/grant in the migration + rls-auditor pass; help article same PR (rule 09); TDD; no vendor names; full gate `pnpm lint && type-check && test` green.

## File Structure

- `packages/db/migrations/0061_seller_positioning.sql` — CREATE columns + grant (new).
- `packages/db/src/schema.ts` — add 3 columns to `accounts` (modify ~line 66).
- `packages/jobs/src/pipeline/types.ts` — add `valueProp`/`brandVoice`/`guardrails` to the store `CopyContext.account` type.
- `packages/jobs/src/pipeline/pg-store.ts` — populate the 3 fields in `getCopyContext` (~848), `getAccountProfileConfig` (~1394), `getResponderBundle` (~2176).
- `packages/jobs/src/pipeline/copy-draft.ts` — `toDraftInput` precedence + champion-path profile (~51, ~141).
- `apps/web/src/lib/validation.ts` — `validatePositioning` (new pure fn) + optional value-prop length in confirmation.
- `apps/web/src/app/(app)/settings/positioning/{page.tsx,positioning-form.tsx,actions.ts}` — new Settings page (new files).
- `apps/web/src/app/(app)/settings/page.tsx` — add a `SettingsLink` card (modify ~line 200).
- `apps/web/src/app/onboarding/{wizard.tsx,actions.ts,page.tsx}` — value-prop field + state + write.
- `packages/help-content/content/settings-positioning.md` — help article (new).

---

### Task 1: Migration + schema — 3 columns + client grant

**Files:**
- Create: `packages/db/migrations/0061_seller_positioning.sql`
- Modify: `packages/db/src/schema.ts` (accounts table, after `senderName` at line 66)
- Test: `packages/db/src/schema.test.ts`

**Interfaces:**
- Produces: `accounts.value_prop`, `accounts.brand_voice`, `accounts.guardrails` (all `text`, nullable), each client-updatable by workspace admins (existing `accounts_update` RLS policy + new column grant). Drizzle: `accounts.valueProp`, `accounts.brandVoice`, `accounts.guardrails`.

- [ ] **Step 1: Write the migration**

Create `packages/db/migrations/0061_seller_positioning.sql`:

```sql
-- 0061: seller-authored positioning — the seller's own value proposition, brand voice, and
-- guardrails, fed into the copy/reply brains via leadBlock. All nullable; blank = prior behavior
-- (valueProp falls back to the website-scan summary; voice/guardrails are simply omitted).
-- Captured at onboarding (value prop, scan-prefilled) and Settings › Positioning (all three).
alter table public.accounts add column if not exists value_prop text;
alter table public.accounts add column if not exists brand_voice text;
alter table public.accounts add column if not exists guardrails text;

-- accounts table-level UPDATE was revoked in 0013; each client-writable column needs its own
-- column grant (see 0007/0010/0012/0019/0039). The accounts_update RLS policy (0001) already
-- restricts WHICH rows (workspace admins); this grants WHICH columns.
grant update (value_prop, brand_voice, guardrails) on public.accounts to authenticated;
```

- [ ] **Step 2: Add the columns to the drizzle schema**

In `packages/db/src/schema.ts`, immediately after line 66 (`senderName: text("sender_name"),`):

```ts
  // 0061: seller-authored positioning — client-settable (Settings › Positioning + onboarding value
  // prop). Fed to the copy/reply brains via leadBlock; null falls back to the website-scan summary.
  valueProp: text("value_prop"),
  brandVoice: text("brand_voice"),
  guardrails: text("guardrails"),
```

- [ ] **Step 3: Write the guardrail test**

In `packages/db/src/schema.test.ts`, add (mirroring the existing accounts-column assertions):

```ts
it("exposes the seller-positioning columns on accounts", () => {
  expect(accounts.valueProp).toBeDefined();
  expect(accounts.brandVoice).toBeDefined();
  expect(accounts.guardrails).toBeDefined();
});

it("grants client UPDATE on the new positioning columns (0061)", () => {
  const sql = readFileSync(
    join(__dirname, "../migrations/0061_seller_positioning.sql"),
    "utf8"
  );
  expect(sql).toMatch(/grant update \(value_prop, brand_voice, guardrails\) on public\.accounts to authenticated/i);
});
```

(If `readFileSync`/`join` aren't already imported in the test, add `import { readFileSync } from "node:fs"; import { join } from "node:path";` — check the top of the file first; other migration-grant assertions in this repo use this pattern.)

- [ ] **Step 4: Run tests + rls-auditor**

Run: `pnpm --filter @vantera/db test`
Expected: PASS. Then run the `rls-auditor` subagent on the migration diff (rule 12) before committing.

- [ ] **Step 5: Commit**

```bash
git add packages/db/migrations/0061_seller_positioning.sql packages/db/src/schema.ts packages/db/src/schema.test.ts
git commit -m "$(printf 'feat(db): add seller-positioning columns to accounts (0061)\n\nvalue_prop / brand_voice / guardrails (nullable) + client UPDATE grant.\nBlank = prior behavior. RLS unchanged (accounts_update policy covers rows).\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Validation — `validatePositioning` (pure, TDD)

**Files:**
- Modify: `apps/web/src/lib/validation.ts`
- Test: `apps/web/src/lib/validation.test.ts`

**Interfaces:**
- Produces: `validatePositioning(input: { valueProp: string; brandVoice: string; guardrails: string }): Valid<{ valueProp: string | null; brandVoice: string | null; guardrails: string | null }> | Invalid` — trims, caps lengths, empty→null (all three optional).

- [ ] **Step 1: Write failing tests**

In `apps/web/src/lib/validation.test.ts`:

```ts
import { validatePositioning } from "./validation";

describe("validatePositioning", () => {
  it("trims and passes all three, empty → null", () => {
    const r = validatePositioning({ valueProp: "  We book qualified calls.  ", brandVoice: "", guardrails: "" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.values.valueProp).toBe("We book qualified calls.");
      expect(r.values.brandVoice).toBeNull();
      expect(r.values.guardrails).toBeNull();
    }
  });
  it("rejects an over-long value prop", () => {
    const r = validatePositioning({ valueProp: "x".repeat(801), brandVoice: "", guardrails: "" });
    expect(r.ok).toBe(false);
  });
  it("accepts all three when provided", () => {
    const r = validatePositioning({ valueProp: "V", brandVoice: "warm, direct", guardrails: "never claim SOC 2" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.guardrails).toBe("never claim SOC 2");
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `pnpm --filter @vantera/web test -- validation.test.ts -t validatePositioning`
Expected: FAIL — `validatePositioning is not a function`.

- [ ] **Step 3: Implement**

Add to `apps/web/src/lib/validation.ts` (uses the file's existing `Valid`/`Invalid` types):

```ts
const VALUE_PROP_MAX = 800;
const BRAND_VOICE_MAX = 300;
const GUARDRAILS_MAX = 800;

export function validatePositioning(input: {
  valueProp: string;
  brandVoice: string;
  guardrails: string;
}):
  | Valid<{ valueProp: string | null; brandVoice: string | null; guardrails: string | null }>
  | Invalid {
  const valueProp = input.valueProp.trim();
  const brandVoice = input.brandVoice.trim();
  const guardrails = input.guardrails.trim();
  if (valueProp.length > VALUE_PROP_MAX) return { ok: false, error: `Keep your value proposition under ${VALUE_PROP_MAX} characters.` };
  if (brandVoice.length > BRAND_VOICE_MAX) return { ok: false, error: `Keep the brand voice under ${BRAND_VOICE_MAX} characters.` };
  if (guardrails.length > GUARDRAILS_MAX) return { ok: false, error: `Keep guardrails under ${GUARDRAILS_MAX} characters.` };
  return {
    ok: true,
    values: {
      valueProp: valueProp || null,
      brandVoice: brandVoice || null,
      guardrails: guardrails || null,
    },
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @vantera/web test -- validation.test.ts -t validatePositioning`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/validation.ts apps/web/src/lib/validation.test.ts
git commit -m "$(printf 'feat(web): add validatePositioning (value prop, voice, guardrails)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Loader wiring — populate the 3 fields with `?? scan` precedence (TDD)

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (store `CopyContext.account` type)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`getCopyContext` ~848, `getAccountProfileConfig` ~1394, `getResponderBundle` ~2176)
- Modify: `packages/jobs/src/pipeline/copy-draft.ts` (`toDraftInput` ~51, champion path ~141)
- Test: `packages/jobs/src/pipeline/copy-draft.test.ts` (+ responder bundle test if colocated)

**Interfaces:**
- Consumes: `accounts.valueProp`/`brandVoice`/`guardrails` (Task 1).
- Produces: the brain `CopyContext.valueProp` = `account.value_prop ?? website_scan.summary`; `CopyContext.brandVoice` = `account.brand_voice`; `CopyContext.guardrails` = `account.guardrails` — on both first-touch and responder paths.

- [ ] **Step 1: Extend the store `CopyContext.account` type**

In `packages/jobs/src/pipeline/types.ts`, find the `CopyContext` interface's `account: { industry: ...; websiteScan: ... }` and add:

```ts
    /** 0061 seller-authored positioning (null → falls back to the website-scan summary / omitted). */
    valueProp: string | null;
    brandVoice: string | null;
    guardrails: string | null;
```

- [ ] **Step 2: Populate in `getCopyContext`**

In `pg-store.ts` `getCopyContext` (the `account:` object at ~848-851), change:

```ts
        account: {
          industry: account.onboardingIndustry,
          websiteScan: account.websiteScan as CopyContext["account"]["websiteScan"],
          valueProp: account.valueProp,
          brandVoice: account.brandVoice,
          guardrails: account.guardrails,
        },
```

- [ ] **Step 3: Use them in `toDraftInput` (first touch)**

In `copy-draft.ts` `toDraftInput` (the `context:` object ~43-56), change the `valueProp` line and add voice + guardrails:

```ts
      accountIndustry: ctx.account.industry,
      // 0061: seller-authored positioning wins; the website-scan summary is the fallback.
      valueProp: ctx.account.valueProp ?? ctx.account.websiteScan?.summary ?? null,
      brandVoice: ctx.account.brandVoice ?? null,
      guardrails: ctx.account.guardrails ?? null,
      avoidPhrases,
```

Also update the champion-path `deriveAccountProfile` call (~141) so the trust read uses the authored value prop:

```ts
        valueProp: ctx.account.valueProp ?? ctx.account.websiteScan?.summary ?? null,
```

- [ ] **Step 4: Populate in `getResponderBundle` + `getAccountProfileConfig`**

In `pg-store.ts` `getResponderBundle` (`context:` ~2176), change `valueProp` and add voice + guardrails:

```ts
          accountIndustry: account?.onboardingIndustry ?? null,
          valueProp: account?.valueProp ?? scan?.summary ?? null,
          brandVoice: account?.brandVoice ?? null,
          guardrails: account?.guardrails ?? null,
          avoidPhrases: await recentSendOpeners(db, accountId),
```

In `getAccountProfileConfig` (~1394), change:

```ts
        valueProp: account.valueProp ?? scan?.summary ?? null,
```

(Confirm `account` there is the full accounts row; the region already reads `scan = account?.websiteScan`.)

- [ ] **Step 5: Write/extend tests**

In `packages/jobs/src/pipeline/copy-draft.test.ts`, add a store fake account with the new fields and assert the precedence. Follow the file's existing `getCopyContext` fake pattern; the key assertions:

```ts
it("prefers the seller's authored value prop over the scan summary (first touch)", async () => {
  // build ctx with account.valueProp = "Authored offer.", websiteScan.summary = "Scanned."
  // run the draft; assert the prompt/DraftInput carries "Authored offer." not "Scanned."
});
it("falls back to the scan summary when value_prop is null", async () => {
  // account.valueProp = null, websiteScan.summary = "Scanned." → valueProp === "Scanned."
});
it("passes brand voice + guardrails through to the draft context", async () => {
  // account.brandVoice = "warm", guardrails = "never claim SOC 2" → both present on context
});
```

(Match the existing test's construction of the store fake and how it inspects `toDraftInput`/the drafted prompt. If `toDraftInput` isn't exported, assert via the drafted send/prompt the same way current tests do.)

- [ ] **Step 6: Run**

Run: `pnpm --filter @vantera/jobs test -- copy-draft.test.ts`
Expected: PASS (new precedence tests + all existing draft tests green).

- [ ] **Step 7: Commit**

```bash
git add packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.ts packages/jobs/src/pipeline/copy-draft.ts packages/jobs/src/pipeline/copy-draft.test.ts
git commit -m "$(printf 'feat(jobs): feed seller positioning into copy/reply loaders\n\nvalueProp = accounts.value_prop ?? website_scan.summary; brandVoice +\nguardrails from accounts. First-touch + responder + profile-config paths.\nBlank = byte-identical to before.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Settings › Positioning page

**Files:**
- Create: `apps/web/src/app/(app)/settings/positioning/page.tsx`, `positioning-form.tsx`, `actions.ts`
- Modify: `apps/web/src/app/(app)/settings/page.tsx` (add a `SettingsLink` card)
- Test: none automated for the page; the action's validation is covered by Task 2. Manual verify in Step 5.

**Interfaces:**
- Consumes: `validatePositioning` (Task 2), `accounts.value_prop`/`brand_voice`/`guardrails` (Task 1).
- Produces: `updatePositioning(_prev, formData): Promise<SettingsState>`.

- [ ] **Step 1: The action** — `apps/web/src/app/(app)/settings/positioning/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePositioning } from "@/lib/validation";

export type PositioningState = { error?: string; saved?: boolean };

export async function updatePositioning(
  _prev: PositioningState,
  formData: FormData
): Promise<PositioningState> {
  const result = validatePositioning({
    valueProp: String(formData.get("valueProp") ?? ""),
    brandVoice: String(formData.get("brandVoice") ?? ""),
    guardrails: String(formData.get("guardrails") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const { data: account } = await supabase.from("accounts").select("id").limit(1).maybeSingle<{ id: string }>();
  if (!account) return { error: "Your session expired. Sign in again." };

  const { error } = await supabase
    .from("accounts")
    .update({
      value_prop: result.values.valueProp,
      brand_voice: result.values.brandVoice,
      guardrails: result.values.guardrails,
    })
    .eq("id", account.id); // RLS: admins only
  if (error) return { error: "Could not save. Only workspace admins can change positioning." };
  revalidatePath("/settings/positioning");
  return { saved: true };
}
```

- [ ] **Step 2: The form** — `apps/web/src/app/(app)/settings/positioning/positioning-form.tsx`

```tsx
"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/form-error";
import { updatePositioning, type PositioningState } from "./actions";

export function PositioningForm({ initial }: { initial: { valueProp: string; brandVoice: string; guardrails: string } }) {
  const [state, action, pending] = useActionState<PositioningState, FormData>(updatePositioning, {});
  return (
    <form action={action} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="valueProp">Value proposition</Label>
        <Textarea id="valueProp" name="valueProp" rows={3} defaultValue={initial.valueProp}
          placeholder="In your own words: what you do, for whom, and why it's worth their time." className="text-sm" />
        <p className="text-xs text-muted-foreground">How the agent describes what you do in a conversation. If blank, we use what we read from your site.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="brandVoice">Brand voice</Label>
        <Input id="brandVoice" name="brandVoice" defaultValue={initial.brandVoice} placeholder="e.g. warm, direct, hospitality-insider" />
        <p className="text-xs text-muted-foreground">The tone your messages should match.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="guardrails">Guardrails</Label>
        <Textarea id="guardrails" name="guardrails" rows={3} defaultValue={initial.guardrails}
          placeholder={"Things the agent must never say. One per line.\ne.g. Never claim we're SOC 2 certified."} className="text-sm" />
        <p className="text-xs text-muted-foreground">Hard limits the agent will never cross in any message.</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save positioning"}</Button>
        <FormError message={state.error} />
        {state.saved && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
    </form>
  );
}
```

- [ ] **Step 3: The page** — `apps/web/src/app/(app)/settings/positioning/page.tsx` (mirrors proof/page.tsx server-component pattern)

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PositioningForm } from "./positioning-form";

export const metadata = { title: "Positioning" };

type Row = { value_prop: string | null; brand_voice: string | null; guardrails: string | null };

export default async function PositioningPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("value_prop, brand_voice, guardrails")
    .limit(1)
    .maybeSingle<Row>();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Positioning</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          How your agent describes what you do, the voice it writes in, and the lines it must never cross.{" "}
          <Link href="/settings" className="underline underline-offset-2">Back to settings</Link>
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Your positioning</CardTitle></CardHeader>
        <CardContent>
          <PositioningForm
            initial={{
              valueProp: data?.value_prop ?? "",
              brandVoice: data?.brand_voice ?? "",
              guardrails: data?.guardrails ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Register the nav card** — in `apps/web/src/app/(app)/settings/page.tsx`, add next to the "Proof & pricing" `SettingsLink`:

```tsx
      <SettingsLink
        title="Positioning"
        body="Your value proposition, brand voice, and the guardrails your agent must never cross."
        href="/settings/positioning"
        cta="Manage positioning"
      />
```

- [ ] **Step 5: Verify**

Run: `pnpm --filter @vantera/web type-check` (expected clean). Then manual: load `/settings/positioning`, save all three fields, reload → values persist; as a non-admin the save shows the admin-only error.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/settings/positioning" "apps/web/src/app/(app)/settings/page.tsx"
git commit -m "$(printf 'feat(web): Settings > Positioning (value prop, voice, guardrails)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Onboarding value-prop capture (scan-prefilled)

**Files:**
- Modify: `apps/web/src/app/onboarding/actions.ts` (`savePersonalize` return + `findFirstLeads` write)
- Modify: `apps/web/src/app/onboarding/wizard.tsx` (state + Confirm-step field)
- Modify: `apps/web/src/app/onboarding/page.tsx` (seed `init.values.valueProp`)

**Interfaces:**
- Consumes: `website_scan.summary`, `accounts.value_prop`.
- Produces: `findFirstLeads` writes `accounts.value_prop` from the confirmed field.

- [ ] **Step 1: Surface the scan summary to the client**

In `apps/web/src/app/onboarding/actions.ts`, extend `PersonalizeState.scan` (line ~26) and the `savePersonalize` return (~90) to include `summary`:

```ts
  scan?: { headline: string; summary: string; suggested_icp: string; scope_of_industry: string };
```
and in the return object add `summary: scan.summary,` alongside `headline`.

- [ ] **Step 2: Seed + write the value prop**

In `apps/web/src/app/onboarding/page.tsx`, add to `init.values` (mirroring the `industry`/`icp` seeding at ~82-92):

```tsx
      valueProp: account?.value_prop ?? scan?.summary ?? "",
```
(and add `valueProp: string;` to the `WizardInit.values` type in `wizard.tsx` ~28-38.)

In `apps/web/src/app/onboarding/actions.ts` `findFirstLeads`, add to the `accounts` UPDATE `.set({...})` (the block at ~208-217):

```ts
      value_prop: String(formData.get("valueProp") ?? "").trim() || null,
```
(No hard validation needed — it's optional and length-guarded in Settings; onboarding just persists the confirmed text. Keep it lenient so a blank never blocks the flow.)

- [ ] **Step 3: The Confirm-step field**

In `wizard.tsx`, add same-session prefill in the `savePersonalize`-resolved block (~172-183), inside the `if (scan)`:

```tsx
          valueProp: v.valueProp || scan.summary,
```

Then add the field in the Confirm form, after the industry `Field` (~438), using `Textarea` (import it: `import { Textarea } from "@/components/ui/textarea";`):

```tsx
                        <Field
                          label="How should the agent describe what you do?"
                          hint={derivedFromSite ? "Pulled from your site — edit if it's off. This is your positioning in conversations." : "One or two sentences: what you do, for whom, and why it matters."}
                        >
                          <Textarea
                            name="valueProp"
                            value={values.valueProp}
                            onChange={(e) => setValues({ ...values, valueProp: e.target.value })}
                            rows={3}
                            placeholder="e.g. We book qualified sales calls for B2B SaaS teams without the SDR overhead."
                            className={FIELD + " h-auto py-3"}
                          />
                        </Field>
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @vantera/web type-check` (clean). Manual: fresh onboarding with a scannable site → Confirm step shows the value-prop prefilled; edit + submit; check `/settings/positioning` shows the edited text.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/onboarding
git commit -m "$(printf 'feat(web): capture value prop at onboarding (scan-prefilled)\n\nConfirm-step textarea prefilled from the website scan; findFirstLeads writes\naccounts.value_prop. Editable later in Settings > Positioning.\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: Help article + full gate + ship

**Files:**
- Create: `packages/help-content/content/settings-positioning.md`

- [ ] **Step 1: Help article** (rule 09 — frontmatter `title`/`surface`/`routes`; no vendor names):

```md
---
title: Positioning — value prop, brand voice, guardrails
surface: settings
routes: ["/settings/positioning"]
---

Your **positioning** is how your agent represents you: the value proposition it uses in conversations, the voice it writes in, and the guardrails it must never cross.

- **Value proposition** — one or two sentences on what you do, for whom, and why it matters. Your agent uses this when a prospect asks what you do. If you leave it blank, we use what we read from your website.
- **Brand voice** — the tone your messages should match (e.g. "warm, direct").
- **Guardrails** — hard limits the agent will never cross, one per line (e.g. "Never claim we're SOC 2 certified"). Your agent honors these in every message.

The cold connection request stays deliberately un-pitched — positioning shapes the conversation once someone replies, not the first touch.
```

- [ ] **Step 2: Run the help-content test**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS (frontmatter valid, no vendor names). Run the `whitelabel-auditor` subagent over the new surfaces.

- [ ] **Step 3: Full gate**

Run: `pnpm lint && pnpm type-check && pnpm test`
Expected: all green. Fix any issues in touched files.

- [ ] **Step 4: Commit + push**

```bash
git add packages/help-content/content/settings-positioning.md
git commit -m "$(printf 'docs(help): settings-positioning article (knowledge-sync)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
git push origin HEAD:main
```

- [ ] **Step 5: Verify prod**

Watch CI (lint/type-check/test/build) + the Trigger.dev deploy + post-deploy verify (`list_deploys` / `get_current_worker` confirm the new prod worker). Apply migration 0061 to prod per the migration workflow (rule 10 — migrations applied to prod via CLI/MCP, committed first). Confirm onboarding + Settings save writes land.

- [ ] **Step 6: Update memory**

Note the seller-positioning feature shipped, linked from `[[project-vantera-conversation-engine-quality]]` and the positioning-analysis; record that `brandVoice`/`guardrails` are now live (no longer dead fields).

---

## Self-Review

**Spec coverage:** value prop capture (Task 5) + Settings (Task 4) + storage (Task 1) + injection with `?? scan` precedence (Task 3) ✓; voice + guardrails end-to-end — storage (1), Settings (4), injection everywhere incl. first touch (3) ✓; opener stays de-pitched — no linkedin.ts change (Global Constraints) ✓; no-regression-when-blank — `?? scan` + null-omit (3) ✓; never-hallucinate — seller-attested, no new numeric surface (Global Constraints) ✓; DoD — migration grant + RLS (1), help article (6), TDD (2/3), no vendor names (6) ✓.

**Placeholder scan:** the only non-verbatim steps are Task 3 Step 5 and the Task 4/5 manual-verify (UI) — these reference "mirror the existing fake/pattern" because the exact test-fake construction and JSX live in files the implementer will open; every logic/code change (migration, schema, validation, loader edits, action, form, page) has complete code.

**Type consistency:** `validatePositioning` signature identical across Task 2 (def) and Task 4 (use). Store `CopyContext.account` gains `valueProp/brandVoice/guardrails` (Task 3 Step 1) matching their reads in Steps 2-4. Column names `value_prop`/`brand_voice`/`guardrails` consistent across migration, schema (`valueProp`/`brandVoice`/`guardrails` camelCase), loaders, action, and grant.
