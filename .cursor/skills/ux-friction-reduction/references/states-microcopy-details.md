# States, Microcopy & Details

Goal: every state — loading, empty, error, success — is designed, and every word earns its place.

## The four states (none optional)

| State | User question | Design requirement |
|-------|---------------|-------------------|
| **Loading** | Is it working? | Skeleton matching layout; spinner on the element changing, not full-page |
| **Empty** | What is this? What do I do? | Explain + primary action + optional secondary |
| **Error** | What went wrong? How do I fix it? | Plain language, specific, actionable, no blame |
| **Success** | Did it work? | Confirm in context; suggest one next step |

Shipping only the "full of data" state is the most common friction sin.

## Loading patterns

| Scenario | Pattern |
|----------|---------|
| Initial page load | Skeleton screens matching content layout |
| Button action | Button shows spinner + "Saving…"; disabled |
| Background refresh | Subtle indicator (dot, "Updating…"); don't shift layout |
| >3s wait | Progress bar or step text: "Importing 240 of 1,200 rows…" |
| >10s wait | Allow cancel; show elapsed time |

**Never:** blank white screen, frozen UI with no feedback, spinner that blocks unrelated content.

## Empty state anatomy

```
[Small icon — optional, muted]

**[What's missing — specific]**
[One sentence: why it's empty and why it matters]

[Primary action]
[Secondary action — optional, text link]
```

Examples:
- ❌ "No data"
- ✅ "No invoices yet — Create one to start tracking payments" [Create invoice]

## Error messages

Formula: **[What happened] + [Why, if helpful] + [What to do]**

| Bad | Good |
|-----|------|
| Error 422 | This email is already registered. Try signing in or use a different email. |
| Invalid input | Password must be at least 8 characters. |
| Something went wrong | We couldn't save your changes. Check your connection and try again. |
| Failed | Upload failed — file must be under 10 MB. Yours is 24 MB. |

- Field errors appear at the field, not only in a top banner
- Never blame: "You entered…" → "This field needs…"
- Preserve user input on error — never clear the form

## Success states

- **Toast** for background actions: "Project archived — Undo"
- **Inline** for form saves: green check + "Saved" that fades
- **Full state** for major milestones: illustration + confirmation + next step
- Auto-dismiss toasts after 4–5s; persist if action needed (Undo)

Peak-end rule: the success moment should feel satisfying. One specific sentence beats generic "Success!"

## Microcopy rules

### Buttons
- **Verb + object:** "Create project" not "Submit" or "OK"
- **Confirm outcome on destructive:** "Delete project" not "Yes"
- **Loading state:** "Creating…" not "Loading…"
- **One primary per view.** Secondary = ghost/outline. Tertiary = text link.

### Labels
- Nouns for fields: "Email address" not "Enter your email address here"
- Sentence case, not Title Case Every Word
- No jargon unless audience is 100% technical

### Tooltips
- Last resort. If you need a tooltip to explain a label, fix the label.
- Max one sentence. No tooltip on tooltip.

## Modals vs panels vs inline

| Use modal when | Use panel/sheet when | Use inline when |
|----------------|---------------------|-----------------|
| Destructive confirm | Detail view (preserve list context) | Quick edit of 1–2 fields |
| Short form (≤3 fields) | Multi-field edit with reference data | Toggle, expand, accordion |
| Requires full attention | User may copy from background | Validation feedback |

Modal friction: blocks context, must dismiss to continue. Default to panel or inline.

## Touch targets & click areas

- Minimum **44×44px** touch target (can be padding around smaller visual)
- Row click area = full row, not just the text
- Space adjacent click targets ≥ 8px apart

## Feedback & affordances

- Hover states on all interactive elements
- Focus ring for keyboard navigation (never remove for aesthetics)
- Disabled buttons: explain why on hover if not obvious ("Complete required fields")
- Optimistic UI: update immediately, reconcile on server response

## Confirmation vs undo

| Destructive & irreversible | Reversible |
|---------------------------|------------|
| Type-to-confirm for delete-all | Undo toast |
| Modal with explicit consequence | Immediate action + undo window |
| Examples: delete account, purge data | Archive, move, edit, remove from list |

Default to undo. Reserve modals for truly irreversible actions.

## Pre-ship microcopy sweep

Read every string on the screen and ask:
1. Would a new user understand this without training?
2. Does every button say what it does?
3. Are error messages specific and actionable?
4. Is there any "Success" / "Error" / "Click here" / "Submit" left?
5. Are loading states labeled?

## Anti-patterns

- Placeholder-as-label
- Generic toast: "An error occurred"
- Success with no visible change (user clicks Save, nothing happens visually)
- Disabled submit with no explanation
- "Are you sure?" for everything
- Icon-only buttons without aria-label
- Red/green as the only success/error signal
