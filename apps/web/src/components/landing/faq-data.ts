/**
 * Single source for the FAQ — rendered by the FAQ accordion (homepage + the /faq page) AND
 * emitted as FAQPage JSON-LD. They MUST stay identical (Google requires structured FAQ data to
 * match the visible answer text), so every surface reads from here.
 *
 * Static on purpose: a client component imports this file, so it can't read prices from
 * @vantera/billing (which pulls in the Stripe SDK). faq-data.test.ts holds the cost answer
 * to the billing display data instead.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Vantera?",
    a: "Vantera is LinkedIn automation that runs on autopilot. SDR agents find in-market buyers, qualify them against your ICP, write and send a tailored message to each, and carry the conversation through to a booked call or a closed lead pushed to your CRM. Machine learning studies who replies and who books, so your targeting sharpens every week. Setup takes about 3 minutes, and the whole system optimizes for quality over volume: fewer, sharper conversations instead of a wall of ignored invites.",
  },
  {
    q: "How does Vantera keep my LinkedIn account safe?",
    a: "Account safety is enforced in the scheduler, not left to you to configure. New accounts ramp up gradually, invites stay under a hard weekly ceiling, and every action fires with randomized, human-like pacing so nothing looks automated. When you connect more than one sender, volume is distributed across them so no single account is ever pushed past a safe threshold — limits that can't be raised below the safe line.",
  },
  {
    q: "Do I have to approve every message?",
    a: "No. Vantera runs on autopilot: agents write each message from the prospect's real activity and send it at a safe, human pace inside your account's limits. You set the goal and the audience once, machine learning keeps refining who gets messaged, and you can pause an agent or step into any conversation whenever you like.",
  },
  {
    q: "How does it find in-market buyers?",
    a: "Two things run together: ICP-fit discovery matches people to your ideal customer profile, and LinkedIn intent signals surface who's actually showing in-market behavior — the topics they engage with, the problems they post about, and company triggers that point to real need. Every prospect is then scored on fit, seniority, and intent, and only the ones clearing 70 or above enter outreach. Intent is a second filter on top of fit, never a shortcut around it, and machine learning sharpens both as it learns who replies and who books.",
  },
  {
    q: "What is multi-sender distribution?",
    a: "It's how Vantera spreads outreach volume across every LinkedIn sender you connect instead of hammering a single account. Each connected account works within its own safe daily and weekly limits, so your team reaches more of the right people without any one profile carrying risky volume. More senders means more safe reach — never more risk per account.",
  },
  {
    q: "Does it sync with my CRM?",
    a: "Yes. Closed and qualified leads are pushed straight into your CRM, with native connections for HubSpot, Salesforce, and GoHighLevel (and win alerts in Slack or monday.com) so your pipeline stays current without manual data entry. Vantera isn't a CRM itself — it does the finding, qualifying, and outreach, then hands the won conversations to the system your team already runs on.",
  },
  {
    q: "How fast will I see results?",
    a: "Setup takes about 3 minutes, and because agents go to work the moment they're deployed, most customers see their first replies within the first week. Early volume ramps deliberately to keep your account safe, so momentum builds over the first few weeks rather than spiking on day one. Since every message targets qualified, in-market people, the replies you get are conversations worth having — not noise.",
  },
  {
    q: "How much does it cost?",
    a: "All Access is $79/month after a free 7-day trial, and it includes everything Vantera does: the agents, machine-learned targeting, and account-safe outreach across your LinkedIn senders. For teams that need more senders, seats, and volume, our Custom plan is priced to your goals — talk to us and we'll scope it with you. There's no long-term contract, so you can change or cancel anytime.",
  },
];
