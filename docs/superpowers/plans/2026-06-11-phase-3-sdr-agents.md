# SDR Agents: Scout (Prospect) + Copy — Setup Wizards & Backend Brains

## Context

Vantera's outreach is being reshaped to an **agent-centric model**: instead of the rule-08 campaign wizard being the front door, users deploy named SDR agents. This phase builds the first two — the **Scout (Prospect) Agent** and the **Copy Agent** — each with a setup wizard UI and a backend brain. Remaining agents (caller, etc.) come later.

Owner decisions (locked this session):
- **Agents are the front door.** The `campaigns` table stays as under-the-hood execution grouping; rule 08 gets rewritten.
- **Auth/onboarding (Phase 2) is being built in parallel** in another session — build decoupled behind a thin `requireAccountId()` helper; wire up when the owner says connect.
- **Explorium**: swappable `prospect-data` interface + in-memory fake + real Explorium adapter (`EXPLORIUM_API_KEY`).
- **Pipeline stops at the drafted queue** (`scheduled_sends`, `pending_review`). No live sending until Phase 5 adapters. Suppression still enforced before drafting (rule 11).

Verified facts: migrations 0000–0006 exist (next: **0007**, renumber at merge if the parallel session claims it). `leads` already has `external_ref`, `rules_gate_reasons`, `ai_score`, `ai_rationale`. `scheduled_sends` already has `campaign_id NOT NULL` and statuses `pending_review` / `suppressed`. `packages/ai` exposes `getModel()` (the single LLM entry point). `packages/email-infra` is the interface+fake pattern to copy. No wizard UI exists yet anywhere in `apps/web`.

## Architecture

```
Deploy Scout (Live) ──cron scan (15m)──> scout-run task
  account context (industry, ICP, website scan) → prospect-data.discoverProspects
  → rules gate (deterministic code, rule 06 stage 1)
  → enrich SURVIVORS ONLY (email/phone/LinkedIn/firmo/techno/signals)
  → AI rank, batched (rule 06 stage 2) → leads.ai_score/ai_rationale/ai_insights
  → chain copy-draft (if live Copy agent exists)

copy-draft task
  qualified leads (score ≥ min_score, default 70)
  → SUPPRESSION CHECK before any draft (rule 11)
  → linkedin/email copy brains + humanizer validation loop
  → scheduled_sends rows (status 'pending_review')  ← STOPS HERE
```

Deploying a Copy agent auto-creates one internal campaign row (`copywriting_mode: 'agent'`, `send_mode: 'review'`) so drafts satisfy `scheduled_sends.campaign_id NOT NULL`. Campaigns are never the user surface — the agent card is.

## 1. Schema — migration `0007_agents.sql`

Copy the RLS + composite-FK + `set_updated_at` pattern from [0002_icps_leads_enrichment.sql](packages/db/migrations/0002_icps_leads_enrichment.sql). TDD: add Drizzle exports to [schema.ts](packages/db/src/schema.ts) first → guardrail test in `packages/db/src/schema.test.ts` goes red → write SQL → green. Run `/vantera-db-migrations` checklist + `rls-auditor` before commit.

**`agents`**: id, account_id (cascade), `kind` check `('scout','copy')`, name, `status` check `('draft','live','paused')` default draft, `config jsonb` (Scout: `{prospects_per_run, min_score}`; Copy: `{cta, channels:{linkedin,email}}`), scout scheduling cols (`run_at_time time`, `cadence` check `('daily','weekly')`, `timezone` default 'UTC', `next_run_at`, `last_run_at`), `campaign_id` composite FK → campaigns (set null), `deployed_at`, `created_by`, timestamps. `unique (id, account_id)` (composite-FK target) and **`unique (account_id, kind)`** (one agent per kind in v1 — Copy wizard's read-only ICP display presumes one Scout). Indexes: `(status, next_run_at)`, `(account_id)`. RLS: member select, admin all (the `icps` pattern).

**`agent_icps`** join table (chosen over jsonb icp_ids: real FKs can't dangle, provable same-tenant): agent_id, icp_id, account_id, position; PK (agent_id, icp_id); composite FKs to agents and icps mirroring `campaign_leads`. Max-3 enforced in the server action (unit-tested), noted in a migration comment.

**`agent_assets`** + private Storage bucket `agent-assets` (chosen over jsonb refs: RLS, cascade, audit): id, account_id, agent_id (composite FK cascade), `kind` check `('file','image','link')`, storage_path, url, filename, mime_type, size_bytes, created_by, created_at. Bucket + `storage.objects` policies restricting paths to `<account_id>/...` via `is_account_member`. **Retention (rule 11):** assets live while the agent lives; cascade on agent/account deletion.

**`accounts` additions**: `website_url text`, `website_scan jsonb`, `website_scanned_at timestamptz`. Coordination with the parallel session: they must not re-add these; if they own column-level grants, only `website_url` is client-updatable (scan fields are service-role-written). Scout handles null `website_url` gracefully.

**`leads` addition**: `ai_insights jsonb` — `{pain_points[], triggers[], motivations[], value_angle, aha_moment, summary}`. `ai_rationale` stays the dashboard one-liner; `ai_insights` feeds the Copy brain and the user-facing tailored enrichment panel.

**`packages/db/src/client.ts`**: add `createServiceDb(connectionString)` (drizzle + postgres driver) for jobs. Add `DATABASE_URL`, `EXPLORIUM_API_KEY` to `.env.example`.

## 2. `packages/prospect-data` (new)

Replicate the [email-infra](packages/email-infra/src/types.ts) package shape: `types.ts`, `in-memory.ts`, `explorium.ts`, `index.ts`, vitest.

- `ProspectDataSource` interface: `discoverProspects(filters: ProspectFilters, limit): Promise<ProspectCandidate[]>` (cheap discovery fields: externalRef, company, size, industry, geo, name, title, linkedinUrl) and `enrichProspects(externalRefs): Promise<EnrichedProspect[]>` (adds email, phone, firmographics, technographics, signals[]).
- `InMemoryProspectData`: deterministic seeded fake, records calls — used by all pipeline tests.
- `ExploriumProspectData`: REST against AgentSource (`EXPLORIUM_API_KEY` header) — prospect fetch/match/bulk-enrich. Pure `icpCriteriaToFilters(criteria)` mapper from `icps.criteria` jsonb (industry, size, role, geo, tech), unit-tested.
- White-label: "explorium" appears only inside this package and DB `source` enums — never UI/API/help surfaces.

## 3. `packages/agent-brains` (new)

Pure prompt/logic modules, no Trigger.dev dependency (fast vitest; web can import for previews). All LLM calls via `getModel()` from `@vantera/ai` — never direct SDK imports.

**`prospect/rules-gate.ts`** — `applyRulesGate(candidate, criteria)` → `{passed, reasons[]}`. Deterministic industry/size/role/geo/tech checks, case-insensitive; missing required field = fail with reason. Zero AI cost; exhaustive unit tests.

**`prospect/rank.ts`** — the token-optimized "thinking brain":
- Batches of 12 leads per `generateObject` call.
- `compactLead()` serializer: one pipe-delimited line per lead (`id|company|size|industry|geo|title|tech(top3)|signals(top3)`) — tested truncation.
- Prompt ordered for Anthropic prompt-cache hits: stable system rubric → stable account-context block (industry, ICP criteria, website-scan summary, value prop) → per-batch lead lines last.
- Structured reasoning over extended thinking: zod schema puts a `reasoning` field (≤200 chars) *before* `score` per lead — brief forced deliberation at a fraction of thinking cost, deterministic to validate.
- Output schema per lead: `{lead_id, reasoning, score 0–100, rationale ≤280, pain_points ≤3, triggers ≤3, motivations ≤3, value_angle, aha_moment}`. Bounded `maxOutputTokens`, retry-once on zod failure.

**`prospect/website-scan.ts`** — `scanWebsite(url, fetchImpl)`: fetch homepage, strip to text, one `generateObject` → `{summary, offerings[], value_props[], scope_of_industry}`. Persisted to `accounts.website_scan`; refreshed if >30 days old or URL changed.

**`copy/email.ts` and `copy/linkedin.ts`** — two separate systems, two system prompts. Implementer does deep best-practices research at build time (web research) and bakes it into the prompts; starting rules:
- Email: ≤90 words; single soft interest-based CTA; subject 1–4 words, lowercase, pattern-interrupt, never deceptive (rule 11); observation → relevance → ask; lead with the prospect's trigger/pain from `ai_insights`; no links/images in first touch. Output `{subject, body}`.
- LinkedIn: connection note ≤280 chars (300 hard limit, validator-enforced); no pitch in first touch — trigger/commonality only; follow-up ≤500 chars, one soft CTA; conversational. Output `{connection_note, followup_message}`.
- Inputs: lead identity + `ai_insights` + user CTA + content context (asset filenames/links) + account industry/value prop.

**`copy/humanizer.ts`** — single-pass constraints + deterministic validator + bounded retry (chosen over second LLM pass: half the cost/latency, TDD-able, can't reintroduce slop):
1. Style constraints embedded in both copy system prompts (ban "hope this finds you well", em-dash chains, hedging, generic flattery, over-explaining; require sentence-length variance).
2. `validateHumanity(text): Violation[]` — pure regex/heuristic linter (banned phrases, em-dash count >1, exclamation caps, hedge-word density, channel char/word limits, "As a/an" openers).
3. Orchestrate: generate → validate → regenerate once with violations listed → if still failing, accept + flag `humanizer_violations` (surfaced in the review queue — everything is human-reviewed pre-Phase-5 anyway).

## 4. Trigger.dev tasks (`packages/jobs`)

Add vitest. Each task = **pure core in `src/pipeline/`** (injected deps: db, ProspectDataSource, brains, clock) + thin wrapper in `src/trigger/`.

**Scheduling — one cron scan** (chosen over per-agent Trigger.dev schedules: state stays in our DB, no provider sync drift, pause = status flip): `agent-scheduler.ts`, `schedules.task` cron `*/15 * * * *` → select scouts `status='live' AND next_run_at <= now()` → `batchTrigger` scout-run → advance `next_run_at` via pure `computeNextRunAt(runAtTime, cadence, timezone, from)` (tested incl. DST/weekly).

**`scout-run`** (`{agentId, accountId}`) — core `runScout(deps)`:
1. Load agent + ICPs + account context; website-scan if URL set and scan missing/stale.
2. Per ICP: `icpCriteriaToFilters` → `discoverProspects(filters, config.prospects_per_run)`.
3. Dedupe/upsert into `leads` (by account + `external_ref`, fallback lower(email)/domain+name), `source='explorium'`.
4. Rules gate → write `rules_gate_passed`/`rules_gate_reasons`; fails → `rejected`.
5. Enrich survivors only → contact fields + `enrichment_results` rows.
6. AI rank in batches → `ai_score`/`ai_rationale`/`ai_insights`; `qualified` if ≥ `min_score` else `rejected`.
7. Update `last_run_at`; chain `copy-draft` if a live Copy agent exists.

**`copy-draft`** (`{copyAgentId, accountId, leadIds}`) — core `runCopyDraft(deps)`:
1. Load agent (cta, channels, campaign_id), assets, leads + `ai_insights`; ensure `campaign_leads` rows.
2. Per lead × enabled channel: **suppression lookup first** (`suppression_entries` by account + kind + lower(value) for email / linkedin URL). Suppressed → zero draft rows, `campaign_leads.status='suppressed'`.
3. Clean leads → copy brain + humanizer loop → insert `scheduled_sends` `{campaign_id, lead_id, channel, subject?, body, status:'pending_review'}`; lead → `in_campaign`.
4. Stop. Nothing past `pending_review`; no infra interfaces touched.

## 5. Wizard UI (`apps/web`)

Read `node_modules/next/dist/docs/` conventions first (Next 16). Use ultimate-ui-builder/retention-experience skills for the actual UI build.

**Routes**: `/agents` list page (agent cards: name, "Prospect Agent"/"Copy Agent" label, `(Live)` badge, next/last run, ICP chips, pause/resume; empty state → "Deploy your first agent"); `/agents/new/scout`, `/agents/new/copy` (two thin pages composing shared steps).

**Shared wizard component** (first in codebase, built reusable for onboarding later): `src/components/wizard/` — `wizard.tsx` (context: steps, values, next/back, per-step validation), `wizard-progress.tsx`, `wizard-step.tsx`. Client components; final submit hits a server action.

**Scout steps**: Name → ICP type-ahead (Command+Popover combobox; suggests existing `icps` rows; always offers onboarding default from `accounts.onboarding_icp` as pre-built chip; free text allowed; **max 3** client+server) → Schedule (time picker, daily/weekly, browser-default timezone) → Finish → **"Deploy {name}"** → status Live.

**Copy steps**: Name → ICP read-only chips from the Scout agent (no Scout → gate with "Deploy a Prospect Agent first" empty state) → CTA textarea → Add Content (file/image upload to `agent-assets` bucket via server action; paste-link list) → channel toggles (LinkedIn/Email switches, ≥1 required) → Finish → Deploy (creates internal campaign, links `agents.campaign_id`).

**Server actions** (`src/app/(app)/agents/actions.ts`): `createScoutAgent`, `createCopyAgent`, `updateAgent`, `deployAgent` (status→live, `deployed_at`, scout `next_run_at`; copy internal campaign), `pauseAgent`, `uploadAgentAsset`, `searchIcps`. All zod-validated; **accountId only from session** via new `src/lib/auth/account.ts` → `requireAccountId()` (supabase server client + `account_members` lookup). When the parallel Phase 2 session lands its session helper, this one file collapses into it.

**shadcn adds**: input, label, textarea, select, switch, command, popover, progress, separator.

**White-label**: UI says "Prospect Agent"/"Copy Agent" — never Explorium/Anthropic/Claude/Smartlead/Unipile. `whitelabel-auditor` pass before ship.

## 6. Tests (TDD, written first per unit)

| Test | Proves |
|---|---|
| RLS guardrail (`packages/db/src/schema.test.ts`, auto-covers new tables) | RLS in-migration + account cascade for agents/agent_icps/agent_assets |
| `rules-gate.test.ts` | every criterion pass/fail, missing-field policy |
| `rank.test.ts` (mock model) | compactLead truncation, batch size, zod parse, score bounds, retry-on-invalid, lead_id mapping |
| `website-scan.test.ts` (mock fetch+model) | extraction shape, 30-day staleness |
| `copy/{email,linkedin}.test.ts` (mock model) | schema, char limits, CTA presence |
| `humanizer.test.ts` | every banned pattern caught; clean copy passes; bounded retry |
| `schedule.test.ts` | computeNextRunAt daily/weekly/timezone/DST |
| `scout.test.ts` (in-memory ProspectData + fake db) | gate-before-AI ordering, enrich-survivors-only, dedupe, chain condition |
| **`copy-draft.test.ts`** | **suppressed lead (email + linkedin, case-insensitive) → zero `scheduled_sends` rows**, `campaign_leads.status='suppressed'`; nothing past `pending_review`; no infra interface invoked |
| server-action tests (mock supabase) | max-3 ICP rejection, payload accountId ignored (session wins), deploy transitions, copy-deploy creates internal campaign |
| prospect-data tests | fake contract, `icpCriteriaToFilters` |

Merge gate: `pnpm lint && pnpm type-check && pnpm test && pnpm build` green.

## 7. Docs & rules

- **Rewrite [.claude/rules/08-campaign-pipeline.md](.claude/rules/08-campaign-pipeline.md)**: agents are the front door; both wizard flows; behavior contract (discover → rules gate → AI rank → enrich → draft to review queue); suppression-before-draft; campaigns = internal grouping; preserved invariants (type-ahead max 3 + onboarding default, run time + cadence, Live indicator); live sending + send modes arrive Phase 5.
- **[docs/roadmap.md](docs/roadmap.md)**: reshape Phase 3/4 bullets into "SDR agents: Scout + Copy (drafted queue)"; move live-send/approval-execution to Phase 5; list descoped items (preview step, automatic mode, user-drafted copy path) explicitly.
- **Help articles** (knowledge-sync, rule 09): `agents-prospect.md`, `agents-copy.md` in `packages/help-content/articles/` (frontmatter: title/surface/routes). Parallel Phase 2 session owns the package scaffold — add minimal `package.json` ourselves only if it hasn't merged by our merge time. Copilot tool registration deferred to Phase 6 (runtime doesn't exist) — note in knowledge backlog.
- Spec + this plan committed under `docs/superpowers/specs/` and `docs/superpowers/plans/` per rule 12. Branch: `phase-3-sdr-agents`.

## 8. Build sequence

1. **Schema first (serial)**: Drizzle exports → guardrail red → `0007_agents.sql` → green → `createServiceDb` → rls-auditor.
2. **Parallel tracks** (fit for subagent-driven TDD):
   - A: `packages/prospect-data` (types → fake → mapper → Explorium adapter)
   - B: `packages/agent-brains` (rules gate → rank → website-scan → copy prompts incl. deep outreach-practices research → humanizer)
   - C: wizard UI (after step 1: shadcn adds → `requireAccountId` → wizard components → scout wizard → copy wizard + uploads → `/agents` page)
3. **Jobs (after A+B)**: vitest → `computeNextRunAt` → scout core+task → copy-draft core + suppression test + task → scheduler cron → chaining.
4. **Ship (serial)**: rule 08 rewrite → roadmap → help articles → whitelabel-auditor → full gate → `/ship-phase`.

## Integration points with the parallel auth session

1. Migration number claim (0007) at merge time — renumber ours if taken.
2. `requireAccountId()` ↔ their session/gate helper (one-file swap; owner will say "connect to auth dep").
3. `accounts` column-level grants: `website_url` client-updatable only.
4. `packages/help-content` scaffold ownership.
5. "Agents" entry in their sidebar nav/app shell.
6. Onboarding default ICP keeps coming from `accounts.onboarding_icp` — no contract change.

## Verification

- Full gate: `pnpm lint && pnpm type-check && pnpm test && pnpm build`.
- Apply `0007_agents.sql` to the Supabase dev project (batyjchztbrqzkcvhkmk) via migration tooling; confirm RLS via `get_advisors`.
- End-to-end dry run with fakes: seed a dev account + ICP → run the scout wizard → deploy → manually trigger `scout-run` with `InMemoryProspectData` (trigger dev) → verify leads sourced/gated/scored with `ai_insights` → deploy a Copy agent → verify `scheduled_sends` drafts at `pending_review`, suppressed seed lead has none.
- With `EXPLORIUM_API_KEY` set: one live scout-run against a narrow ICP, inspect lead quality + token usage in Trigger.dev run logs.
- UI: run `pnpm dev`, walk both wizards in the browser (playwright snapshot ok), confirm Live badge, max-3 enforcement, copy-agent gate when no Scout exists.
