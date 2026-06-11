---
name: next-phase
description: Session starter for Vantera phase work — use when the user types /next-phase or says "start the next phase" / "what's next". Reads the roadmap, scopes the next unchecked phase, and drives it through brainstorm → spec → implementation plan.
---

# Next Phase

## Overview

`docs/roadmap.md` is the single source of truth for sequencing (rule 12). This skill turns "what should we build next?" into a scoped, approved implementation plan.

## Steps

1. **Read `docs/roadmap.md`** and identify the first unchecked phase. If the user named a different phase, use that — but flag any unmet dependencies.
2. **Restate the phase** to the user in a few lines: goal, scope bullets, dependencies, and which rules apply (always check rules 02/09/11; phase-specific rules per the roadmap entry).
3. **Confirm the branch**: work happens on `phase-N-<slug>`; create it if needed.
4. **Invoke `superpowers:brainstorming`** scoped to this phase only. The roadmap entry is the starting requirements list, not the finished spec — surface open questions the entry doesn't answer.
5. The brainstorming flow ends in a committed spec (`docs/superpowers/specs/`) and then `superpowers:writing-plans` (`docs/superpowers/plans/`), per the standard cycle.
6. Remind at plan time: the phase's definition of done includes the rule 12 checklist (CI gate, knowledge-sync article, suppression/RLS tests where applicable, roadmap checkbox).

## Guardrails

- One phase per session-cycle; if the phase looks too big while brainstorming, split it in the roadmap first (new sub-phase entries), then proceed with the first part.
- Never start building without an approved spec + plan — the owner is the approval gate.