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
- [UI/UX workflow](.claude/rules/07-ui-ux.md) — UI Designer Reference sheet, UX Brain, prompting loop
