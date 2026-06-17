---
title: Setting up your sending channels
surface: settings
routes: /settings/channels, /settings
---

# Setting up your sending channels

The Channels page is where you configure everything that touches outbound messaging: your physical sender address, email sending infrastructure, and LinkedIn account. Set these up before you deploy an Outreach Agent — outreach won't start until the required pieces are in place.

## Channel readiness at a glance

At the top of the page, a readiness summary shows how many of your two channels (LinkedIn and email) are live right now, with a progress bar toward "ready to send". Each channel shows its own state — LinkedIn as **Active** or **Not connected**, and email as **Ready**, **Warming** (with an estimate of how many days until it can send), or **Not set up**. You only need one channel live for your agents to start reaching out, so this is the fastest way to confirm outreach can begin.

## Sender name

Go to **Settings → Channels → Email sending** and enter your **Sender name** — this is the name your cold emails are signed with (for example, your first name). It personalises the sign-off in outgoing emails. Leave the field blank to omit the name from the sign-off.

## Sender address (required for email)

Every cold email must include a physical mailing address in the footer. This is a legal requirement, not optional. Go to **Settings → Channels** and enter your workspace's sender address. Until it's saved, email outreach will not send.

## Email sending

When you set up email sending, dedicated sending domains and mailboxes are provisioned for your workspace — you don't need to configure anything externally. After provisioning, each new mailbox goes through a **warm-up period of 2–4 weeks** while it builds sender reputation on the network.

During warm-up, a mailbox shows the status **"Warming up — building sender reputation"**. Warming mailboxes never carry campaign email — they are kept separate until they're ready. Once a mailbox reaches **Ready**, it joins the sending rotation automatically.

Plan accordingly: set up email sending at least 2–4 weeks before you intend to launch your first outreach campaign.

## LinkedIn account

Connect your own existing LinkedIn account to turn on LinkedIn outreach. Click **Connect your LinkedIn account** — you'll sign in on LinkedIn's own secure page (we never see your password), then you're brought straight back to **Settings → Channels**, where your account appears as **Active**. Need more than one? Use **Connect another account** on the same card.

If you finish signing in but don't see your account listed yet, use **Refresh status** on the LinkedIn card to sync it immediately — no need to reconnect.

If your connection drops (LinkedIn sessions expire periodically), return to this page and reconnect. A disconnected account pauses LinkedIn outreach for your workspace; reconnecting resumes it.

## Pause all sending

The **Pause all sending** toggle instantly stops every outbound email and LinkedIn action for your entire workspace. Use it if you need to step back — for example, while updating your ICP or reviewing a large batch of drafts. Toggling it back on resumes the queue from where it left off.
