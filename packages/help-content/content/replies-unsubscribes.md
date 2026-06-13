---
title: Replies, unsubscribes & what happens next
surface: review
routes: /review, /leads
---

# Replies, unsubscribes & what happens next

Every reply your outreach receives is detected and classified automatically. What happens next depends on the classification — in some cases it stops the sequence, and in others it writes to your suppression list.

## Reply classifications

| Classification | What it means |
|---|---|
| **Interested** | The prospect is open to a conversation. The sequence stops; they're flagged for follow-up. |
| **Not interested** | They've declined. The sequence stops and they're added to your suppression list — they won't be contacted again on any channel. |
| **Neutral** | A reply that doesn't signal interest or disinterest (e.g. a question). The sequence stops so you can respond personally. |
| **Out of office** | An automated away message. The sequence continues as scheduled — the prospect hasn't replied themselves. |
| **Unsubscribe** | They've asked to stop receiving messages. The sequence stops immediately and they're added to suppression. |
| **Other** | Anything that doesn't fit the above (e.g. a bounced delivery notice, a referral to someone else). Reviewed case by case. |

## How the sequence stops

When a real reply is received (anything except out of office), any remaining drafts for that prospect that are still in the queue are pulled automatically. Nothing else goes out to them unless you re-engage manually.

## Automatic suppression

Some events write to your suppression list without any action from you:

- A reply classified as **Not interested**
- An **Unsubscribe** request (via reply or the one-click link in email footers)
- A hard **email bounce**
- A **spam complaint** — this also pauses the affected sending mailbox so you can review it

Suppression entries are permanent. Once someone is on the list, they won't be drafted or sent to again on any channel, regardless of which campaign or agent is running.

## LinkedIn: invite → follow-up flow

LinkedIn outreach is two steps. First, a short connection note (invite) goes out. The personalized follow-up message is only sent after the prospect accepts the connection. If an invite goes unanswered for 30 days, it's automatically withdrawn and no follow-up is sent.

## Unsubscribe links in email

Every cold email contains a one-click unsubscribe link and your workspace's physical sender address. Clicking unsubscribe takes effect immediately — no confirmation page, no login required. The contact is suppressed across all current and future campaigns for your workspace.
