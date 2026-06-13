# UI/UX workflow

## UI Designer Reference sheet
A development-only artifact (never user-facing) used to build the dashboard UI. Workflow: replicate the reference precisely, then customize. No AI slop — every aspect, feature, and component must be pinpointed precisely against the reference.

## UX Brain
A backend development layer governing dashboard UI/UX: formatting, workflow, pipeline, and all aspects of the user experience. Its mandate is maximum positive user experience and predicted retention via optimal best practices. UI/UX changes route through it.

## Key prompting notes
When building the UI, go through this looping prompting until the UI is 100% matched from reference. Loop: Task > Do The Task > Verify Result > Repeat until UI is 100% matched.

## Spacing & padding scale (locked 2026-06-12)

The source of truth for breathing room on **focused, single-task surfaces** (auth cards, onboarding/agent setup wizards, modals). Dense dashboard cards keep the tighter shadcn defaults — these values are for the "one thing at a time" surfaces where whitespace lowers perceived effort (Fogg B=MAP). Always use Tailwind's spacing scale; never raw pixels.

**Card / panel container**
- Inner padding token: `[--card-spacing:--spacing(8)]` (32px) on focused cards. Default (`--spacing(4)`, 16px) is dashboard-density and reads cramped for a form — do not ship a focused form at the default.
- Radius: `rounded-3xl` (24px). Any `AnimatedPanelBorder` must use the matching `radius={24}` (its default).

**Vertical rhythm inside a form card**
- Header → fields: `CardHeader` gets `pb-6`, `CardContent` gets `pt-4`. Header text must never butt the first field.
- Title → description: `gap-2.5`.
- Between fields: `space-y-9` (36px) — each field reads as its own block.
- Label → input → hint, within one field: `space-y-3.5` (14px).
- **Last field → footer divider:** `CardContent` gets `pb-8`. A `border-t` (e.g. `CardFooter`) draws at its own top edge, so without bottom padding on the content the divider butts the last hint line. Padding above the border lives on the content, not the footer.
- Footer (Back/Continue row): `pt-8 pb-6`.

**Inputs**
- Focused forms use `h-11 px-4 text-base` (roomy bar). The `h-9` default is dashboard-density only.

**Page chrome around a focused card** (progress steppers, endowed-progress notes, "Step X of N" indicators — the text *outside* the panel)
- Apply the same breathing room as inside the panel; do not let out-of-panel text crowd the card.
- Progress block → card: `mb-10` (40px). Card → trailing step indicator: `mt-6`.
- Within a stepper: dots row → bar `mb-3`, bar → endowed note `mt-3`/`mt-4`, dot → its label `mt-2`.

**Animated panel border (the traveling beam)**
- `AnimatedPanelBorder` is overlaid as a **sibling** of the card inside a `relative rounded-3xl` wrapper — never a child, or the card's `overflow-hidden` clips the beam. It is `pointer-events-none`.
- Beam color = the page's particle palette. Onboarding/auth use the warm sunset sweep (`#FFCC1A → #FF730D → #EB291C`), passed via the `gradient` prop (`PARTICLE_BEAM`). The component default stays the auth orange/magenta/violet; pass `gradient` to match a surface's particles.

Reference implementation: `apps/web/src/app/onboarding/wizard.tsx` + `apps/web/src/components/ui/animated-border.tsx`.