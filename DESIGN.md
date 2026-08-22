# Vantera — Default UI build (design system)

The landing page is the visual reference for the whole product. This file is the
contract every surface inherits so screens don't drift. Approved 2026-06-13 as the
**default UI build** (dashboard rebuilt to match the landing here).

## Tone & differentiator

Dark, monochrome, premium-restraint. White-on-near-black, generous space, one
characterful type pairing, motion that reveals rather than decorates. The
differentiator is **calm authority** — a quiet control room, not a busy SaaS
dashboard. Distinctive = restraint, not ornament.

## Theme

- **The app is light-first** (Dashboard blueprint v1.0, 2026-08-21, D2). The root layout
  forces light; the landing stays dark (category + demo). The app's tokens live under
  `.app-surface` in `globals.css` — `--canvas #F6F6F7`, `--surface #FFF`, `--surface-2`,
  `--line`, `--ink` / `--ink-mid` / `--ink-dim` — with a complete `.dark .app-surface`
  block holding the same roles in dark values, so dark stays one token flip away.
  "Dark is the designed-for default" now applies to the **landing only**.
- **No animated particle background on the dashboard.** The `DottedSurface` canvas is
  landing/auth/onboarding only. The dashboard is calm and static; Today's one decorative
  element is the `--wash` highlight behind the greeting.

## Type

- Families — **app (`.app-surface`): Geist Sans + Geist Mono** (D3, 2026-08-21): one
  family, two roles. UI text is Geist Sans; every number, time, cap, score, count, and
  keyboard hint is Geist Mono with tabular figures (`font-mono` / `.font-data`). The
  `--font-sans` / `--font-heading` / `--font-mono` theme tokens are remapped to Geist on
  `.app-surface` only. **Landing + auth keep Poppins.** No Inter/Roboto/system stacks.
- App labels are **sentence case** — no uppercase tracked eyebrows on Today-era surfaces;
  max weight 600.
- Display / section titles: `font-heading text-3xl/4xl font-semibold tracking-tight`.
- Card/panel titles: `font-heading text-base font-semibold`.
- Eyebrows + numeric stats + small labels: `font-mono`, uppercase eyebrows at
  `text-[11px] tracking-[0.18em] text-muted-foreground`.
- Big numbers: `font-mono text-2xl font-semibold tabular-nums`.
- Body: `text-sm text-muted-foreground`.

## Panels (the core primitive)

The landing's panel recipe — a clean translucent card, NOT the liquid-glass
distortion `Card`. Reusable as `components/ui/panel.tsx` (`Panel`).

```
rounded-2xl border shadow-lg
  dark:  border-white/[0.12]  bg-white/[0.04]   shadow-black/30
  light: border-black/[0.07]  bg-black/[0.02]   shadow-black/5
```

- Radius: `rounded-2xl` (panels), `rounded-xl` (inner tiles/tables).
- Inner padding: `p-5` (default), `p-4` (dense tiles).
- Hover (interactive panels only): border brightens to `dark:border-white/20`.

## Accent

**App (2026-08-21): accent is blue, used only for meaning; the primary button is ink.**
Inside `.app-surface`, `--acc #2563EB` (`--acc-ink`, `--acc-tint`) marks *interactive /
Interested / active tab* and nothing else; `--positive` = a sender that is Active,
`--attention` = a state that needs a repair or is holding work, `--danger` = the engine
is stopped. Score chips use the neutral ramp, never traffic lights. The commit action
(`InkButton`) is the darkest thing on the page, which is what keeps blue free to mean
something. Gold and the dashboard's former cyan retire with the dark-first dashboard.

**Landing (2026-06-15): one reserved gold, monochrome everything else.** The brand accent is
a single gold-leaning amber, `--brand: #f5c518` (`--brand-foreground` near-black for
text on it), defined in `globals.css` and exposed as Tailwind `bg-brand` /
`text-brand-foreground` / `shadow-brand`. It is **reserved for the signup/commit
action only** — the `Get started`/`Get started free` CTAs in nav, hero, the gated
payoff, and the final CTA — plus a faint gold pool behind the closing CTA
(`color-mix(var(--brand) 12%)`). This is the isolation/von-Restorff lever: gold is
the *only* hue on the page, so the eye goes straight to the conversion action.
Rationale: chosen over switching the landing to a light theme — dark stays (it sells
the interactive demo + matches the AI-tooling category); the conversion lever is a
reserved accent, not the theme.

**Everything decorative stays monochrome.** Dots/bars/glows still use white → `#d4d4d4`
(`WARM`/`WARM_GRADIENT` in `components/landing/landing-theme.ts`, still all white) —
deliberately *not* goldened, to keep gold exclusive to the commit action. The full
warm sunset (`#FFCC1A → #FF730D → #EB291C`) remains parked in that file. Charts use
`rgba(255,255,255,0.08)` for muted series and the white gradient for the highlighted
series.

## Motion

framer-motion, reveal-on-enter, orchestrated and staggered (never scattered):

```
initial={{ opacity: 0, y: 20 }}
whileInView / animate ={{ opacity: 1, y: 0 }}
transition={{ duration: 0.6, delay: index * 0.06 }}
viewport={{ once: true, margin: "-60px" }}
```

`Reveal` (container) staggers its children; honors `prefers-reduced-motion`.

## Slop guardrails (this project)

No Inter/Roboto, no purple/indigo or `blue-500` defaults, no icon-on-every-row,
no gray-on-gray timidity, no placeholder copy, no animation without a
reduced-motion fallback. One dominant surface tone (near-black), one disciplined
treatment (white), real product copy + real data only.
