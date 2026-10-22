---
title: Connecting your scheduling tool (Calendly or Cal.com)
surface: settings
routes: /settings/integrations, /meetings, /prospects
---

# Connecting your scheduling tool

Connect the tool behind your booking link and every meeting a prospect books through it is detected automatically, matched to the right prospect, and counted — no marking meetings by hand.

## How to connect

Open **Settings → Integrations → Scheduling** and paste an API key:

- **Calendly** — in Calendly, go to Integrations → API & Webhooks and create a personal access token with the **users:read**, **webhooks:write**, and **scheduled_events:read** permissions. Booking notifications need a paid Calendly plan (Standard or higher).
- **Cal.com** — in Cal.com, go to Settings → Security → API keys and create a key.

Only workspace admins can connect or disconnect. Your key is stored encrypted and is never shown again.

## What happens when someone books

- When your agent shares your booking link in a conversation, the link carries a private marker for that prospect, so the booking is matched to them exactly — even when we don't have their email. If the marker is missing, we match by the email they booked with.
- The prospect is marked **Meeting booked — booked through your scheduling link**, and all outreach to them stops right away.
- If they reschedule, the meeting moves with them. If they cancel, the meeting is cleared.
- Bookings from people who aren't your prospects are ignored and never stored.

Booked meetings also teach your agent who converts, so it gets better at finding people like them.

## Disconnecting

Use **Disconnect** on the tool's card. We remove the booking notification from your scheduling tool and delete the stored key.
