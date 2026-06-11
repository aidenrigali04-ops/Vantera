# Vantera OS — approved design direction

Approved 2026-06-10 (auth rebuild, Stitch project 10813569381811259057, design system assets/13910649414633257050).

## Tone
visionOS-grade dark minimalism: calm, premium, engineered. Near-monochrome with ONE accent.
Differentiator: the product sells itself in-chrome — live workspace preview beside auth/marketing surfaces, not stock art.

## Type
- Headlines: **Sora**, semibold, tracking -0.03em (next/font, CSS var `--font-sora`).
- Body/UI: **Geist**, 13–15px, relaxed line-height (CSS var `--font-geist`).
- Eyebrows: 11px uppercase, tracking 0.08em, accent color.
- Never Inter/Roboto/system stacks.

## Color (tokens live in apps/web/app/globals.css)
- Canvas `#000000` · panel `#0a0a0b` · surface `#0c0c0d` · elevated `#141417`.
- Accent `#0697FF` (hover `#2EA6FF`) — the ONLY accent: primary CTAs, focus rings, chart data, single hairlines.
- Text `#f5f5f7` / `#d6d6db` / `#9d9da6`. Errors use `--danger #ff453a`, never Tailwind red-600.
- Borders: glass hairlines `rgba(255,255,255,0.08)` (default) / `0.12` (inputs).
- Never purple gradients, never multi-color palettes, never stone-* grays.

## Shape & space
- Radius 12px cards/inputs, 8px small controls. Shadows deep + soft (`--shadow-lg`), focus glow `--shadow-glow`.
- Forms max 400px. Generous negative space; remove before adding.

## Voice
Confident, concrete, zero filler. "Run your business from one system" — not "Welcome back!".

## Auth surface (approved mockup)
50/50 split. Left, pure black: wordmark top-left; centered 400px form — Sora headline, dark-glass OAuth buttons (elevated surface, hairline border), hairline email divider, dark inputs, solid accent CTA "Create workspace", accent sign-in link, tiny legal line. Right, `#0a0a0b` behind a hairline divider with a 1px accent edge: eyebrow "YOUR WORKSPACE PREVIEW", Sora headline "Total visibility across your entire operation.", three trust lines with accent dot markers, floating glass dashboard preview card (revenue chart + pipeline rows).
