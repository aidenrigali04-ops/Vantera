# UI/UX workflow

## Theme strategy — per-surface (updated 2026-06-13)

App default is **dark** (`defaultTheme="dark"` in `apps/web/src/app/layout.tsx`); the **theme toggle
lives only on the dashboard** (`(app)/layout.tsx`). Surfaces are forced per-context, independent of
the global toggle:

- **Landing** — forced **dark**, strict **monochrome** (brand warm sweep parked; see
  `components/landing/landing-theme.ts`). White particles via `DottedSurface colorTheme="dark"`.
  The page wrapper has **no opaque background** so the dark body shows behind the fixed `-z-1`
  particle canvas (an opaque wrapper bg hides the particles — the bug fixed here).
- **Auth + onboarding** — forced **dark** (a `.dark` class on each shell) so they stay dark
  regardless of the dashboard toggle. Each shell has **no opaque background** + a fixed
  `-z-10 bg-background` dark backdrop behind `DottedSurface colorTheme="dark"` (white particles) so
  the particles stay visible. Onboarding had no particle background before — added here.
- **Dashboard** — follows the global theme (dark default; toggle switches it to light).

**Particle-visibility rule:** the `DottedSurface` canvas is `fixed -z-1`; any opaque in-flow
background on the wrapper paints over it and hides the dots. A forced-theme surface must keep the
wrapper transparent and put a separate fixed `-z-10` backdrop behind the canvas.

Montserrat + Geist Mono pairing unchanged. Landing panels use ~`bg-white/[0.06]` +
`border-white/[0.16]` + a soft shadow for contrast on the near-black background.

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

## Data-surface doctrine (locked 2026-07-04)

**The surface is the unit of work, never the existing container** (owner directive 2026-07-04 —
UI changes must not stay "within the small box"; grounded in the Attio/Linear/enterprise-table
research in the 2026-07-04 market+UI plan).

**Width**
- Data surfaces (Leads, lead brief, Results/Analytics/Pipeline, Agents) are **fluid**:
  `mx-auto w-full` + a scannability guard — `max-w-[1680px]` for full tables (Leads),
  `max-w-[1560px]` for the lead brief, `max-w-[1400px]` for mixed panel/KPI surfaces.
  Never a `max-w-5xl`-class cap on a data surface.
- Focused, single-task surfaces (auth, wizards, settings forms, modals) **keep their caps** and
  the spacing scale above — whitespace lowers perceived effort there, and only there.

**One border level per region.** A table or board sits in ONE `rounded-xl` hairline container —
never a card inside a card. Nested boxes are the visual root of cramped UI.

**Tables**
- Sticky `thead` (`sticky top-0 z-10`; solid `bg-[var(--tint)]` on the header cells with the top
  corners rounded on the cells). **Never `overflow-hidden` on the table container** — it kills the
  sticky header.
- Header cells 11px uppercase tracking-wide muted; body `text-sm`; every number `font-data`
  tabular. Row hover is mandatory (`hover:bg-[var(--cyan-tint)]/50`) — eyes track rows across
  wide tables.
- Row click opens the shared side-peek profiler (`components/lead-profile.tsx`) — never a full
  navigation from a scan surface. The full-page brief is the peek's pinned footer link.
- Row density (comfortable `py-3` / compact `py-1.5`, localStorage-persisted) on any table
  expected to exceed ~25 rows.

**Color on data surfaces (the Linear rule).** Neutral text/icons at 40–60% opacity carry the
hierarchy; full saturation is reserved for meaning: status (the two-hue grade), interactive
elements (cyan), wins (`--positive`), attention (amber). Never decorative color.

Reference implementation: `apps/web/src/app/(app)/leads/page.tsx` + `leads-table.tsx`.

**One-screen shells (2026-07-05).** App pages are one-screen on desktop: the page wrapper is
`flex flex-col lg:h-[calc(100dvh-3rem)]`, the header/tabs/toolbars are `shrink-0`, and the
content sits in ONE `min-h-0 flex-1 lg:overflow-y-auto` region — the PAGE never scrolls; only
the data region does (mobile keeps natural flow). Sticky table headers stick to that region's
top. Settings/wizard forms are exempt (focused surfaces). Reference: `leads/page.tsx` +
`dashboard/page.tsx` + the lead brief.


## Today-era app shell (locked 2026-08-21 — Dashboard blueprint v1.0)

Supersedes the lines above where they disagree; the landing/auth/onboarding sections stand.

- **Theme**: the app is **light-first** (root layout forces light); the landing stays dark.
  App tokens live under `.app-surface` with a complete dormant `.dark .app-surface` block.
- **Type**: **Geist Sans + Geist Mono** inside `.app-surface` (the theme font tokens are
  remapped there); landing/auth keep Poppins. Sentence case; numbers tabular mono.
- **Accent**: blue (`--acc`) means *interactive / Interested / active tab* only; the
  primary button is **ink**. Replaces the "interactive elements (cyan)" line of the
  data-surface doctrine.
- **Nav model**: the dock rail is retired. A 64px **top chrome band** carries the logo
  tile, workspace pill, centered nav pill (Today · Approvals · Inbox · Prospects · Playbook),
  utility tiles (search ⌘K · bell · settings) and the avatar. Mobile: 48px top bar +
  bottom tab bar.
- **Vocabulary**: Review → **Approvals**, Leads → **Prospects**, Brain/Agents → **Playbook**,
  Results → **Today**, Channels → **Senders** — labels and routes agree (308 redirects from
  the old paths).
- **One-screen shells**: the doctrine applies to *data surfaces* (Approvals, Prospects).
  **Today scrolls** — it is a launchpad, not a data surface.
- **Caps on screen are the code's caps** (`packages/jobs/src/pipeline/safety-limits.ts`);
  the UI never hardcodes a send limit.
