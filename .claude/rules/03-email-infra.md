# Email outreach infrastructure — RETIRED (LinkedIn-only rescope, 2026-06-20)

> **This rule is retired.** Email was removed as a send channel: the `email-infra` package is deleted, mailbox provisioning/warmup/sending is gone, and outreach is LinkedIn-only (rule 04). The `mailboxes` table stays dormant for historical reads (no destructive migration). Transactional email (auth/notifications via Resend) is unrelated and stays — see `packages/transactional-email`. The text below is kept only as a record of the removed design.

---

Vantera provisions sending domains + mailboxes per customer — fully in-platform, users never leave to set anything up. Implementation: **Smartlead API** (SmartSenders provisioning, warmup network, inbox rotation, reply webhooks), white-labeled so users never see Smartlead. All of Vantera's code talks only to a Vantera-owned `email-infra` interface (provision / send / warmup-status / replies) so the provider is swappable later (e.g. to owned raw infra) without touching product code. Building raw deliverability infra in-house was evaluated and rejected for now: warmup is time-gated (2–4 weeks) and requires an inbox network no greenfield build can replicate.