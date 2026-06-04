# Onboarding & Activation

Goal: get the user to their first meaningful success as fast as possible. Onboarding is not a tour — it's the shortest path to value.

## Core metrics to design for

- **Time to value (TTV):** Minutes from signup to first "aha" moment
- **Activation rate:** % who complete the action that predicts retention
- **Setup abandonment:** Where users drop off in setup flows

Design for TTV first. A shorter tour with faster value beats a comprehensive tour nobody finishes.

## The activation ladder

1. **Account created** — lowest bar; don't celebrate yet
2. **First data in** — imported, connected, or created one real thing
3. **First insight/action** — saw something useful or completed one core workflow
4. **Habit loop** — returned and repeated without prompting

Each step needs a visible checkpoint. Pre-complete step 1 (account exists) so progress never starts at zero.

## Patterns that reduce onboarding friction

### Defer, don't block
- Let users explore the product before forcing setup
- Collect only what's needed *right now*; ask for the rest in context ("Add your logo when you're ready to publish")
- OAuth/connect flows triggered when the feature is needed, not at signup

### Show, don't tell
- Replace 5-slide tours with one interactive task: "Create your first project"
- Highlight the one button that matters; dim everything else
- Use real UI, not illustrations of UI

### Demo data & templates
- Never show an empty dashboard on first login
- Pre-populate with realistic sample data clearly labeled "Sample — replace with yours"
- Offer templates for the 3 most common use cases

### Progressive checklist
- 3–5 items max; each ≤2 minutes
- Order by dependency and value (connect data before configure alerts)
- Collapse completed items; show "2 of 4 complete"
- Dismissible after activation, not before

### Empty states as onboarding
Every empty state answers: **What is this? Why is it empty? What do I do?**

```
[Illustration/icon — optional, small]

**No projects yet**
Projects help you organize work by client or initiative.

[Create project]  [Import from CSV]
```

Bad: "No data." with no action.

## Signup form friction killers

| Ask later | Ask now (if truly required) |
|-----------|----------------------------|
| Company size, role, phone | Email + password (or SSO) |
| Team invites | Name (or infer from email) |
| Preferences, timezone | Nothing else on step 1 |
| Billing | When they hit a paid feature |

- SSO (Google/GitHub) removes 3–5 fields instantly
- Split name into one field unless you truly need separate first/last
- Show password requirements inline as they type, not on failed submit

## Setup wizards

- **Max 5 steps.** More → restructure or defer
- **One decision per step.** Don't combine "choose plan" + "invite team" + "connect integration"
- **Summary before commit.** Show what will happen on the final step
- **Save progress.** Users will leave mid-setup; let them resume
- **Skip with consequence.** "Skip for now — you won't see alerts until you connect Slack"

## First-run success state

The peak-end rule applies hard here. The first success should:
- Confirm specifically what happened ("Project 'Acme' created with 3 tasks")
- Show the result immediately (navigate to the thing they made)
- Suggest one natural next step, not five
- Feel fast (<400ms perceived; use optimistic UI)

## Anti-patterns

- Forced product tour before any interaction
- 10-field signup for a free trial
- Blank canvas with no guidance
- Asking for payment before showing value
- Email verification blocking all access (allow limited explore, verify before sensitive actions)
- Celebration modals that block the UI on minor milestones
