# Learning gate + ML roadmap (competitor-informed)

- **Date:** 2026-10-21
- **Owner:** Aiden
- **Status:** ML-0 shipped (commits `072e967c`, `439189cb`); ML-1 = this spec's build scope
- **Relation to existing plans:** complements, does not replace,
  `2026-10-17-adaptive-prospecting-closed-loop.md` (A1–A5 + B0–B3). That plan optimizes
  **strategy** (copy/play genome) via randomized experiments. Nothing in it — or in the code —
  makes the **qualification gate** (who gets contacted) learn from outcomes. This spec owns that.

---

## 1. Competitor teardown — Goji Berry (public sources only)

Sources: gojiberry.ai, help.gojiberry.ai (how-it-works, glossary, quick-start), third-party
reviews (Salesforge, SBL — both competitors, treat as biased), G2 (14 reviews). No engineering
blog, job posts, or talks are public, so **infrastructure is not knowable**; what follows is the
product mechanism.

| Mechanism | What they do | Vantera today |
|---|---|---|
| Discovery | **Signal-first**: a "Signals Agent" runs several times a day watching LinkedIn behaviour — competitor engagement/followers, keyword/topic posts + engagers, job changes, funding, hiring, profile visitors, company followers, "top 5% most active profiles" | Two doors: Scout (firmographic discovery) + Intent agent (watched creators/competitors/keywords, daily) |
| Qualification | LLM scores each match against the ICP + **free-text "additional criteria"** ("prioritize B2B SaaS, avoid agencies") | LLM rank 0–100 vs ICP, fixed ≥70 bar |
| Exclusions | One-click: service providers / freelancers / consultants, **"Open to Work"**, companies, keywords | None |
| Fit feedback | User marks leads **good / poor fit; "the AI learns"** | `scheduled_sends.rejection_reason='wrong_person'` captured (0064), **read by nothing** |
| Lookalikes | "Warm Lookalike" source from converted leads | None (pgvector exists, used only by the copilot) |
| Insights | Leads scanned vs matched **per signal**; top-performing signals; claims "learns from conversion data, benchmarks vs industry" | No per-signal attribution; intent levels never checked against replies |
| Copy | Icebreaker generated **from the triggering signal**; tone + goal picked at setup | `ai_insights` + why-now signal; humanizer lint; review queue |
| Warm-lead definition | accepted / replied / engaged / visited profile → prioritized | Reply classification; no warm-escalation ordering |
| Pricing/limits | $99/mo, 2 agents, ≤1,800 prospects contacted/month | 15 first-touch drafts/day/account, ~100 invites/week |

**What their reviews say is weak** (and where Vantera should be strictly better): signal setup
takes weeks of manual trial-and-error to learn which signals are noise; "learns" is a claim with
no visible mechanism; no measurement of whether scores predict replies.

**The takeaway:** Goji Berry's edge is *signal breadth + fast setup*, not ML depth. Vantera wins
by making the loop **actually learn**: every signal, source, score band and segment is measured
against real accepts/replies, and the gate + draft ordering move with that evidence —
automatically, with no weeks of manual signal tuning.

## 2. The integrated ML roadmap (v2 — 2026-10-21, organized for execution quality)

Ordering principles: (1) one concern per phase, one PR, its own quality gate; (2) **label quality
before model capacity** — fix what the learner trains on (fit feedback, meetings) before adding
model inputs (lookalikes); (3) no-migration phases first, migration phases each get an
`rls-auditor` pass; (4) every user-visible phase ships its help article (rule 09) and keeps UI
plain/functional for the owner to restyle; (5) **users only ever see their own data** — the
cross-account pool may shape *ordering*, never a displayed number.

| Phase | Concern | User-visible outcome | Migration | Quality gate (beyond the full CI gate) |
|---|---|---|---|---|
| **ML-0** ✅ | Learning-loop correctness | — | no | — |
| **ML-1** ✅ | Learning gate | Better leads first; job seekers skipped | no | rank eval floors (CI) |
| **ML-2** | **Visible learning** | "Why this rank" on every prospect; "What's working" panel on Prospects | no | explanations computed from the account's OWN data only (guardrail test); white-label audit |
| **ML-3** | **Signal-cited openers** | First touch references what the person actually did | no | humanizer lint test + copy eval corpus pass-rate holds; no invented why-now |
| **ML-4** | **Fit feedback everywhere** | Good fit / Not a fit on any prospect, feeding ML-1 | yes (feedback table + RLS) | rls-auditor; learner + rank-prompt consume it (tests) |
| **ML-5** | **Steerable targeting** | Exclusions (agencies/consultants, freelancers, competitors, existing customers, companies/keywords) + "who to prioritize/avoid" guidance | no (`agents.config`, rule 13) | deterministic exclusion tests; guidance reaches rank prompt; rank eval floors |
| **ML-6** | **Honest meetings** | Meeting counts that match reality (booking-link/calendar detection + one-click in Inbox) | likely yes | precision of detection vs manual; learner trains on it |
| **ML-7** | **Lookalikes** | "Looks like your best replies" signal + ordering lift | yes (vector col + RLS) | rls-auditor; inert without positives; embedding cost in telemetry |
| **ML-8** | **Warm escalation + speed-to-signal** | Engaged/accepted connections first; fresher high-intent pickup; profile-viewer/follower signals where the LinkedIn layer exposes them | maybe | LinkedIn read caps (rule 04) unchanged; suppression tests |
| **ML-9** | **Strategy loop** | = owner's adaptive-prospecting A1–A5/B0–B3 + hive-audit fixes | per that spec | per that spec |

## 3. ML-1 design

### 3.1 Principles
- **Gate stays a floor, learning moves above it.** `score ≥ min_score` (rule 06) is unchanged —
  the learner never qualifies a lead the gate rejected. It decides *order* (who gets the scarce
  15/day slots) and feeds the LLM gate per-account evidence.
- **Small data is the normal case.** Every estimate is shrunk: global (all accounts, aggregates
  only) → account. A feature earns influence only as its evidence grows. No data ⇒ the learner is
  inert and behaviour is byte-identical to ML-0.
- **Only matured invites count** (ML-0's 14-day window) — no right-censoring bias.
- **Tenant safety:** pooled rows are read service-side inside the job and reduced to counts; no
  cross-tenant row ever reaches a prompt, a DTO, or the UI.

### 3.2 The outcome learner (pure, `packages/agent-brains/src/targeting/learn.ts`)
Additive log-odds (naive-Bayes-style) model with hierarchical empirical-Bayes shrinkage:

```
logit P(positive | lead) = logit(base_account) + Σ_f  w_f · lift_f(value)
lift_f(v)  = log( shrunk_rate(v) / base )      shrunk toward base with M pseudo-obs
shrunk_rate(v) = (k_v + M·base) / (n_v + M)    account counts, base = account rate shrunk to global
```

- **Target:** positive = interested or booked, among matured invites. (Accept rate is reported
  alongside for diagnostics.)
- **Features:** `source` (discovery/intent/…), `signal:<kind>` (multi-valued, from lead_signals),
  `intent:<level>`, `seniority` (tilt.ts buckets), `industry`, `size`, `score_band` (70–79,
  80–89, 90+ — calibrates the LLM score against reality).
- Multi-valued features use the **max-magnitude** lift per feature family, so correlated
  evidence isn't double-counted (same rationale as tilt.ts max-not-sum). Lifts are clamped.
- Output: `predict(lead) → { p, logOdds, top: [{feature, lift}] }` — the explanation powers
  insights and later UI.
- `signalReport(model)` → per-feature n, rate, shrunk lift: the automatic version of Goji's
  "top-performing signals", with no manual tuning.

### 3.3 Wiring
1. **Store:** `getLearnerRows(accountId)` → matured invites (≤ 180 days) with features + flags;
   `getGlobalLearnerCounts()` → the same reduced to per-feature counts across accounts.
2. **Draft ordering:** `getTopQualifiedLeadIds` and copy-draft's slot ranking use
   `rankByLearned` = order by predicted p, ties broken by ai_score. When the learner has fewer
   than `LEARN_MIN_N` matured invites (account + global), fall back to the ML-0 tilt order.
3. **Fit feedback into the LLM gate:** `RankContext.feedback` — up to 5 recent leads the user
   rejected as `wrong_person` and up to 5 that produced a positive reply, as one-line
   title/company/industry exemplars. The rank prompt treats them as this customer's revealed
   preferences. The prompt hash changes, so the rank eval floors gate the PR.
4. **Job-seeker exclusion** (rules gate, deterministic): a title/headline signalling job search
   ("open to work", "#opentowork", "seeking new opportunit…", "looking for (a) new role/
   opportunit…", "actively looking", "in transition") fails the gate. A job seeker is not a buyer.
5. **Intent verdicts keyed by (profile, post):** fixes one person on several posts getting one
   verdict with a why-now from the wrong post; a classifier throw no longer fails the whole run
   (the batch is skipped and counted).
6. **Insights in the run summary:** the scout summary carries the top 5 positive and top 5
   negative signal lifts (`learned`), so the data is persisted per run (agent_runs) before any UI.

### 3.4 Not in ML-1
Raising/lowering the qualification bar from data (needs randomized evidence — that's an ML-3
experiment on `qualification.minScore`); user-editable exclusions/additional criteria (Playbook
UI, Phase 21); lookalikes (ML-2).

### 3.5 Definition of done
TDD for every unit; the learner inert with no data (tests prove ML-0-identical order); no
migration; rank eval floors pass on the new prompt; help article updated (prospects/agents
article mentions learned ordering + job-seeker exclusion); full gate green on a clean tree.

## 4. ML-2 design (visible learning) — shipped

- **Readout** (`buildReadout(account)` — takes the account's counts only, by signature): features
  with ≥ 8 own matured invites and |lift| ≥ 0.1, strongest first, as rate ratios vs the account's
  own average. Persisted as `summary.learned` on every scout run (agent_runs, RLS-scoped).
- **Privacy rule:** the cross-account pool shapes *ordering* only. Anything displayed comes from
  the readout. (Fixes an ML-1 gap where the persisted readout came from the pooled model.)
- **Surfaces:** Prospects "What's working" strip (top 3 up / down, hidden below 30 invites of
  evidence) and "Ranked higher / lower" reasons in the side-peek (`explainLead`, ≤ 3, one per
  feature family). Plain markup; owner restyles.
- **Labels:** `featureLabel` maps keys to plain words (white-label safe — no vendor names).

## 5. ML-3 design (signal-cited openers) — shipped

- **Gap found:** the copy brain never received the captured why-now (lead_signals) — only the
  rank model's paraphrased `triggers`.
- `pickWhyNow(signals)`: intent > funding > exec_hire > m_and_a > product_launch > partnership >
  office_opening > hiring > award; ≤ 90 days, dated only; negative kinds (legal, cost_cutting,
  security, workforce) never qualify. Loaded per lead in `getDraftableLeads`.
- Rendered in `leadBlock` as "Why now (verified — …)" — also the grounding string, so citing it
  passes the claim checks. The instruction rides the per-lead block, not `LINKEDIN_SYSTEM`, so the
  pinned system-prompt hash (champion stamps) is unchanged and leads without a why-now are
  byte-identical.
- `findMissingWhyNow`: content-word overlap with the signal (prospect's own name/company words
  excluded) or a kind word ("congrats on the round"); wired into draft, fix, and the eval grader.

## 6. ML-4 design (fit feedback everywhere) — shipped

- `lead_feedback` (0066): one verdict per lead (`good_fit` / `not_fit`), composite
  `(lead_id, account_id)` FK so a verdict can't cross workspaces, RLS (members read/record, author
  pinned to `auth.uid()`, delete = author or admin), `updated_at` trigger, retention = life of lead.
  rls-auditor: PASS (upsert path analysed; error-type oracle closed by one generic action error).
- Learning: verdicts are a *qualification* signal, so they feed the rank prompt's revealed
  preferences (merged newest-first with review "wrong person" rejections / positive replies), not
  the reply-outcome learner.
- Safety: `notMarkedNotFit` excludes "Not a fit" leads in both the drain and `getDraftableLeads`
  (covers every chain into copy-draft); flipping the verdict re-includes them.
- Web: side-peek Good fit / Not a fit / Undo; verdicts read in a separate soft query so the page
  degrades (no verdicts) instead of erroring if the migration isn't applied yet. Copilot
  `getLeadScoreRationale` now returns `fitVerdict`.

## 7. ML-5 design (steerable targeting) — shipped

- `TargetingRules` in the Scout's `agents.config.targeting` (rule 13), read defensively by
  `normalizeTargetingRules` (lists ≤ 50 × 80 chars, guidance ≤ 500).
- `applyExclusions`: agency/consultant + freelancer patterns on title/company; company lists by
  normalized name (legal suffixes dropped; "Acme" matches "Acme Labs", never "Acmeworks") or
  domain; keywords at a word start in title/company/industry. `gateWithExclusions` turns a gate
  pass into a recorded fail — before enrichment/AI spend — in Scout and Intent (the intent context
  loads the Scout's rules).
- Guidance: an inline rank-context line (no system-prompt change; newline-stripped, ≤ 500 chars).
- UI: `/playbook/scout/targeting` (plain form; one company per line so "Acme, Inc." survives),
  linked from the Scout card. Exempt by design: manual adds, onboarding fast-pass.

## 8. ML-6 design (calendar integration) — shipped

- **Connect** (owner/admin): paste a Calendly PAT (scopes users:read, webhooks:write,
  scheduled_events:read; webhooks need a paid Standard+ plan) or a Cal.com v2 API key (v1 shut down
  2026-04-08). The server verifies it (/users/me · /v2/me), creates a user-scoped webhook at
  `/api/webhooks/meetings/<provider>/<connectionId>` with a fresh 32-byte signing secret, and stores
  key + secret encrypted (crm-infra keyring). Disconnect deletes the vendor webhook + the row.
- **Attribution:** the conversation brain writes the clean booking link; `tagLinksInText` tags the
  final message with `utm_content=vt-<leadId>` (Calendly echoes `payload.tracking.utm_content`) and
  `metadata[vt]=vt-<leadId>` (Cal.com echoes `payload.metadata.vt`; it does NOT echo utm_*). The
  tag is re-checked against the connection's account; then the reschedule chain (Calendly
  `old_invitee`, Cal.com `rescheduleUid`); then invitee email within the account. Unattributed
  bookings store nothing.
- **Signatures:** Calendly `t=…,v1=…` HMAC of `${t}.${rawBody}`, 180 s replay window; Cal.com hex
  HMAC of the raw body (no timestamp → idempotency on uid+trigger). Dedupe log keeps only
  {kind, bookingRef}.
- **Effects:** `meeting_source='calendar'` (most trustworthy), outreach stood down, notification.
  Cancels clear only calendar-recorded meetings with no other live booking.
- **Known limits (documented, not built):** Cal.com team/round-robin event types may need
  event-type webhooks; Cal.com retries are sparse (a bookings-API reconciliation job would add
  resilience); Calendly disables a subscription after 24 h of failed deliveries (surface via
  connection status in a follow-up).

## 9. ML-7 design (lookalikes) — shipped

- `lead_embeddings` (0068): one 1024-d embedding per qualified/contacted lead + `source_hash` of the
  embedded profile text (re-embed on change). Service-role only (RLS on, no policies, client
  privileges revoked), composite lead/account FK. rls-auditor: PASS.
- Embedding: `profileText` (title | company | industry | size | location | offering | summary),
  ≤ 100 per scout run, before the drain orders anything; fail-open; off when no embeddings key.
- Similarity: `lookalikeSims(accountId, ids)` — max cosine to the account's own positives
  (interested / booked / converted / good_fit), leave-one-out, every join pinned to the bound
  account id (guardrail test scans pg-store for unscoped references). Inert below 3 positives.
- Learning: tertile cutpoints from the account's own training similarities → `lookalike:high|mid|low`
  feature in the ML-1 learner, so its real lift is measured with the same shrinkage as every other
  feature. Pool rows never carry it (cross-account similarity is meaningless and a leak risk).

## 10. ML-8 design (warm escalation + speed-to-signal) — shipped

- **Warm-first dispatch** (`warmFirst` in send-dispatch): tiers reply_response → manual → ongoing
  conversation (lead has replied) → first message to a fresh accept (newest accept first) →
  follow-ups (oldest queued first) → invites (queue = the learner's drain order). Pure ordering:
  rule-04 budgets, the business-hours window, per-lead gates, and the trial cap are untouched.
- **Intraday cadence** (`agents.cadence='intraday'`, 0069): `computeNextRunAt` adds 6 h from the
  run; intent-scan divides `INTENT_POSTS_PER_RUN` by `INTRADAY_RUNS_PER_DAY` (4) so a day's read
  volume equals one daily run. Wizard offers "Every 6 hours" for the Intent Agent only.
- **Followers signal**: `LinkedInInfra.listFollowers` (own-profile followers; provider page cap
  100). intent-scan reads one page per run, dedupes through the observation ledger with the
  synthetic post ref `follow`, processes ≤ 25 new followers per run (overflow waits), never sends
  them to the classifier (no words → no spend), and gives them a synthetic medium verdict so they
  face the identical suppression → exclusions → ICP gate → rank path as a `follow` signal (the rank
  prompt treats only `intent` as the strongest why-now). Qualified followers persist a
  `lead_signals.kind='follow'`, which the ML-1 learner measures (`signal:follow`) and ML-3 can cite
  ("thanks for the follow"). Someone already surfaced for their words is recorded, not doubled.
- **Not built:** profile viewers (no provider endpoint); company-page followers (needs the page's
  provider id — a follow-up config field).
