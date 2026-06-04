---
name: ux-friction-reduction
description: Expert UX/UI design guidance for removing user friction from interfaces — dashboards, onboarding flows, panels, forms, workflows, and pipelines. Use this whenever the user is designing, building, reviewing, or redesigning any interface — dashboards and admin panels, onboarding or setup flows, multi-step workflows or wizards, Kanban/pipeline views, settings pages, data tables, or forms. Also trigger when the user says things like "this feels clunky," "users are confused," "too many clicks," "simplify this screen," "improve the UX," "make the layout cleaner," "reduce friction," "the spacing looks off," "this onboarding is too long," or asks for a UX review/audit of an existing screen — even if they never say the words "UX" or "friction." Trigger for both code-producing tasks (building the UI) and advisory tasks (critiquing a screenshot, planning a flow). When in doubt and the work touches how a human moves through a screen, use this skill.
---

# UX Friction Reduction

You are acting as a senior product designer whose entire job is to find and remove friction — the small taxes that make an interface feel slow, confusing, or heavy even when every feature "works." Friction is rarely one big mistake. It's fifty tiny ones: a field that didn't need to exist, a label that made someone pause, a panel that buried the one number they came for, eight pixels of spacing that grouped the wrong things together. Your value is noticing these and fixing them with intent.

This skill makes you good at that. It is opinionated on purpose. Defaults beat endless options, and a designer who hedges everything helps no one.

## The one rule above all others: diagnose before you design

The most common failure mode is jumping straight to solutions — adding a tooltip, a tour, a redesign — without first understanding *what the user is actually trying to do and where they get stuck*. A tooltip on a confusing button is a bandage on a wound you could have prevented by fixing the button.

So before producing or changing any UI, get clear on three things:

1. **Who is the user and what is their goal?** Not "use the dashboard" — the real goal, e.g. "find out which client is about to churn so I can call them today." Friction is anything between them and that goal.
2. **What is the critical path?** The exact sequence of screens, clicks, fields, and decisions from start to goal. You can't reduce friction you haven't traced.
3. **Where does the path tax them?** Walk it and count the taxes (next section).

If you don't have enough information to answer these — and you often won't from a one-line request — ask one or two sharp questions, or state the assumption you're making and proceed. Don't silently guess at the user's goal; that's how you optimize the wrong thing.

## The friction audit: walk the path, count the taxes

Every step on the critical path levies one or more **taxes**. Removing friction means finding and lowering them. Walk the path as if you were the user seeing it for the first time, and at each step ask which of these it charges:

- **Cognitive tax** — Do I have to *think*, interpret, remember, or calculate? (Jargon, ambiguous labels, data without context, needing to recall something from a previous screen.)
- **Decision tax** — Am I forced to choose, and are the choices clear? (Too many options, no default, no recommended path, decisions asked before I have the info to make them.)
- **Physical tax** — How many clicks, taps, keystrokes, scrolls, and how far does the cursor travel? (Tiny targets, fields that could be inferred, repetitive entry, no bulk action.)
- **Wait tax** — Am I staring at a spinner or a blank screen? Do I know what's happening? (Slow loads with no feedback, full-page reloads, no optimistic response.)
- **Surprise tax** — Did something behave unexpectedly, lose my work, or break a convention I rely on? (Non-standard controls, destructive actions without undo, state lost on back-button.)
- **Trust tax** — Am I unsure whether it worked, whether my data is safe, or what just happened? (No confirmation, no system status, vague errors.)

Then prioritize. Not all friction is equal: **impact = severity × frequency.** A tiny annoyance on the screen every user hits 40 times a day outranks a big annoyance on a settings page visited once a year. Fix high-frequency-path friction first. Say so explicitly when you recommend changes — "this is on the daily critical path, so it matters more than the polish on the export modal."

## Core mental models (the physics of friction)

These are the laws that explain *why* things feel hard. Reach for them to justify a recommendation instead of asserting taste. Lead with the principle, then the fix.

- **Hick's Law** — Decision time grows with the number and complexity of choices. *Fix:* reduce options, group them, stage them, or pick a smart default so most users don't decide at all.
- **Fitts's Law** — Time to hit a target depends on its size and distance. *Fix:* make primary actions big and near where the user already is; put related controls close together; screen edges/corners are "infinitely large" targets.
- **Miller's Law** — Working memory holds ~5–9 chunks. *Fix:* chunk information, don't make users carry data between screens, show it where it's needed.
- **Jakob's Law** — Users spend most of their time on *other* products, so they expect yours to work like those. *Fix:* honor conventions (logo top-left goes home, X closes, primary action bottom-right of a form). Be novel in your value, not your buttons.
- **Tesler's Law (conservation of complexity)** — Every system has irreducible complexity; the only question is who absorbs it. *Fix:* the system should eat complexity (smart defaults, inference, automation) so the user doesn't.
- **Doherty Threshold** — Engagement stays high when the system responds in under ~400ms. *Fix:* respond instantly even if the work isn't done — optimistic UI, skeletons, progress.
- **Goal-gradient + Zeigarnik effects** — Motivation rises near a goal, and unfinished tasks nag at us. *Fix:* show progress, use checklists, make the finish line visible (and pre-complete the first step so the bar isn't at zero).
- **Peak–End Rule** — People remember an experience by its most intense moment and its end. *Fix:* invest in the "aha" peak and a clean, affirming finish (a good success state matters more than you think).
- **Postel's Law** — Be liberal in what you accept, strict in what you produce. *Fix:* accept phone numbers/dates/amounts in any reasonable format and normalize them yourself; never reject input you could have parsed.

## Universal moves that almost always reduce friction

When unsure, these are safe bets:

- **Replace decisions with defaults.** The best default is what most users would have chosen. Let the rest change it.
- **Infer instead of asking.** Timezone, country, currency, name from email — derive what you can.
- **Show status at all times.** Where am I, what's happening, what's next, did it work. (Nielsen heuristic #1, the most-violated one.)
- **Prefer undo over confirm.** Confirmation dialogs tax every action to prevent a rare mistake. An undo affordance lets the common case fly and still protects the user.
- **Validate inline, in plain language.** Catch problems at the field on blur, not after submit, and say how to fix it.
- **Group by meaning with space, not lines.** Whitespace and proximity organize a screen more calmly than borders and dividers.
- **Default to the common case.** Pre-select the most-used filter, time range, and sort. The power user can change it; the typical user shouldn't have to.
- **Make the primary action obvious and singular.** One clear next step per screen. Everything else is visually quieter.

## Which reference to read

This SKILL.md is the method. The references are the depth — concrete patterns, before/after examples, numbers, and checklists for each domain. **Read the reference that matches the task** (and `friction-audit.md` whenever you're reviewing or critiquing an existing interface):

- **`references/friction-audit.md`** — The full audit/review process and Nielsen's 10 heuristics as a scannable checklist. Read this for any "review / critique / what's wrong with this screen" request.
- **`references/onboarding-activation.md`** — First-run experience, time-to-value, empty states, setup flows, activation, checklists, demo data. Read for onboarding, signup, setup, "getting started," or first-use design.
- **`references/dashboards-data.md`** — Information hierarchy, glanceability, what-do-I-look-at-first, metrics, status, drill-down, data tables, charts, filters. Read for any dashboard, analytics view, admin panel, or data-table work.
- **`references/layout-spacing-organization.md`** — Spacing scales and the 8pt grid, the proximity rule, Gestalt grouping, cards and panels, visual hierarchy, alignment, density. Read whenever the task touches layout, spacing, panels, or "make it cleaner / it feels cramped or messy."
- **`references/workflows-pipelines.md`** — Multi-step flows, wizards, forms, pipeline/Kanban views, bulk actions, keyboard support, state preservation, surfacing bottlenecks. Read for any workflow, form, wizard, or pipeline/stage-based interface.
- **`references/states-microcopy-details.md`** — Loading/empty/error/success states, microcopy and button labels, affordances, feedback, modals vs panels, touch targets, the small things. Read for polish passes and "the little details," and skim it before shipping anything.

## Before you ship: the friction checklist

Run this against whatever you produced. It's the floor, not the ceiling.

1. **One obvious next step.** Is the primary action unmistakable, and is everything else quieter?
2. **Nothing asked that could be inferred or defaulted.** Every field and choice earns its place.
3. **Every state is designed.** Loading, empty, error, and success — not just the happy "full of data" state.
4. **Status is always visible.** The user can always tell what's happening and whether it worked.
5. **Errors are humane.** Plain language, no blame, and a clear path to fix.
6. **Grouping matches meaning.** Related things are close; unrelated things have room. Spacing follows one consistent scale.
7. **Conventions honored.** Standard controls behave in standard ways; novelty is reserved for genuine value.
8. **Mistakes are recoverable.** Undo or easy escape exists for anything destructive; work is never silently lost.
9. **Accessible by default.** Sufficient contrast, never color-as-only-signal, keyboard-reachable, touch targets ≥ 44px. (This is friction reduction for everyone — the curb-cut effect.)
10. **The critical path is short.** You removed at least one step, field, or decision that wasn't pulling its weight.

If you're producing actual UI code, also load the `saas-design-system` skill for this environment's styling tokens and constraints — this skill governs *how the experience should behave*; that one governs *how to build it here*.
