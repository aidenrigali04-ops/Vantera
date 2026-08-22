---
title: Connecting a CRM and pushing closed deals
surface: settings
routes: /settings/integrations, /settings
---

# CRM & integrations

When a deal closes in Vantera, the won customer can land automatically in the tool your team already lives in — no copy-paste, no export. Connect a destination once under **Settings → CRM & integrations**.

## What you can connect

- **HubSpot, Salesforce, GoHighLevel** — Vantera creates the contact and a won deal in your pipeline.
- **Slack, Monday** — Vantera posts a "deal closed" message to a channel, or creates an item on a board.

## Connecting a destination

1. Click **Connect** on the destination you want.
2. Authorize Vantera in the window that opens. We hold the connection securely and keep it refreshed — you never paste an API key.
3. Once connected, choose where deals should land (the pipeline + won stage for a CRM, the channel for Slack, or the board for Monday).

## Field mapping

For CRM destinations, Vantera pre-fills sensible field mappings (name, company, email, deal value). You can adjust any of them. Email is fixed — it's how we match an existing contact instead of creating a duplicate.

## Auto-push vs. manual

Each connection has a **Push automatically on close** toggle. Leave it on and every closed-won deal flows through the moment you mark it closed. Turn it off to push deals on demand instead.

## Activity sync (HubSpot)

For HubSpot, you can go further than closed deals: **Log LinkedIn activity to the contact timeline** writes your touches — outreach sent, replies received, meetings booked — as notes on the HubSpot contact as they happen, so your CRM shows the whole conversation, not just the win.

- **Opt-in and forward-only.** Sync starts the moment you turn it on. Vantera never imports history into your CRM, and turning it off and back on does not back-fill the gap.
- **The contact is created early.** With activity sync on, the HubSpot contact is created at the first synced touch — before the deal closes. If you prefer contacts to appear only when deals close, leave activity sync off; closed-won pushing works either way.
- **Choose what syncs.** Three checkboxes — outreach sent, replies received, meetings booked — control which touches are logged.
- **One contact per prospect.** Vantera remembers which HubSpot contact belongs to each prospect, so repeat touches never create duplicates.
- Connected HubSpot before activity sync existed? **Reconnect once** to grant the updated permissions if syncing reports an authorization error.

Closed-won pushes also carry a short **journey note** onto the contact — the fit score, the "why now" buying signal, and whether the prospect came from LinkedIn buying intent — so your team sees why the deal happened, right in the CRM.

## Connection health

Each connected destination shows its status and when it was last checked. If a connection needs attention (for example, access was revoked on the provider's side), it's flagged here — reconnect to restore the push.

## Marking a deal closed-won

Open a prospect and use **Mark closed-won** (with the deal value) under *Deal & CRM*. This sets the prospect to converted and — if a destination has **auto-push** on — sends it to your CRM right away. The deal value also feeds the Revenue snapshot on your dashboard.

## Pushing on demand

For a deal that's already closed-won, **Push to CRM** sends (or re-sends) it to every connected destination. Use it if a push failed, if you connected a CRM after the deal closed, or to re-sync. Each push is retried automatically with backoff if the destination is briefly unavailable.

## When a push fails

If a destination rejects a push or its access was revoked, the connection is flagged **Needs attention** on the integrations page with the reason. Reconnect to restore pushing — queued deals retry automatically once the connection is healthy.

## Disconnecting

**Disconnect** removes the connection and stops all pushes to that destination. Your closed deals stay in Vantera; you can reconnect any time.
