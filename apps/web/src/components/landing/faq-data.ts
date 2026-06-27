/**
 * Single source for the landing FAQ — rendered by the FAQ accordion AND emitted as FAQPage
 * JSON-LD on the homepage. They MUST stay identical (Google requires structured FAQ data to
 * match the visible answer text), so both read from here.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "How does Vantera find the right leads?",
    a: "It combines ICP-fit discovery with LinkedIn intent signals — the topics people engage with, the problems they post about, and company triggers that show a real need — then scores every prospect on fit, seniority, and intent. Only the ones that clear the bar are ever pursued.",
  },
  {
    q: "Will this get my LinkedIn account restricted?",
    a: "No. Outreach paces like a human, spreads across your connected senders, and stays under hard safety ceilings you can't override below the safe threshold. Protecting your account is built into the scheduler, not left to chance.",
  },
  {
    q: "Do messages send automatically?",
    a: "Never without you. Agents draft a personal message for each qualified lead and queue it in your review. You approve, edit, or skip — nothing goes out until you sign off.",
  },
  {
    q: "Is it just spammy templates?",
    a: "The opposite. Every message is written from the prospect's real activity and grounded in genuine signals — no {{variables}}, no copy-paste. A humanizer check blocks anything that reads templated before it reaches your queue.",
  },
  {
    q: "Can I change or cancel my plan anytime?",
    a: "Yes. Upgrade, downgrade, or cancel whenever — plans scale with your revenue goal, not a long-term contract, and add-ons adjust per unit from billing.",
  },
];
