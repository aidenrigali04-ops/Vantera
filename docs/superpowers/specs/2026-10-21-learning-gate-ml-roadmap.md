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

## 2. The integrated ML roadmap

| Phase | Lever | Status |
|---|---|---|
| **ML-0** Correctness | Rank misses retried; tilt-ordered draft slots; converted never demoted; 14-day maturation (right-censoring); per-run token/$ telemetry + cache breakpoint; rules-gate word-start matching; evals gate prospect/** | **Shipped** |
| **ML-1** Learning gate *(this spec)* | Outcome learner over features; learned draft ordering; fit-feedback in the rank prompt; job-seeker exclusion; intent keyed per (profile, post) | Build now |
| **ML-2** Lookalikes | Embed won/positive leads (existing Voyage + pgvector); similarity becomes a learner feature + a "lookalike" signal | Next — needs a migration (vector column) |
| **ML-3** Strategy loop | = owner's A1–A5/B0–B3 (adaptive-prospecting spec), plus the hive fixes from the 2026-10-21 audit (harm-count bug — fixed in tree; reused/leaking sealed holdout; generator plants zero-effect defaults; Beta(1,1) unseen prior) | Owner-sequenced |
| **ML-4** Speed-to-signal | High-intent re-scan more than once a day; warm escalation (accepted + engaged first); more signal types where the LinkedIn layer exposes them (profile viewers, company followers, activity level) | After ML-2 |

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
