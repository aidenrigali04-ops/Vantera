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

## Connection health

Each connected destination shows its status and when it was last checked. If a connection needs attention (for example, access was revoked on the provider's side), it's flagged here — reconnect to restore the push.

## Disconnecting

**Disconnect** removes the connection and stops all pushes to that destination. Your closed deals stay in Vantera; you can reconnect any time.
