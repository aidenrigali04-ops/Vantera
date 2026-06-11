# Vantera — approved design direction

Approved 2026-06-10 (supersedes the dark "Vantera OS" direction from earlier the same day, per founder feedback).

## Tone
Clean, minimal, professional SaaS. Monochrome black & white with **yellow as a minimal accent** — never a dominant color. Light theme is the default everywhere; dark remains an opt-in via next-themes.

## Type
- Headlines: **Montserrat**, semibold (`font-heading`, CSS var `--font-montserrat`).
- Body/UI: **Geist**, 13–15px (`font-sans`, `--font-geist-sans`).
- Eyebrows: 11px uppercase, tracking 0.08em, in `--highlight-text`.

## Color (tokens in apps/web/app/globals.css; light = default `.light`, dark = `:root`)
- Light: canvas `#f5f5f7`, surfaces `#ffffff`, text `#1d1d1f`/`#3f3f46`/`#71717a`.
- Primary actions: **black** (`--accent #111113`, hover `#2d2d31`), white text via `--text-inverse`.
- Yellow appears ONLY as minimal features: `--highlight #eab308` (decorative fills — stars, needles, chart-1), `--highlight-text #a16207` (AA text on white), focus rings/glow (`--border-focus`, `--shadow-glow`, shadcn `--ring` 45 93% 47%), `--accent-muted` yellow tints.
- Dark theme mirrors this: white primary buttons, `--highlight #facc15`.
- Never blue accents (legacy #0697FF is retired), never purple gradients, never stone-* grays.

## Shape & space
- Radius 12px cards/inputs, 8px small controls. `--shadow-sm/md/lg` tokens. Forms max 400px. Remove before adding.

## Voice
Confident, concrete, zero filler.

## Auth surface (current build)
50/50 split. Left on canvas: wordmark, Montserrat headline "Run your business from one system", dark-glass-free light OAuth buttons (white surface, hairline), email/password inputs, solid black CTA "Create workspace", black sign-in link, tiny legal line. Right on `--bg-subtle` behind a hairline with a 1px `--highlight` needle: eyebrow "TRUSTED BY OPERATORS" in `--highlight-text`, Montserrat headline, three testimonial cards (yellow 5-star rows, quote, initials avatar + name/role). Testimonial copy is placeholder — swap for real customer quotes at launch (components/auth/testimonial-cards.tsx).

## Process rule
Always run the retention-experience skill before any UI work (founder rule, 2026-06-10); its Retention Brief feeds the build.
