# Company-Signal Intent — Design

**Date:** 2026-06-24 · **Phase:** 15 · **Branch:** `phase-15-company-signals`
**Rules:** 02 (tenant/RLS), 04 (read pacing/cost), 05 (enrichment on survivors), 06 (gate — intent is a 2nd filter, never a bypass), 11 (retention), 13 (provider behind interface)

## Problem

Vantera's Intent today is LinkedIn-behavioral only (reactions/comments/posts). The owner wants
**company events** — funding, M&A, exec hires, product launches, partnerships, office openings —
tracked as buying triggers and shown on prospects. The machinery already exists and is dormant:
`ProspectSignal` already defines those exact categories ([prospect-data/src/types.ts](packages/prospect-data/src/types.ts)),
the AI rank already weighs `signals`, `saveEnrichment` already writes provider signals to the
`lead_signals` table (0031), the prospect profile + Hot-leads strip already render them, and the
Scout already has `HOT_SIGNAL_KINDS = {funding, intent, exec_hire, m_and_a}`. The only missing
piece: the Apify-only rescope stubbed `enrichProspects → []`, so nothing fills `signals` anymore.

**This build refills the `signals` slot from an Apify company-news source, gated to the Intent
entitlement (Growth + Scale).** No new display, no new table, no new scoring path — it re-feeds
existing ones.

## Decisions (owner-approved)

- **Source:** an Apify company-news actor (owner picks the actor; `APIFY_COMPANY_NEWS_ACTOR` +
  existing `APIFY_TOKEN`).
- **Use:** **qualify + display** — fetched on gate survivors *before* the AI rank so a fresh event
  can lift the score (rule 06: still passes the same ICP gate, never a bypass), and persisted to
  `lead_signals` for the "why now" + Hot-leads display.
- **Gating:** rides `features.intent` — **auto-on for Growth + Scale with zero setup, off for
  Starter.** No wizard, no per-account config.

## Architecture

### A. `CompanySignalSource` (new provider interface, rule 13)
In `packages/prospect-data` (the `ProspectSignal` shape already lives there):
```ts
export interface CompanyRef { name: string; domain?: string | null }
export interface CompanySignalSource {
  /** Company events per company, normalized to ProspectSignal. Keyed by companyKey(ref).
   *  Failures/empties degrade to an empty map — never breaks the run (fail-open, like enrichment). */
  getCompanySignals(companies: CompanyRef[]): Promise<Map<string, ProspectSignal[]>>;
}
export function companyKey(ref: CompanyRef): string; // lowercased domain || lowercased name
```
- **`InMemoryCompanySignals`** fake (tests + the Apify-less default).
- **`ApifyCompanySignals`** adapter: runs `APIFY_COMPANY_NEWS_ACTOR` for the batch, parses each
  news/funding item, and **classifies it into a `ProspectSignal.kind`** via a deterministic
  keyword map (e.g. "raises|Series [A-Z]|seed round" → `funding`; "acquires|acquired|merger" →
  `m_and_a`; "appoints|names|hires new|joins as" → `exec_hire`; "launches|unveils" →
  `product_launch`; "partners with|partnership" → `partnership`; "opens .* office|expands to" →
  `office_opening`). `observedAt` = the item's published date; `detail`/`label` = a one-line
  paraphrase. Unmatched items are dropped (no `other` noise). Vendor name never leaves the package
  (white-label) — no "Apify" in any DTO, log, or UI string.

### B. Pipeline stage — fold into the Scout enrichment step
The Scout already calls enrichment on gate survivors then ranks. Add: for accounts whose plan has
`features.intent`, call `getCompanySignals` for the survivors' companies (deduped by `companyKey`),
attach the returned `ProspectSignal[]` to each lead's candidate `signals`, then proceed into the
existing rank + `saveEnrichment` path. Concretely:
- **Gating:** `ScoutContext.account` gains `planTier` (or `features.intent`, resolved server-side);
  the stage no-ops when intent isn't entitled. `@vantera/billing` `PLANS[tier].features.intent` is
  the single source of truth (no duplicated gating logic).
- **Cost control (rule 04/05):** **v1 dedupes to one fetch per company per run** and bounds
  companies-per-run — no new table. (Cross-run per-company caching is a fast-follow, deferred to
  avoid a migration now; per-run dedupe already removes the dominant duplicate cost since many
  survivors share a company.)
- **Freshness/decay (rule 06):** only events within a recency window (default 90 days) are attached;
  the existing AI-rank signal-decay keeps old news from reading as active intent.
- **Result:** the rank sees the signals (score can lift), `saveEnrichment` writes them to
  `lead_signals`, and the Scout's existing `notifyHotSignals` fires for funding/exec_hire/m_and_a —
  all already built.

### C. Display
No change — `lead_signals` already renders on the prospect ("why now") and the Hot-leads strip, and
hot-signal notifications already fire. Intent-sourced leads inherit it via the same rank/enrich path.

## Data flow

```
gate survivors → [features.intent?] → companyKey-dedupe → ApifyCompanySignals.getCompanySignals
  → normalize → recency filter → attach ProspectSignal[] to leads → AI rank (score can lift)
  → saveEnrichment → lead_signals → prospect "why now" + Hot-leads + notification
```

## Error handling
- Source failure / empty / missing actor env → empty map, run continues (fail-open, rule 04 never
  halts prospecting on a flaky signal read).
- Malformed actor items → skipped item, not a thrown run.
- Starter / no-intent account → stage never calls Apify (cost + entitlement).

## Testing
- **Adapter:** classifies funding/M&A/exec-hire/launch/partnership/office headlines to the right
  `kind`; drops unmatched; sets `observedAt`; no vendor string in output.
- **Gating:** a Starter (intent:false) account does NOT fetch company signals; Growth/Scale does.
- **Qualify+display:** a fresh funding event attaches, reaches the rank, and is persisted to
  `lead_signals`; a stale (>90d) event is filtered out.
- **Cost:** two leads at the same company trigger ONE company fetch (dedupe); cached on re-run.
- **Fail-open:** source throwing leaves the run completed with zero signals, leads still scored.
- Suppression + qualification gate unchanged (rule 06/11 regression).

## Out of scope (YAGNI)
- A separate Intent-Agent wizard surface for company signals (it's auto, no setup — the whole point).
- Real-time webhooks/streaming of company news (batch-on-run is enough).
- Backfilling historical events for existing leads (applies going forward).
- Any new display component (reuses `lead_signals` rendering).

## Operational remainder (owner)
Pick the Apify company-news actor and set `APIFY_COMPANY_NEWS_ACTOR` in Trigger + Vercel prod
(`APIFY_TOKEN` already set). The adapter is generic: any actor returning company + headline + date
works. Until set, the source fails open (no company signals; nothing breaks).
