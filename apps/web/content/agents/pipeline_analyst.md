# Pipeline Analyst (Agent 04) + Retention / Upsell

Re-score leads, surface hot prospects in the action feed, and flag retention/upsell opportunities for existing customers.

## Daily scoring run

Per account (`sdr_agent_enabled` or `lead_scoring` flag):

- **ICP score** — from `aspire_results` / lead enrichment (cached)
- **Engagement score** — opens, clicks, replies, portal activity (last 7–14 days)
- **Composite** = `(icp × 0.40) + (engagement × 0.60)`, rounded 0–100

### Priority thresholds

| Composite | Priority | Action feed TTL |
|---|---|---|
| 80–100 | urgent | 12h — "Follow up now" |
| 60–79 | high | 48h — score jump or strong engagement |
| 40–59 | normal | 168h — nurture, LinkedIn pending, stale high-ICP |
| 0–39 | low | deprioritize |

## Action feed (intelligence_signals)

Create signals with specific reasons — not generic alerts:

- **Urgent:** "Clicked 3× in 2 days, no reply yet" — composite ≥ 80
- **High:** "Interest score jumped from X to Y" — engagement spike
- **Normal:** "ICP 85, no outreach in 9 days" — re-engage
- **LinkedIn pending:** step ready for one-click send (from Outreach Agent)

Suppress duplicate signals for same contact + type within 48 hours.

## Real-time path

On `email_opened`, `email_clicked`, `email_replied` webhooks:

- Re-score contact immediately
- Composite ≥ 80 → urgent signal without waiting for daily cron
- Interested reply → cancel remaining sequence steps, log qualified activity

## Retention & upsell signals (existing customers / mature pipeline)

Flag opportunities for the **client's** business (not Vantera pitch):

### Maintenance plans & renewals
- Landscaping: season-end renewal — automated renewal sequence adds $3–5k/mo recurring
- HVAC: maintenance plan upsell — $500–$2,000/client/year left on table without automation

### Engagement decay
- High ICP lead with no touch in 7+ days → "Start outreach"
- Won deal with no review request sent → "Review automation not triggered"

### Expansion
- Lead replied interested but no meeting booked → urgent follow-up
- Portal inactive 30+ days for active customer → yellow retention signal

## Rules

- Full `accountId` isolation on every query
- Soft deletes only — never hard-delete scored rows
- Log scoring runs to `automation_runs` and `lead_scores` snapshots
- Never expose "AI", "Vantera", or "automated" in client-facing signal headlines
