# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Vantera is a sales intelligence system run by SDR agents: prospect, score, and outreach **only high-quality leads**, then push closed leads into the customer's CRM.

Foundational decisions were locked 2026-06-11. The detailed rules live in `.claude/rules/` (auto-loaded alongside this file):

- [Product & scope](.claude/rules/01-product-scope.md) — what Vantera is, the product loop, in/out of scope, Meta Ads initiative
- [Stack](.claude/rules/02-stack.md) — locked framework, auth, DB, jobs, AI, billing, email choices
- [Email outreach infrastructure](.claude/rules/03-email-infra.md) — Smartlead behind the `email-infra` interface
- [LinkedIn outreach infrastructure](.claude/rules/04-linkedin-infra.md) — Unipile behind the `linkedin-infra` interface
- [Prospect data & enrichment](.claude/rules/05-enrichment.md) — Explorium AgentSource + enrichment waterfall
- [Lead scoring](.claude/rules/06-lead-scoring.md) — rules gate + AI rank, the "only high-quality leads" gate
- [UI/UX workflow](.claude/rules/07-ui-ux.md) — UI Designer Reference sheet, UX Brain, prompting loop, locked spacing/padding scale + animated-border convention
- [SDR agents & outreach pipeline](.claude/rules/08-campaign-pipeline.md) — agent setup wizards (the front door) + agent behavior contract
- [Help copilot](.claude/rules/09-help-copilot.md) — in-app LLM overlay, action tiers, knowledge whitelist, knowledge-sync rule
- [Deployment & environments](.claude/rules/10-deployment.md) — Vercel hosting, env ladder, migration discipline
- [Outreach compliance](.claude/rules/11-compliance.md) — suppression list, unsubscribe, GDPR deletion, audit trails
- [Delivery workflow](.claude/rules/12-delivery-workflow.md) — phase cycle, session commands, definition of done
- [SDR agent framework](.claude/rules/13-sdr-agent-framework.md) — the six-piece skeleton + folder constraints every agent (scout, copy, future caller/ads) follows

Sequencing lives in [docs/roadmap.md](docs/roadmap.md); production operations in [docs/production-readiness.md](docs/production-readiness.md).
