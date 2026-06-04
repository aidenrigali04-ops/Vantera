# Workflows, Forms & Pipelines

Goal: move the user through a sequence with minimum decisions, zero lost work, and always-visible progress.

## Multi-step wizards

### Structure
- **3–5 steps max.** More steps → combine or defer to post-setup
- **Step indicator** always visible: "Step 2 of 4 — Connect data"
- **Back preserves input.** Never clear fields on back navigation
- **Forward validates current step only.** Don't fail step 2 because step 4 has an issue

### Step content rules
- One topic per step
- Primary action label reflects outcome: "Connect Slack" not "Next"
- Final step summarizes before commit
- Allow skip with clear consequence

### Branching
- Branch as early as possible (don't make users sit through irrelevant steps)
- Show why the path changed: "Since you chose Enterprise, we'll set up SSO next"

## Forms (single-page)

### Field order
1. Easiest / most familiar first (name, email)
2. Required before optional
3. Dependent fields immediately after their trigger (Country → State)
4. Destructive/sensitive last (delete account)

### Field count discipline
Every field must pass: **"Will the product break without this right now?"**
- No → defer or infer
- Yes → keep, with inline help if non-obvious

### Labels & placeholders
- **Label:** always visible (never placeholder-only)
- **Placeholder:** example format only, never the label repeated
- **Help text:** below field, before error; explain *why* you need it if non-obvious

### Validation timing
| Event | Validate |
|-------|----------|
| Blur | Format errors (email, phone) |
| Change (debounced) | Availability (username taken) |
| Submit | Cross-field rules, server errors |
| Never | On every keystroke (except password strength) |

### Smart defaults
Pre-fill from: previous session, account profile, geolocation, most common value, last-used value.

## Pipeline / Kanban views

### Column design
- **5±2 columns.** More → group stages or use list view toggle
- Column header: name + count + optional WIP limit indicator
- Most urgent column leftmost (or top on mobile)

### Card anatomy
```
[Title — one line, truncated]
[Key meta: assignee, date, status badge]
[Optional: 1–2 secondary fields]
```
Cards are scannable in 2 seconds. Detail on click.

### Drag & drop friction
- Drag handle visible (not whole-card drag unless obvious)
- Drop zones highlight on drag
- Undo toast on move: "Moved to Done — Undo"
- Keyboard alternative: select card → shortcut to move stage

### Bottleneck surfacing
- Highlight columns over WIP limit
- Show aging: "5 items stuck > 7 days"
- Sort within column by urgency/age, not just created date

## Bulk actions

When users repeat an action 3+ times, add bulk:
1. Checkbox column (leftmost)
2. Select-all with indeterminate state
3. Floating action bar on selection: "3 selected — Assign | Archive | Delete"
4. Confirm only for destructive bulk; prefer undo

## Keyboard support (power user friction reduction)

| Action | Shortcut |
|--------|----------|
| Submit form | Cmd/Ctrl + Enter |
| Close panel/modal | Escape |
| Navigate list | ↑↓, j/k |
| Select | x or Space |
| Primary action | Enter when focused |

Document shortcuts in tooltips on hover, not a separate help page.

## State preservation

Non-negotiable:
- **Autosave** drafts every few seconds with "Saved" indicator
- **Warn before leave** only if unsaved AND autosave failed
- **URL reflects state** for filters, tabs, selected item (shareable, back-button works)
- **Restore on return** — scroll position, expanded rows, filter state

## Long-running operations

- Start optimistically; show progress inline
- Allow user to navigate away; notify on completion
- Never block the whole UI for one record's save

## Anti-patterns

- "Next" / "Next" / "Next" with no indication of remaining steps
- Clearing form on back button
- 20-field form on one page with no sections
- Kanban with 12 columns
- No way to move items except drag (mobile nightmare)
- Confirmation modal on every stage change
- Wizard that can't be exited mid-flow
