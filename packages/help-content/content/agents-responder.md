---
title: Your Inbound Responder Agent
surface: agents
routes: /agents, /agents/new/responder, /agents/responder
---

# Your Inbound Responder Agent

The Responder Agent answers inbound leads the moment they arrive. When someone fills out a form on your site, lands on a high-intent page, or trips a buying signal, the Responder qualifies them and drafts a reply in minutes — not days. Speed is the whole point: most inbound interest goes cold within the hour, and a fast, relevant reply is the single biggest lever on whether it turns into a meeting.

It is not a blast tool. Every inbound lead is scored against the same quality bar your Prospect Agent uses, so a fast response never means answering everyone — only the leads worth your team's time get a reply.

## Before you set it up

The Responder requires a deployed Prospect Agent. It inherits that agent's ideal customer profiles and qualifies inbound leads against the same threshold — you never re-enter targeting. To change who qualifies, edit the Prospect Agent and the change flows through automatically.

## Setting it up

1. **Name your agent** — its identity on the agent card and inbound activity.
2. **Targeting** — inherited from your Prospect Agent, shown read-only.
3. **Goal** — the one thing a reply should invite the prospect to do (for example, "book a 15-minute intro call").
4. **Sources** — which inbound events to answer: form fills, website visitors, or buying signals. Enable at least one.
5. **Deploy** — choose how it responds and go live.

When you deploy, you get a **webhook URL** and a **signing secret**. Point your form provider or site at the URL and have it sign each request. The signing secret is shown only once — save it then. If you lose it, redeploy to roll a new one. You can always find the webhook URL again on the agent's page.

## How it responds

- **Review every reply** (recommended) — the agent qualifies the lead and drafts a reply, then holds it in your review queue. Nothing sends until you approve it.
- **Respond automatically** — a clean, well-grounded reply sends within your response-time goal. Anything that trips a quality flag still waits for you in the review queue.

Either way, the reply is written from real context about the lead, and a draft that makes an unsupported claim is never sent automatically — it routes to review instead.

## What happens to each inbound lead

Every inbound lead is logged on the agent's page with its outcome:

- **Responded** — qualified and answered (sent or queued, per your mode).
- **In review** — drafted and waiting for your approval.
- **Rejected** — did not clear the quality bar, so no reply was sent.
- **Suppressed** — the contact is on your suppression list, so it was never contacted.

## Connecting your form

Have your form provider POST the lead to your webhook URL as JSON (email, name, and company are all it needs) and sign the raw request body with HMAC-SHA256 using your signing secret, sent as the `X-Vantera-Signature: sha256=…` header. Requests without a valid signature are rejected. Sending a stable event id with each submission lets us safely ignore duplicate deliveries.

## Pausing

Pause the Responder anytime from the Agents page. While paused, inbound leads stop being answered; resume and it picks back up immediately.
