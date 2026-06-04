# Dashboards & Data Views

Goal: answer the user's question in under 5 seconds of scanning. Dashboards fail when everything screams equally loud.

## The 5-second test

Cover everything except one area. Can you answer "what needs my attention?" If not, hierarchy is broken.

**Fix order:**
1. What is the ONE number/status that matters most?
2. What changed since last visit?
3. What needs action right now?

## Information hierarchy

### F-pattern for dashboards
Users scan top-left → across → down-left. Put the most critical metric top-left. Secondary metrics row below. Details and tables lower.

### Metric card anatomy
```
[Label — plain language, not jargon]
[Primary value — large, scannable]
[Delta/context — vs last period, vs target, trend arrow]
[Optional: sparkline or mini chart]
```

Every metric needs context. "847" is meaningless. "847 active users (+12% vs last week)" is actionable.

### Status over data
When the user needs to act, lead with status:
- 🔴 3 clients at churn risk → not a table they must sort
- ⚠️ 2 invoices overdue → not "Total outstanding: $4,200"

Surface exceptions; hide the normal.

## Filters & time ranges

- **Default to the common case.** Last 7 days, active items, current user — not "All time / All statuses"
- **Show active filters visibly.** Chips with one-click remove
- **Persist last selection** per user
- **≤5 filter dimensions** visible; rest in "More filters"
- Date presets beat date pickers for 90% of use: Today, 7d, 30d, Custom

## Data tables

Tables are where friction compounds. Optimize ruthlessly.

### Column discipline
- **5–7 columns visible** without horizontal scroll
- Default sort = the sort users need (usually "needs attention" or "most recent")
- Hide rarely-used columns; let users customize
- Left-align text, right-align numbers
- Sticky header on scroll

### Row actions
- Primary action on row hover or inline (not buried in ⋮ menu)
- Bulk select + bulk action bar appears when rows selected
- Click row → detail panel (preserve list context), not full page navigation

### Pagination vs infinite scroll
- **Pagination** for admin/data tasks where users need to return to a position
- **Infinite scroll** for feeds and discovery
- Always show total count and current range: "Showing 1–25 of 847"

### Empty & loading
- Skeleton rows matching column layout (not a centered spinner)
- Empty: explain why + primary action to populate

## Charts

- **One insight per chart.** If you need a legend with 8 items, split the chart or use a table
- **Label directly** when possible (avoid legend hunting)
- **Start Y axis at zero** for bar charts (unless small-variation comparison with clear note)
- **Interactive drill-down** on click → detail panel, not new page
- Don't animate chart drawing on every load — it's wait tax

## Drill-down pattern

```
Dashboard (glance) → Click metric/card → Panel or page (detail) → Click item → Full record
```

Each level adds detail, not repetition. Don't re-show the same table at every level.

## Admin panels

Admin UIs serve two modes:
1. **Monitor** — scan for problems (dashboard pattern)
2. **Operate** — CRUD on records (table + form pattern)

Don't mix them on one screen. Tabs or separate views: Overview | Users | Settings.

## Density modes

Offer comfortable (default) and compact for power users who live in the tool daily. Never force compact on first visit.

## Anti-patterns

- 12 KPI cards in a grid with equal visual weight
- Charts with no axis labels or units
- Tables that require horizontal scroll for the primary column
- Filters reset on every navigation
- "Export" as the only way to see full data
- Real-time updates that shift layout while user is reading
