# Friction Audit & UX Review

Use this when critiquing an existing screen, reviewing a screenshot, or answering "what's wrong with this?"

## Review process

1. **State the assumed user and goal.** If unknown, ask or pick the most likely persona and say so.
2. **Trace the critical path.** List every step from entry to goal completion.
3. **Tax each step.** Tag cognitive, decision, physical, wait, surprise, and trust taxes.
4. **Score impact.** Severity (1–3) × frequency (daily / weekly / rare). Fix high scores first.
5. **Recommend fixes.** Lead with principle, then specific change. Separate "do now" from "nice later."

## Output format for reviews

```markdown
## Assumed user & goal
[Who, doing what, why now]

## Critical path
1. [Step] → 2. [Step] → ...

## Friction found (prioritized)

### 🔴 High impact
- **[Tax type] [Location]:** [What's wrong] → [Fix] — *[Principle]*

### 🟡 Medium impact
...

### 🟢 Polish
...

## Quick wins (≤30 min)
- ...

## Structural changes (if warranted)
- ...
```

## Nielsen's 10 heuristics (scannable checklist)

Run these against every screen. Violations are friction.

| # | Heuristic | Ask yourself | Common fix |
|---|-----------|--------------|------------|
| 1 | **Visibility of system status** | Can the user always tell what's happening? | Progress bars, skeletons, toasts, inline spinners on the element that changed |
| 2 | **Match real world** | Would a non-expert understand the labels? | Plain language, familiar metaphors, no internal jargon |
| 3 | **User control & freedom** | Can they undo, cancel, go back without losing work? | Undo toasts, explicit Cancel, autosave, confirm only for irreversible |
| 4 | **Consistency & standards** | Does this behave like other products and other parts of yours? | Same terms, same patterns, same placement for same actions |
| 5 | **Error prevention** | Could the design prevent the mistake instead of catching it? | Disable invalid actions, smart defaults, constraints over validation |
| 6 | **Recognition over recall** | Is info visible when needed, or must they remember? | Show context on the screen, recent items, suggested values |
| 7 | **Flexibility & efficiency** | Can power users go fast without slowing novices? | Keyboard shortcuts, bulk actions, defaults for common case |
| 8 | **Aesthetic & minimalist design** | Does every element earn its place? | Remove, collapse, or defer secondary info |
| 9 | **Help users recover from errors** | Are errors specific, blameless, and actionable? | "Email must include @" not "Invalid input"; suggest fix |
| 10 | **Help & documentation** | Is help needed because the UI failed? | Fix the UI first; docs/tooltips are last resort |

## Red flags (almost always friction)

- More than one primary-looking button on a screen
- Required fields that could be inferred or collected later
- Empty states with no next action
- Success with no confirmation the user will notice
- Modals that could be inline edits
- Settings buried more than 2 clicks deep for daily tasks
- Tables with no default sort/filter aligned to the user's goal
- "Are you sure?" on reversible actions
- Loading that blocks the whole page for a partial update
- Icons without labels (unless universally understood: X, ←, 🔍)

## Before/after framing

When suggesting changes, show the tax removed:

**Before:** User must open Settings → Integrations → Add → paste API key → Save → return to dashboard to verify.
**After:** Inline "Connect Slack" on the dashboard empty state; OAuth in a panel; success shows connected status in place.
**Tax removed:** Physical (4 clicks → 1), cognitive (must know where settings live), trust (verification in context).
