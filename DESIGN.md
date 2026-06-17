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

- App default is **dark** (`defaultTheme="dark"`, root layout). Dashboard keeps the
  toggle (rule 07); panels are theme-aware so light mode still works, but the
  **dark theme is the designed-for default** and is what must match the landing.
- **No animated particle background on the dashboard.** The `DottedSurface` canvas is
  landing/auth/onboarding only. The dashboard is calm and static.

## Type

- Families: **Montserrat** (`--font-montserrat`, `font-heading` + `font-sans`) +
  **Geist Mono** (`--font-mono`). No Inter/Roboto/system stacks.
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

**One reserved gold, monochrome everything else (2026-06-15).** The brand accent is
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
