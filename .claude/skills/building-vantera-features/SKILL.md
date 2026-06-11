---
name: building-vantera-features
description: Use when building ANY Vantera product feature — UI, API routes, pipeline stages, schedulers. The feature definition-of-done — TDD, white-label, tenant scoping, suppression, knowledge-sync — applies to every feature PR, not just the big ones.
---

# Building Vantera Features

## Overview

Vantera's locked rules turn into per-feature obligations. This is the definition of done for any feature; rule references in parentheses.

## Definition of done — every feature

- [ ] **TDD**: failing test first (superpowers:test-driven-development); locked behaviors get guardrail tests
- [ ] **Tenant scoping**: `accountId` only from the validated Supabase session — never URL, query, or body (rule 02)
- [ ] **Vendors behind interfaces**: product code imports `@vantera/email-infra` / `@vantera/linkedin-infra` / (future) enrichment interface — never a vendor SDK or API directly (rules 03/04/05)
- [ ] **White-label**: Smartlead, Unipile, Explorium, Clay never appear in UI text, DTOs, error messages, or help content
- [ ] **AI access**: models only via `@vantera/ai`'s `getModel()` — never a direct provider construction (rule 02)
- [ ] **Knowledge-sync**: user-facing behavior change → matching `packages/help-content` article + copilot tool registration in the same PR (rule 09; see building-copilot-features)
- [ ] **Roadmap**: phase checkbox flipped in `docs/roadmap.md` when the phase completes (rule 12)

## Conditional obligations

| If the feature… | Then… |
|---|---|
| Touches a send path (email or LinkedIn) | Suppression check enforced at the scheduler boundary + a test proving a suppressed lead is never sent (rule 11) |
| Creates tables | Run `/vantera-db-migrations` — RLS in the same migration + guardrail test |
| Adds an inbound webhook | Signature verification + replies routed to the shared reply-classification handler (rules 03/04) |
| Adds cold-email copy surface | Unsubscribe link + physical address present (rule 11) |
| Schedules LinkedIn actions | Safety limits non-configurable below thresholds (rule 04) |
| Builds dashboard UI | Rule 07 loop: replicate reference precisely → verify → repeat until matched |

## Before shipping

Run `/ship-phase` (or at minimum: `pnpm lint && pnpm type-check && pnpm test && pnpm build` + the `whitelabel-auditor` subagent on user-facing diffs).