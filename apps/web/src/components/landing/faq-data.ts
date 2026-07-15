/**
 * Single source for the FAQ — rendered by the FAQ accordion (homepage + the /faq page) AND
 * emitted as FAQPage JSON-LD. They MUST stay identical (Google requires structured FAQ data to
 * match the visible answer text), so every surface reads from here.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Vantera?",
    a: "Vantera is LinkedIn automation run by SDR agents that find in-market buyers, qualify them against your ICP, and draft a tailored message for each — then hand the conversation through to a booked call or a closed lead pushed to your CRM. It's your LinkedIn, run the way you'd run it yourself, without the manual hours. The whole system optimizes for quality over volume, so you have fewer, sharper conversations instead of a wall of ignored invites.",
  },
  {
    q: "How does Vantera keep my LinkedIn account safe?",
    a: "Account safety is enforced in the scheduler, not left to you to configure. New accounts ramp up gradually, invites stay under a hard weekly ceiling, and every action fires with randomized, human-like pacing so nothing looks automated. When you connect more than one sender, volume is distributed across them so no single account is ever pushed past a safe threshold — limits that can't be raised below the safe line.",
  },
  {
    q: "Do I approve messages before they send?",
    a: "Yes — human-in-the-loop review is the default. Agents draft a personal message for each qualified lead and queue it for you to approve, edit, or skip; nothing leaves your account until you sign off. When you're ready to move faster, you can switch an agent to full-auto and it will send clean drafts on its own, routing anything that looks off back to your review.",
  },
  {
    q: "How does it find in-market buyers?",
    a: "Two things run together: ICP-fit discovery matches people to your ideal customer profile, and LinkedIn intent signals surface who's actually showing in-market behavior — the topics they engage with, the problems they post about, and company triggers that point to real need. Every prospect is then scored on fit, seniority, and intent, and only the ones clearing 70 or above enter outreach. Intent is a second filter on top of fit, never a shortcut around it.",
  },
  {
    q: "What is multi-sender distribution?",
    a: "It's how Vantera spreads outreach volume across every LinkedIn sender you connect instead of hammering a single account. Each connected account works within its own safe daily and weekly limits, so your team reaches more of the right people without any one profile carrying risky volume. More senders means more safe reach — never more risk per account.",
  },
  {
    q: "Does it sync with my CRM?",
    a: "Yes. Closed and qualified leads are pushed straight into your CRM, with native connections for HubSpot, Salesforce, and more so your pipeline stays current without manual data entry. Vantera isn't a CRM itself — it does the finding, qualifying, and outreach, then hands the won conversations to the system your team already runs on.",
  },
  {
    q: "How fast will I see results?",
    a: "Because agents go to work the moment they're deployed, most customers see their first replies within the first week. Early volume ramps deliberately to keep your account safe, so momentum builds over the first few weeks rather than spiking on day one. Since every message targets qualified, in-market people, the replies you get are conversations worth having — not noise.",
  },
  {
    q: "How much does it cost?",
    a: "One plan, everything included: All Access is $79/month — all three agents (Prospect, Outreach, Intent), Vera's self-optimizing engine, the unified inbox, meetings, and CRM push. Enterprise is custom for teams that need more volume, senders, or seats — book a meeting. Annual billing saves two months, there's no long-term contract, and you can change or cancel anytime.",
  },
];
