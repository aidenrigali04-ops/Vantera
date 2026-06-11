# Outreach compliance & data protection (locked 2026-06-11)

Compliance is built in from day one — suppression, unsubscribe, deletion, and audit are product requirements, not retrofits. Cold outreach has real legal surface (CAN-SPAM, GDPR/PECR, LinkedIn ToS); Vantera sends on customers' behalf, so a violation is a customer-trust violation.

## Suppression list (the master gate)

- A per-account **suppression list** (email addresses + LinkedIn profile URLs) is checked **before every send on every channel**. The check lives at the scheduler boundary so no send path can bypass it.
- Writes to suppression: unsubscribes, hard bounces, spam complaints, manual user adds, "not interested" reply classifications, and GDPR objections. Entries never expire.

## Email (CAN-SPAM / GDPR / PECR)

- Every cold email includes an **unsubscribe link** and the customer's **physical mailing address**. One-click unsubscribe writes to suppression immediately — no confirmation page friction, no login required.
- Honor unsubscribes across all campaigns of the account, not per-campaign.
- B2B prospecting under legitimate interest still requires: accurate sender identity, no deceptive subject lines, and prompt objection handling (objection = suppression).

## LinkedIn

- Safety limits (rule 04 — ramp, ~100 invites/week ceiling, randomized pacing) are **non-configurable below safety thresholds** and live in Vantera's scheduler. They protect the *user's own account* from restriction; treat them as compliance, not preference.

## Data protection

- **Deletion path**: account deletion cascades all tenant data (RLS-scoped tables) AND triggers deletion calls to vendors holding that account's data (email infra, LinkedIn infra, enrichment). A lead-level deletion path exists for GDPR erasure requests about a prospect.
- **Retention**: prospect data that never passed the scoring gate is not retained indefinitely — define retention windows per table as they're created.
- **Audit trail**: every outbound send lands in `outreach_sends` (account, campaign, lead, channel, mailbox/profile, timestamp, message ref). Copilot actions are already audited (`copilot_actions`, rule 09).

## Definition of done (extends every feature)

Any feature touching a send path must (1) enforce the suppression check and (2) ship with a test proving a suppressed lead is never sent to. Any feature creating prospect-data tables must state its retention window.