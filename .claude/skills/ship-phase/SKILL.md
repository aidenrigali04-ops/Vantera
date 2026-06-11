---
name: ship-phase
description: Session closer for Vantera phase work — use when the user types /ship-phase or says the phase/feature is done and ready to ship. Runs full verification, the definition-of-done checks, flips the roadmap, then hands to branch finishing.
---

# Ship Phase

## Overview

A phase ships only with evidence (superpowers:verification-before-completion). This is the exit gate from rule 12.

## Steps — in order, stop on any failure

1. **Full gate**: `pnpm lint && pnpm type-check && pnpm test && pnpm build` — all green, show the output.
2. **Definition-of-done sweep** (rule 12):
   - User-facing behavior changed? → matching `packages/help-content` article(s) and copilot tool registrations are in this branch (rule 09).
   - New tables? → RLS in the same migration + guardrail test extended (run `/vantera-db-migrations` checklist on the diff).
   - Send-path code? → suppression-check test exists (rule 11).
3. **Audits**: dispatch the `whitelabel-auditor` subagent on user-facing diffs; dispatch `rls-auditor` if `packages/db` changed. Resolve findings before proceeding.
4. **Roadmap flip**: check the phase's checkbox in `docs/roadmap.md` and note anything descoped (descoped items become new roadmap bullets, never silent drops).
5. **Spec/plan hygiene**: the phase's spec and plan are committed and reflect what was actually built (update if the build diverged).
6. **Finish the branch**: invoke `superpowers:finishing-a-development-branch` (merge vs PR per the owner's call).

## Red flags

- "Tests pass" without fresh output in this session → run them again.
- A skipped checklist item "to be done in a follow-up" → it goes back on the roadmap explicitly, with the checkbox left unflipped if it was part of the phase's definition.