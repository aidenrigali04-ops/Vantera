# Stage 0.5 — Vera's Winning-Message Memory (derived, per-account) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the positive-memory gap: first-touch drafts are conditioned on the account's own openers that actually earned interested replies — today the only history signal is negative (avoidPhrases).

**Architecture (the one deliberate deviation from the original spec note):** the memory is **DERIVED at read time, not stored** — a query joining leads-with-interested-replies to their earliest sent `scheduled_sends` body. No new table, no RLS surface, no capture hook in the send path, GDPR-clean by construction (lead cascade), always consistent. The Voyage-embedding store from the spec's mechanism sketch is deliberately deferred as a scale optimization (YAGNI at ~hundreds of sends/account); the product promise — "Vera remembers what wins and reuses it" — is fully delivered by derived retrieval. Exemplars are **per-account only** (raw prospect-facing text never crosses tenants) and enter the PROMPT only, never the grounding string (same rule as avoidBlock — old messages must never whitelist new metric claims).

**Tech Stack:** existing only — TypeScript strict, Vitest, drizzle in pg-store, no migration.

## Global Constraints
- Exemplar text is guide-for-angle, never copy material: the block instructs fresh writing, no rephrasing, no borrowed numbers/names/claims.
- Prompt unchanged when no exemplars exist (empty → "" → byte-identical prompt, same as strat/avoid).
- An opener may not appear in BOTH avoid and exemplar lists (contradictory instruction) — exemplars win; filter avoidPhrases.
- First-touch (copy-draft) path only; conversation replies stay thread-contextual.
- Knowledge-sync: optimization.md gains the memory beat (rule 09).

### Task 1: `exemplarBlock` + CopyContext field + prompt wiring (brains)
- Files: `packages/agent-brains/src/copy/shared.ts` (+ its test file), `packages/agent-brains/src/copy/linkedin.ts`
- `CopyContext.winningExemplars?: string[]`; `exemplarBlock(exemplars?: string[]): string` — "" when empty; wording: earned interested replies from this account's prospects; use ONLY as a guide for angle and energy; write fresh for THIS prospect; never copy/lightly rephrase; never borrow numbers, names, or claims.
- `draftLinkedIn`: `basePrompt = [block, strat, avoid, exemplars].filter(Boolean).join("\n\n")`; grounding stays `block` alone.
- TDD: empty → ""; renders quoted lines; prompt-only (a metric inside an exemplar must NOT whitelist a claim — assert findUngroundedClaims still flags it when exemplar text is not in grounding).

### Task 2: derived retrieval + pipeline pass-through (jobs)
- Files: `packages/jobs/src/pipeline/pg-store.ts`, `packages/jobs/src/pipeline/types.ts` (CopyDraftContext gains `winningOpeners: string[]`), `packages/jobs/src/pipeline/copy-draft.ts` (+ test)
- `winningOpeners(db, accountId)`: leads with an `interested` reply → each lead's EARLIEST `sent` scheduled_send with a body → first line clipped to 70 (same clip as recentSendOpeners), min length 12, dedupe case-insensitive, order by reply recency desc, LIMIT 3.
- `getCopyContext`: load winningOpeners alongside avoidPhrases; **filter avoidPhrases to exclude exemplar strings** (case-insensitive); map into `CopyContext.winningExemplars`.
- TDD (fake store): copy-draft passes winningOpeners → draft fn receives `context.winningExemplars`; avoid/exemplar overlap filtered.

### Task 3: knowledge-sync + gate + ship
- optimization.md: add "Vera remembers what wins" beat under How the testing works.
- Full gate (lint, type-check, all tests, build) → push main (fast-forward) → **`vercel promote` + live-site proof** (pinned-domain gotcha) → Trigger auto-deploy check (jobs changed). No migration this release.
