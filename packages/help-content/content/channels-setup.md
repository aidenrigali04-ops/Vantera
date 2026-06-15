---
title: Setting up your sending channels
surface: settings
routes: /settings/channels, /settings
---

# Setting up your sending channels

The Channels page is where you configure everything that touches outbound messaging: your physical sender address, email sending infrastructure, and LinkedIn account. Set these up before you deploy an Outreach Agent — outreach won't start until the required pieces are in place.

## Sender address (required for email)

Every cold email must include a physical mailing address in the footer. This is a legal requirement, not optional. Go to **Settings → Channels** and enter your workspace's sender address. Until it's saved, email outreach will not send.

## Email sending

When you set up email sending, dedicated sending domains and mailboxes are provisioned for your workspace — you don't need to configure anything externally. After provisioning, each new mailbox goes through a **warm-up period of 2–4 weeks** while it builds sender reputation on the network.

During warm-up, a mailbox shows the status **"Warming up — building sender reputation"**. Warming mailboxes never carry campaign email — they are kept separate until they're ready. Once a mailbox reaches **Ready**, it joins the sending rotation automatically.

Plan accordingly: set up email sending at least 2–4 weeks before you intend to launch your first outreach campaign.

## LinkedIn account

Connect your own existing LinkedIn account to turn on LinkedIn outreach. Click **Connect your LinkedIn account** — you'll sign in on LinkedIn's own secure page (we never see your password), then you're brought straight back to **Settings → Channels**. Your account first shows as **Connecting** and flips to **Active** within a moment once it's confirmed. Need more than one? Use **Connect another account** on the same card.

If your connection drops (LinkedIn sessions expire periodically), return to this page and reconnect. A disconnected account pauses LinkedIn outreach for your workspace; reconnecting resumes it.

## Pause all sending

The **Pause all sending** toggle instantly stops every outbound email and LinkedIn action for your entire workspace. Use it if you need to step back — for example, while updating your ICP or reviewing a large batch of drafts. Toggling it back on resumes the queue from where it left off.
