# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Vantera is

Vantera is a sales intelligence system run by SDR agents. The agents prospect, score, and outreach **only high-quality leads**, using data enrichment tailored to the customer's industry and ICP, then funnel closed leads into the customer's CRM. The product loop:

```
Prospect → Enrich (industry/ICP-tailored) → Score → Outreach → Nurture → Close → push to customer's CRM
```

### In scope
SDR agents, auth, onboarding, dashboard, LinkedIn outreach, email outreach, AI caller, Meta Ads + lead nurturing, data enrichment, CRM connection funnel (closed leads pushed to the customer's CRM — Vantera is not itself a CRM), revenue goal, progress & analytics tracking, team seats, Stripe billing.

### Out of scope
Inbox, white-label branding, client portal, and anything unrelated to sales, lead nurturing, outreach, or CRM connection.

### Key initiatives
- **Meta Ads generation** — users generate Meta ads directly on the platform via Claude and Higgsfield, feeding the lead-nurturing channel.
- **UI Designer Reference sheet** — a development-only artifact (never user-facing) used to build the dashboard UI. Workflow: replicate the reference precisely, then customize. No AI slop — every aspect, feature, and component must be pinpointed precisely against the reference.
- **UX Brain** — a backend development layer governing dashboard UI/UX: formatting, workflow, pipeline, and all aspects of the user experience. Its mandate is maximum positive user experience and predicted retention via optimal best practices. UI/UX changes route through it.
- **Key Prompting Notes** - When Building the UI go throuh this looping prompting until Ui is 100% matched from reference. Loop: Task>Do The Task>Verify Result> Repeat until Ui is 100% matched.