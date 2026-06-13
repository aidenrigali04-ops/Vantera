---
title: Your AI Caller Agent
surface: agents
routes: /agents, /agents/new/caller, /agents/caller
---

# Your AI Caller Agent

The AI Caller Agent places voice calls to qualified leads on your behalf — working through your pipeline to book meetings with the people most likely to say yes. It calls leads who have already been scored and validated by your Prospect Agent, so every call is grounded in real context about the person and their situation.

## Before you set it up

The Caller Agent requires a deployed Prospect Agent. It inherits that agent's ideal customer profiles and targets the same leads — you never re-enter targeting, and any changes you make to the Scout agent automatically flow through here.

Only leads who score at or above your scoring threshold and have a validated phone number will ever receive a call.

## Setting it up

1. **Name your agent** — its identity on call briefs and the agent card.
2. **Targeting** — inherited from your Prospect Agent, shown read-only. To change who gets called, update the Scout.
3. **Goal & booking link** — the one outcome each call aims for (e.g. "book a 20-minute discovery call") and the booking page link your agent shares with interested leads.
4. **Voice & identity** — set the agent's spoken name and persona. The name it introduces itself with, the tone it uses, and how it represents your company.
5. **Add content** — optional links, case studies, or notes the agent can draw on. The richer the context, the more relevant each conversation.
6. **Calling window** — set the hours and days your agent is allowed to dial. Calls only go out inside this window, timed to the prospect's local timezone.
7. **Deploy** — your agent goes live and begins drafting call briefs as leads qualify.

## How calling works

For every lead that qualifies, the agent drafts a **call brief** — a per-lead summary of who the person is, what their pain points are, and how the conversation should go. The call brief waits in your review queue before any call is placed. You review it, approve it, and only then does the call go out.

Calls are placed by our voice system, which handles the conversation in real time based on the brief and the content you've provided. The agent listens, adapts, and steers toward your stated goal.

## Calling window and timing

Every call is placed within the calling window you set, using the prospect's local time — your agent never dials someone outside their local business hours. If a lead qualifies outside the window, the brief queues and waits until the window opens.

## Call outcomes

Each call is classified into one of the following outcomes:

- **Booked** — the lead agreed to a meeting; a calendar link was shared.
- **Callback** — the lead asked to be called back at a specific time; the agent reschedules automatically.
- **Not interested** — the lead declined. The number is added to your suppression list and will not be called again.
- **No answer** — no one picked up. The agent may retry within your calling window based on your retry settings.
- **Voicemail** — a message was left if voicemail was detected.
- **Do not call** — the lead explicitly asked not to be contacted. The number is immediately added to your suppression list and no further contact is made.

"Not interested" and "do not call" outcomes write to suppression automatically — no manual action required.

## Recording and disclosure

Where required, calls may be recorded. When recording is active, our voice system delivers a spoken disclosure at the start of the call so the lead is informed before the conversation begins.

## Nothing calls without you

Every call brief lands in your review queue as **pending review**. The calling system does not place a single call until you approve the brief. Anyone on your suppression list is excluded before a brief is even drafted.
