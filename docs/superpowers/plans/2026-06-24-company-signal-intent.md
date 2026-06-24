# Company-Signal Intent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track company events (funding, M&A, exec hires, launches, partnerships, office openings) as buying signals from an Apify company-news source, gated to the Intent entitlement (Growth + Scale), feeding the existing rank + `lead_signals` display path.

**Architecture:** A new `CompanySignalSource` provider (interface + in-memory fake + Apify adapter) returns `ProspectSignal[]` per company. The Scout enrichment stage — for accounts with `features.intent` — fetches signals for gate survivors (deduped by company), attaches them to the rank candidates' `signals` field (so a fresh event can lift the score) and persists them via the existing `saveEnrichment` → `lead_signals` write. No new table, no new display.

**Tech Stack:** TypeScript (strict), Apify REST (`run-sync-get-dataset-items`), Vitest, Trigger.dev v4, `@vantera/billing` for the entitlement check.

## Global Constraints

- Provider behind an interface; vendor name ("Apify") never appears in any DTO, log, error, or UI string (white-label, rule 13).
- `ProspectSignal` shape is the contract: `{ kind: string; label?: string; detail: string; level?: string; observedAt?: string }`. Categories: `funding, exec_hire, m_and_a, office_opening, product_launch, partnership` (+ existing others).
- Fail-open (rule 04/05): a flaky/missing source returns an empty map; the Scout run always completes and leads are still scored.
- Spend only on gate survivors (rule 05); dedupe one fetch per company per run; bound companies-per-run.
- Gating is `features.intent` from `@vantera/billing` (Growth + Scale true, Starter false) — single source of truth, no duplicated logic. Auto-on, no setup.
- Recency window 90 days; events older are dropped at the adapter (stale ≠ active intent, rule 06).
- AI only via existing `rankFn`/`getModel()`; no new AI calls here.

---

### Task 1: CompanySignalSource interface + classify + in-memory fake

**Files:**
- Create: `packages/prospect-data/src/company-signals.ts`
- Test: `packages/prospect-data/src/company-signals.test.ts`
- Modify: `packages/prospect-data/src/index.ts` (export the new symbols)

**Interfaces:**
- Consumes: `ProspectSignal` from `./types`.
- Produces:
  ```ts
  export interface CompanyRef { name: string; domain?: string | null }
  export interface CompanySignalSource {
    getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>>;
  }
  export function companyKey(ref: CompanyRef): string;            // lowercased domain || lowercased name
  export function classifyCompanyEvent(headline: string): string | null; // ProspectSignal.kind or null
  export class InMemoryCompanySignals implements CompanySignalSource { constructor(seed?: Map<string, ProspectSignal[]>) }
  ```

- [ ] **Step 1: Write the failing test** (`company-signals.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { classifyCompanyEvent, companyKey, InMemoryCompanySignals } from "./company-signals";

describe("companyKey", () => {
  it("prefers domain, lowercased; falls back to name", () => {
    expect(companyKey({ name: "Acme Co", domain: "Acme.com" })).toBe("acme.com");
    expect(companyKey({ name: "Acme Co" })).toBe("acme co");
  });
});

describe("classifyCompanyEvent", () => {
  it("maps headlines to the right signal kind", () => {
    expect(classifyCompanyEvent("Acme raises $20M Series B")).toBe("funding");
    expect(classifyCompanyEvent("Acme acquires Beta in merger")).toBe("m_and_a");
    expect(classifyCompanyEvent("Acme appoints new VP of Sales")).toBe("exec_hire");
    expect(classifyCompanyEvent("Acme launches new platform")).toBe("product_launch");
    expect(classifyCompanyEvent("Acme partners with Globex")).toBe("partnership");
    expect(classifyCompanyEvent("Acme opens a London office")).toBe("office_opening");
  });
  it("returns null for unmatched / noise", () => {
    expect(classifyCompanyEvent("Acme releases quarterly blog post")).toBeNull();
    expect(classifyCompanyEvent("")).toBeNull();
  });
});

describe("InMemoryCompanySignals", () => {
  it("returns seeded signals by companyKey and empty for unknown", async () => {
    const seed = new Map([["acme.com", [{ kind: "funding", detail: "raised Series B", observedAt: "2026-06-20" }]]]);
    const src = new InMemoryCompanySignals(seed);
    const out = await src.getCompanySignals([{ name: "Acme", domain: "acme.com" }, { name: "Nope" }]);
    expect(out.get("acme.com")?.[0]?.kind).toBe("funding");
    expect(out.get("nope")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @vantera/prospect-data test company-signals` → FAIL (module missing).
- [ ] **Step 3: Implement** `company-signals.ts`:

```ts
import type { ProspectSignal } from "./types";

export interface CompanyRef {
  name: string;
  domain?: string | null;
}

export interface CompanySignalSource {
  /** Company events per company, normalized to ProspectSignal, keyed by companyKey(ref).
   *  Implementations fail open: a bad fetch returns an empty map, never throws to the caller. */
  getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>>;
}

/** Stable per-company key: domain wins (canonical), else the name. Both lowercased/trimmed. */
export function companyKey(ref: CompanyRef): string {
  return (ref.domain?.trim() || ref.name.trim()).toLowerCase();
}

/** Deterministic headline → ProspectSignal.kind. Null = not a buying event (dropped, no noise). */
export function classifyCompanyEvent(headline: string): string | null {
  const h = headline.toLowerCase();
  if (/\b(raises?|raised|secures?|closes?)\b.*\b(round|seed|series\s+[a-z]|funding|\$)/.test(h) || /\bseries\s+[a-z]\b/.test(h)) return "funding";
  if (/\b(acquires?|acquired|acquisition|merger|merges?\s+with)\b/.test(h)) return "m_and_a";
  if (/\b(appoints?|names?|hires?|joins?\s+as|new\s+(ceo|cfo|cto|coo|vp|chief|head\s+of)|promotes?)\b/.test(h)) return "exec_hire";
  if (/\b(launches?|unveils?|introduces?|releases?\s+new\s+(product|platform))\b/.test(h)) return "product_launch";
  if (/\b(partners?\s+with|partnership|teams?\s+up\s+with|integrat)/.test(h)) return "partnership";
  if (/\b(opens?\s+.*office|new\s+office|expands?\s+to|opens?\s+headquarters)\b/.test(h)) return "office_opening";
  return null;
}

export class InMemoryCompanySignals implements CompanySignalSource {
  constructor(private readonly seed: Map<string, ProspectSignal[]> = new Map()) {}
  async getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>> {
    const out = new Map<string, ProspectSignal[]>();
    for (const c of companies) {
      const sig = this.seed.get(companyKey(c));
      if (sig && sig.length > 0) out.set(companyKey(c), sig);
    }
    return out;
  }
}
```

- [ ] **Step 4: Run** the test → PASS. Add exports to `index.ts`:
  `export { companyKey, classifyCompanyEvent, InMemoryCompanySignals } from "./company-signals";`
  `export type { CompanyRef, CompanySignalSource } from "./company-signals";`
- [ ] **Step 5: Commit** `feat(prospect-data): CompanySignalSource interface + event classifier + fake`.

---

### Task 2: Apify company-news adapter

**Files:**
- Create: `packages/prospect-data/src/apify-company-signals.ts`
- Test: `packages/prospect-data/src/apify-company-signals.test.ts`
- Modify: `packages/prospect-data/src/index.ts` (export `ApifyCompanySignals`)

**Interfaces:**
- Consumes: `CompanySignalSource`, `companyKey`, `classifyCompanyEvent` (Task 1); `ProspectSignal`.
- Produces: `export class ApifyCompanySignals implements CompanySignalSource` with
  `constructor(opts: { token: string; actorId: string; recencyDays?: number; fetchImpl?: typeof fetch; baseUrl?: string })`.

- [ ] **Step 1: Write the failing test** (inject `fetchImpl`, mirror `apify.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { ApifyCompanySignals } from "./apify-company-signals";

function fakeFetch(items: unknown) {
  return async () => new Response(JSON.stringify(items), { status: 200 });
}

describe("ApifyCompanySignals", () => {
  const now = new Date("2026-06-24T00:00:00Z");

  it("classifies + normalizes recent news into ProspectSignal, keyed by company", async () => {
    const src = new ApifyCompanySignals({
      token: "t", actorId: "user/news",
      fetchImpl: fakeFetch([
        { companyName: "Acme", companyDomain: "acme.com", title: "Acme raises $20M Series B", date: "2026-06-20" },
        { companyName: "Acme", companyDomain: "acme.com", title: "Acme quarterly blog recap", date: "2026-06-21" }, // unmatched → dropped
      ]),
      now: () => now,
    });
    const out = await src.getCompanySignals([{ name: "Acme", domain: "acme.com" }]);
    const sigs = out.get("acme.com")!;
    expect(sigs).toHaveLength(1);
    expect(sigs[0]!.kind).toBe("funding");
    expect(sigs[0]!.observedAt).toBe("2026-06-20");
    expect(JSON.stringify(sigs)).not.toMatch(/apify/i); // white-label
  });

  it("drops events older than the recency window", async () => {
    const src = new ApifyCompanySignals({
      token: "t", actorId: "user/news", recencyDays: 90,
      fetchImpl: fakeFetch([{ companyName: "Old", title: "Old raises Series A", date: "2026-01-01" }]),
      now: () => now,
    });
    const out = await src.getCompanySignals([{ name: "Old" }]);
    expect(out.get("old")).toBeUndefined();
  });

  it("fails open on a non-200 (returns empty map, never throws)", async () => {
    const src = new ApifyCompanySignals({
      token: "t", actorId: "user/news",
      fetchImpl: async () => new Response("nope", { status: 500 }),
    });
    await expect(src.getCompanySignals([{ name: "Acme" }])).resolves.toEqual(new Map());
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter @vantera/prospect-data test apify-company-signals` → FAIL.
- [ ] **Step 3: Implement** `apify-company-signals.ts`:

```ts
import { classifyCompanyEvent, companyKey, type CompanyRef, type CompanySignalSource } from "./company-signals";
import type { ProspectSignal } from "./types";

type Item = Record<string, unknown>;
const DEFAULT_BASE_URL = "https://api.apify.com";
const DEFAULT_RECENCY_DAYS = 90;

function str(item: Item, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

/**
 * Company-news → buying signals (rule 05/13). The data provider is an implementation detail behind
 * CompanySignalSource — its name never leaves this file. Runs one actor call for the batch, classifies
 * each headline deterministically, and keeps only recent, recognized events. Fails open: any error or
 * non-200 yields an empty map so a flaky read never breaks a Scout run (rule 04).
 */
export class ApifyCompanySignals implements CompanySignalSource {
  private readonly token: string;
  private readonly actorId: string;
  private readonly recencyDays: number;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(opts: {
    token: string; actorId: string; recencyDays?: number;
    baseUrl?: string; fetchImpl?: typeof fetch; now?: () => Date;
  }) {
    this.token = opts.token;
    this.actorId = opts.actorId;
    this.recencyDays = opts.recencyDays ?? DEFAULT_RECENCY_DAYS;
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? (() => new Date());
  }

  async getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>> {
    const out = new Map<string, ProspectSignal[]>();
    if (companies.length === 0) return out;
    let items: Item[] = [];
    try {
      const actor = this.actorId.replace("/", "~");
      const res = await this.fetchImpl(`${this.baseUrl}/v2/acts/${actor}/run-sync-get-dataset-items`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
        body: JSON.stringify({ companies: companies.map((c) => ({ name: c.name, domain: c.domain ?? undefined })) }),
      });
      if (!res.ok) return out; // fail open
      const json = (await res.json()) as unknown;
      items = Array.isArray(json)
        ? (json as Item[])
        : Array.isArray((json as { items?: unknown }).items)
          ? (json as { items: Item[] }).items
          : Array.isArray((json as { data?: unknown }).data)
            ? (json as { data: Item[] }).data
            : [];
    } catch {
      return out; // fail open
    }

    const cutoff = this.now().getTime() - this.recencyDays * 86_400_000;
    for (const item of items) {
      const headline = str(item, "title", "headline", "summary");
      const name = str(item, "companyName", "company", "name");
      if (!headline || !name) continue;
      const kind = classifyCompanyEvent(headline);
      if (!kind) continue;
      const dateStr = str(item, "date", "publishedAt", "published_at", "time");
      const when = dateStr ? Date.parse(dateStr) : NaN;
      if (Number.isFinite(when) && when < cutoff) continue; // stale
      const ref: CompanyRef = { name, domain: str(item, "companyDomain", "domain") ?? null };
      const key = companyKey(ref);
      const sig: ProspectSignal = { kind, detail: headline, label: headline, observedAt: dateStr };
      const list = out.get(key) ?? [];
      list.push(sig);
      out.set(key, list);
    }
    return out;
  }
}
```

- [ ] **Step 4: Run** the test → PASS. Export `ApifyCompanySignals` from `index.ts`.
- [ ] **Step 5: Commit** `feat(prospect-data): Apify company-news adapter (fail-open, recency-filtered)`.

---

### Task 3: Gate the Scout on features.intent + carry the flag in context

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts` (`ScoutContext.account` += `intentEnabled`; `ScoutDeps` += `companySignals`)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`getScoutContext` resolves `intentEnabled`)
- Test: `packages/jobs/src/pipeline/scout.test.ts` (context factory + gating)

**Interfaces:**
- Consumes: `CompanySignalSource` (Task 1).
- Produces: `ScoutContext.account.intentEnabled: boolean`; `ScoutDeps.companySignals?: CompanySignalSource`.

- [ ] **Step 1:** In `types.ts`, add to `ScoutContext.account`: `intentEnabled: boolean;` (with a comment: features.intent — Growth/Scale; gates the company-signal fetch). Add to `ScoutDeps`: `companySignals?: import("@vantera/prospect-data").CompanySignalSource;`.
- [ ] **Step 2:** In `pg-store.ts` `getScoutContext`, compute `intentEnabled` from the account's plan + status using `@vantera/billing`:
  `import { resolveEntitlements } from "@vantera/billing";` then
  `intentEnabled: resolveEntitlements({ plan: account.plan, subscriptionStatus: account.subscriptionStatus, seatsPurchased: 0, linkedinAccountsPurchased: 0, currentPeriodEnd: null }).features.intent` (select `accounts.plan` in the query if not already selected).
- [ ] **Step 3:** Update `scout.test.ts` `makeContext` to set `intentEnabled: false` by default (existing tests keep current behavior — no company fetch). Run `pnpm --filter @vantera/jobs test scout` → PASS (type + existing behavior).
- [ ] **Step 4: Commit** `feat(jobs): carry features.intent on the scout context + companySignals dep`.

---

### Task 4: Fetch + attach company signals in the Scout enrichment stage

**Files:**
- Modify: `packages/jobs/src/pipeline/scout.ts` (between `enrichedByRef` and the rank-candidate loop)
- Test: `packages/jobs/src/pipeline/scout.test.ts`

**Interfaces:**
- Consumes: `ScoutContext.account.intentEnabled`, `ScoutDeps.companySignals`, `companyKey`, `saveEnrichment`.

- [ ] **Step 1: Write failing tests** in `scout.test.ts`:
  - With `intentEnabled: true` and an `InMemoryCompanySignals` seeded for the survivor's company, the lead's rank candidate carries the funding signal AND `saveEnrichment` is called with it (assert via a fake store capture).
  - With `intentEnabled: false`, `companySignals.getCompanySignals` is NEVER called (spy count 0).
  - Two survivors at the same company → `getCompanySignals` receives ONE company entry (dedupe).
  - Source throwing → run still completes, leads still scored (fail-open).

```ts
it("attaches company signals to qualified leads when intent is enabled", async () => {
  const seed = new Map([["acme.com", [{ kind: "funding", detail: "raised Series B", observedAt: "2026-06-20" }]]]);
  const deps = makeDeps(store, { companySignals: new InMemoryCompanySignals(seed) });
  store.context = makeContext({ intentEnabled: true });
  // ...survivor with companyName Acme / domain acme.com...
  await runScout(deps);
  expect(store.enrichmentSaved.some((e) => e.signals?.[0]?.kind === "funding")).toBe(true);
});
```

- [ ] **Step 2: Run** `pnpm --filter @vantera/jobs test scout` → FAIL.
- [ ] **Step 3: Implement** in `scout.ts`, right after `enrichedByRef` is built and before the `rankCandidates` loop:

```ts
// Company-event signals (Phase 15) — only for Intent-entitled plans (Growth/Scale), fetched once
// per company for this run's survivors, attached to the rank (can lift score) + persisted to
// lead_signals for the "why now" display. Fail-open: any error → no signals, run continues.
const companySignalsByKey = new Map<string, import("@vantera/prospect-data").ProspectSignal[]>();
if (ctx.account.intentEnabled && deps.companySignals) {
  const seen = new Set<string>();
  const companies: { name: string; domain?: string | null }[] = [];
  for (const s of survivors) {
    const name = s.candidate.companyName;
    if (!name) continue;
    const key = companyKey({ name, domain: s.candidate.companyDomain });
    if (seen.has(key)) continue;
    seen.add(key);
    companies.push({ name, domain: s.candidate.companyDomain });
  }
  if (companies.length > 0) {
    try {
      const map = await deps.companySignals.getCompanySignals(companies);
      for (const [k, v] of map) companySignalsByKey.set(k, v);
    } catch {
      /* fail open */
    }
  }
}
```

  Then in the `rankCandidates` loop, resolve per-lead signals and persist:

```ts
const enriched = enrichedByRef.get(lead.candidate.externalRef);
const compSignals = lead.candidate.companyName
  ? companySignalsByKey.get(companyKey({ name: lead.candidate.companyName, domain: lead.candidate.companyDomain }))
  : undefined;
const signals = compSignals ?? enriched?.signals;
if (enriched) await deps.store.saveEnrichment(lead.leadId, accountId, enriched);
else if (compSignals && compSignals.length > 0)
  await deps.store.saveEnrichment(lead.leadId, accountId, { ...lead.candidate, signals: compSignals });
rankCandidates.push({
  leadId: lead.leadId,
  companyName: lead.candidate.companyName,
  companySize: enriched?.companySize ?? lead.candidate.companySize,
  industry: enriched?.industry ?? lead.candidate.industry,
  location: enriched?.location ?? lead.candidate.location,
  title: lead.candidate.title,
  technographics: enriched?.technographics,
  signals,
});
```

  (Add `import { companyKey } from "@vantera/prospect-data";` at the top.)

- [ ] **Step 4: Run** `pnpm --filter @vantera/jobs test scout` → PASS.
- [ ] **Step 5: Commit** `feat(jobs): fetch + attach company-event signals on Intent plans (qualify + display)`.

---

### Task 5: Wire the real adapter into the Scout trigger + knowledge-sync + gate

**Files:**
- Modify: `packages/jobs/src/trigger/scout-run.ts` (construct `ApifyCompanySignals` from env, or omit when unset)
- Modify: `packages/help-content/content/billing.md` or `agents-intent.md` (one line: Growth/Scale track company events)
- Modify: `docs/roadmap.md` (Phase 15 entry)
- Modify: `.env.example` (`APIFY_COMPANY_NEWS_ACTOR`)

- [ ] **Step 1:** In `scout-run.ts`, build the dep only when configured (fail-open by omission):
  ```ts
  const companyActor = process.env.APIFY_COMPANY_NEWS_ACTOR;
  const companySignals = companyActor && process.env.APIFY_TOKEN
    ? new ApifyCompanySignals({ token: process.env.APIFY_TOKEN, actorId: companyActor })
    : undefined;
  ```
  Pass `companySignals` into the `runScout` deps.
- [ ] **Step 2:** Add `APIFY_COMPANY_NEWS_ACTOR=` to `.env.example` with a comment (company-news actor for Intent-plan buying signals).
- [ ] **Step 3:** Knowledge-sync: add one line to `agents-intent.md` (or `billing.md`) — "On Growth and Scale, Intent also tracks company events (funding, M&A, exec hires) as buying signals, automatically." No vendor name. Confirm `articles.test.ts` green.
- [ ] **Step 4:** Add the Phase 15 entry to `docs/roadmap.md` (checked).
- [ ] **Step 5:** Full gate: `pnpm lint && pnpm type-check && pnpm test && pnpm build` → green; `whitelabel-auditor` (inline) on the diff. Commit `feat(jobs): wire Apify company-news source + knowledge-sync (Phase 15)`.

---

## Notes for execution
- Owner remainder: pick the Apify company-news actor + set `APIFY_COMPANY_NEWS_ACTOR` in Trigger + Vercel prod (`APIFY_TOKEN` already set). Until then `companySignals` is `undefined` and the stage no-ops — nothing breaks.
- `leads.companyDomain` already exists on the candidate/lead (`company_domain`); use it for `companyKey`. If a survivor has no domain, the name is the key.
- Cross-run per-company caching is deferred (per-run dedupe covers the dominant cost).
