# Layout, Spacing & Organization

Goal: group by meaning so the user never has to decode what belongs together. Spacing is your primary organizing tool — not borders.

## The 8pt grid

All spacing in multiples of 4 or 8. No arbitrary values.

| Token | Value | Use |
|-------|-------|-----|
| xs | 4px | Icon-to-label, tight inline gaps |
| sm | 8px | Related items in a row (badge + text) |
| md | 16px | Default padding inside components |
| lg | 24px | Between sections within a card |
| xl | 32px | Between major sections |
| 2xl | 48px | Page-level section breaks |
| 3xl | 64px | Hero / major page divisions |

**Rule:** Space *within* a group < space *between* groups. If two things have 8px between them and unrelated things have 8px too, grouping is broken.

## Proximity rule (Gestalt)

Things that belong together should be closer than things that don't.

**Bad:** Equal 16px gaps between title, description, form fields, and submit — reads as one blob.
**Good:** 8px title→description, 24px description→form, 8px between fields, 32px form→submit.

## Visual hierarchy (size + weight + color, not decoration)

Use at most 3 levels per screen:

| Level | Size | Weight | Color | Use |
|-------|------|--------|-------|-----|
| Primary | Largest | Semibold | Highest contrast | Page title, key metric |
| Secondary | Medium | Medium | Muted | Section headers, labels |
| Tertiary | Small | Regular | Most muted | Hints, timestamps, meta |

If everything is semibold, nothing is important.

## Cards & panels

Cards group related content. Use them when:
- Content is independently actionable
- Content has distinct state (loading, error)
- User may scan multiple cards in a grid

Don't card-wrap everything — a flat layout with section headers is often calmer.

### Card anatomy
```
[Optional: header with title + action]
[Body — 16px padding default]
[Optional: footer with actions, right-aligned primary]
```

- One primary action per card footer
- Don't nest cards inside cards (use sections with spacing instead)

## Page layout patterns

### Dashboard / list view
```
[Page header: title + primary action]
[Optional: tabs or filters — full width]
[Content area — max-width or full bleed depending on data density]
```

### Detail view
```
[Back link / breadcrumb]
[Title + status + actions]
[Two-column: main content (2/3) + sidebar meta (1/3)] — collapse to single column on mobile
```

### Form page
```
[Title + short description of what this does]
[Form sections with headers]
[Sticky footer: Cancel (ghost) + Save (primary)]
```

## Alignment

- **Left-align** text and form labels (never center body text)
- **Right-align** numbers in tables and numeric inputs
- **Align actions** to the trailing edge (Save bottom-right in LTR layouts)
- **Optical alignment** over mathematical — icons next to text often need 1–2px nudge

## Density

| Context | Spacing feel | Example |
|---------|--------------|---------|
| Marketing / onboarding | Generous (xl–2xl) | Signup, empty states |
| Daily work tools | Comfortable (md–lg) | Dashboards, CRM |
| Data-heavy admin | Compact (sm–md) | Tables, logs |

Match density to visit frequency. Tools used 8 hours/day can be denser than setup flows seen once.

## Dividers

Use dividers sparingly. Prefer whitespace. When you need separation:
- **Whitespace** — default
- **Subtle border** — between distinct regions in a dense panel
- **Full divider line** — only in menus, dense lists, or nav

If you're adding a divider, ask: would 8px more margin work instead?

## Responsive breakpoints

- **Collapse sidebars** to icons or drawer below 1024px
- **Stack columns** below 768px
- **Touch targets ≥ 44px** on mobile regardless of desktop density
- Don't hide critical actions in mobile hamburger if they're primary workflow

## "Feels cramped" vs "feels empty"

| Feels cramped | Fix |
|---------------|-----|
| Too many borders/boxes | Remove containers, use whitespace |
| Insufficient line-height | 1.5 for body, 1.2 for headings |
| Too many columns | Reduce visible columns, use detail panel |
| Wall of text | Break into sections with headers |

| Feels empty | Fix |
|-------------|-----|
| Too much whitespace without structure | Add section headers, not more boxes |
| Single item floating in huge canvas | Constrain max-width (640–960px for forms) |
| Missing secondary content | Add contextual help or related links in sidebar |

## Anti-patterns

- Mixing 12px, 14px, 15px, 18px spacing randomly
- Bordered boxes around every paragraph
- Center-aligned form layouts (harder to scan)
- Primary action top-left (fights F-pattern; primary goes trailing or after content)
- Sidebar + main content with no visual weight difference
