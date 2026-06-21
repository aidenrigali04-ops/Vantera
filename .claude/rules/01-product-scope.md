# Product: What Vantera is

Vantera is **the LinkedIn automation that replaces Waalaxy and Goji Berry** — a sales intelligence system run by SDR agents that identify intent, qualify prospects against the customer's ICP, send tailored outreach **on LinkedIn**, and handle the conversation until the lead closes or opts out, then funnel closed leads into the customer's CRM. It brings users more clients and revenue while saving them time and money — their LinkedIn, run the way they want, hands-off. The product loop:

```
Identify (ICP + LinkedIn intent) → Qualify → Draft → Outreach (LinkedIn) → Converse → Close → push to customer's CRM
```

**Only high-quality leads.** Two ways a person enters the funnel: ICP-fit discovery (the Scout, rules 05/06) and LinkedIn intent (the Intent Agent — people showing in-market behavior on LinkedIn around the customer's niche). Both pass the *same* qualification gate; intent is a second filter, never a bypass.

## In scope
SDR agents (Scout, Outreach, and the planned Intent agent), auth, onboarding, dashboard, **LinkedIn outreach (the only send channel)**, LinkedIn intent detection, data enrichment, Meta Ads + lead nurturing (a separate inbound lead-gen initiative), CRM connection funnel (closed leads pushed to the customer's CRM — Vantera is not itself a CRM), revenue goal, progress & analytics tracking, team seats, Stripe billing.

## Out of scope
**Email outreach, SMS/iMessage, and AI cold calling** — removed in the 2026-06-20 LinkedIn-only rescope (infra + workflows). Also out: inbox, white-label branding, client portal, and anything unrelated to LinkedIn outreach, lead nurturing, or CRM connection.

## Key initiative: Meta Ads generation
Users generate Meta ads directly on the platform via Claude and Higgsfield, feeding the lead-nurturing channel. Note: Meta Ads is an inbound lead-gen channel alongside the core LinkedIn-only outreach — retained, but flagged for a separate keep/cut call against the pure-LinkedIn positioning.
