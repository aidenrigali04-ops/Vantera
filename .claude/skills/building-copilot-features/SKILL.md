---
name: building-copilot-features
description: Use when building or modifying anything for the Vantera help copilot — copilot tools, help-content articles, the overlay UI, the agent core — and when shipping ANY feature PR that adds or changes user-facing behavior (the knowledge-sync rule applies to every feature, not just copilot work).
---

# Building Copilot Features

## Overview

The copilot's safety comes from construction, not filtering: restricted info is never in its context. Source of truth: `docs/superpowers/specs/2026-06-11-help-copilot-design.md` + rule `.claude/rules/09-help-copilot.md`. This skill encodes the patterns the spec implies but doesn't spell out.

## Tool PR checklist (all in ONE PR)

- [ ] Tool definition via `registerTool` with declared tier (`read` | `navigate` | `mutate` | `critical`)
- [ ] Hand-built DTO + key-allowlist test (assert `Object.keys(dto)` exactly)
- [ ] `accountId` from server context only; tenant filter in the query itself
- [ ] Help-content article (`title`/`surface`/`routes`/`updated` frontmatter)
- [ ] Typed errors (`code` + `userMessage`); raw errors to server logs only
- [ ] No vendor names anywhere model-visible (Smartlead, Unipile, Explorium are white-labeled)

## Three patterns that get missed

### 1. The model NEVER supplies internal IDs

A tool whose input is `campaignId: uuid` is uncallable — the model has no UUIDs and must not see them (restriction model). Inputs are user-meaningful references; resolution happens server-side:

```typescript
// ❌ inputSchema: z.object({ campaignId: z.string().uuid() })
// ✅ resolve by name within the account, disambiguate via the model
inputSchema: z.object({ campaignName: z.string() })
// execute(): resolveCampaign(accountId, campaignName) →
//   0 matches → typed CAMPAIGN_NOT_FOUND; 2+ → typed AMBIGUOUS with candidate names
```

### 2. Audit is the registry's job — never skip, never hand-roll

`registerTool` wraps every `execute()` with the `copilot_actions` audit write (account, user, tool, params, outcome, undo state). Don't write audit rows inside tool bodies; don't expose any execution path that bypasses the registry.

### 3. Confirmation cards show real consequences

`mutate`/`critical` tools must implement `prepareConfirmation(input, ctx)` returning grounded facts for the card — "Pauses 'Q3 SaaS CFOs' — **14 leads mid-sequence will hold**" — fetched read-only before approval. A static string summary is a defect (churn check: motivational copy with no real data).

## Knowledge-sync (every feature, not just tools)

Any PR changing user-facing behavior ships its `packages/help-content` article in the same PR. New user-visible capability → also register its copilot tools. Check `copilot_knowledge_gaps` for related unanswered questions while you're there.

## Common mistakes

| Mistake | Fix |
|---|---|
| UUID/internal-ID inputs from the model | Name-based input + server-side resolution with typed ambiguity errors |
| Audit written in tool body (or not at all) | Registry wraps execute; tools stay audit-free |
| Static `confirmationSummary` string | `prepareConfirmation()` with live numbers |
| DTO spread from DB row (`...result`) | Explicit field-by-field construction + allowlist test |
| Article written later / separate PR | Same PR or the feature is not done |