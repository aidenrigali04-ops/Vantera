/**
 * Blog content — typed source of truth for /blog and /blog/[slug]. Content is a list of typed
 * blocks (not raw HTML/MDX) so it renders to clean, semantic, SEO-friendly markup with the
 * landing typography. Voice follows the copy guard: position as LinkedIn automation, lead with
 * quality / control / safety, never volume; honest, no vendor names.
 */

export type Block =
  | { t: "p"; text: string }
  | { t: "h2"; text: string }
  | { t: "h3"; text: string }
  | { t: "ul"; items: string[] }
  | { t: "ol"; items: string[] }
  | { t: "quote"; text: string };

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description + listing-card excerpt (~150 chars). */
  description: string;
  category: string;
  /** ISO date. */
  date: string;
  updated?: string;
  readingMinutes: number;
  keywords: string[];
  body: Block[];
}

export const BLOG_AUTHOR = "Vantera Team";

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "is-linkedin-automation-safe",
    title: "Is LinkedIn Automation Safe? How to Automate Outreach Without Getting Restricted",
    description:
      "LinkedIn automation is safe when it respects limits and paces like a human. Here's what actually gets accounts restricted — and how to avoid it.",
    category: "Safety",
    date: "2026-06-20",
    readingMinutes: 6,
    keywords: ["is linkedin automation safe", "linkedin automation safety", "linkedin account restriction"],
    body: [
      { t: "p", text: "It's the first question every serious operator asks, and the right one: if you automate LinkedIn outreach, will you lose the account you've spent years building? The honest answer is that automation itself isn't what gets accounts restricted — reckless volume and obviously robotic behavior do. Done correctly, automation is safer than a human rushing through 80 manual invites before lunch." },
      { t: "h2", text: "What actually gets a LinkedIn account restricted" },
      { t: "p", text: "LinkedIn's protections are tuned to spot inhuman patterns, not the mere presence of a tool. The accounts that get warned, restricted, or banned almost always share the same handful of mistakes:" },
      { t: "ul", items: [
        "Volume spikes — going from a few invites a day to hundreds overnight.",
        "Brand-new accounts blasting connection requests with no history or warm-up.",
        "Machine-gun pacing — sends fired on the second, with no natural gaps.",
        "High ignore/withdraw rates from spraying people who were never a fit.",
        "Personalized invite notes at scale, which LinkedIn caps hard on free accounts.",
      ] },
      { t: "h2", text: "What safe automation actually looks like" },
      { t: "p", text: "Safe automation isn't about doing less — it's about doing it like a careful human would. The non-negotiables:" },
      { t: "ul", items: [
        "Hard daily and weekly ceilings that you can't push past, no matter how aggressive you want to be.",
        "Human-like pacing with randomized gaps, so sends never look metronomic.",
        "A ramp for newer accounts that starts small and builds trust over weeks.",
        "Spreading volume across multiple connected senders instead of overloading one.",
        "Targeting only qualified people, so acceptance stays high and ignores stay low.",
      ] },
      { t: "h2", text: "Volume is the enemy, not automation" },
      { t: "p", text: "Most 'LinkedIn got me restricted' stories are really volume stories. The tool that lets you send 500 invites a day is not a feature — it's a liability. The number that protects your account is the one you can't exceed. This is why quality-first outreach is also the safest outreach: when every message goes to someone who actually fits and is likely to reply, you stay far under the thresholds that trigger review." },
      { t: "quote", text: "The single best account-safety decision is to send fewer, better messages — to people who were going to be interested anyway." },
      { t: "h2", text: "How Vantera keeps your account safe by design" },
      { t: "p", text: "Vantera treats account safety as compliance, not a setting. Limits live in the scheduler and are non-configurable below the safe threshold — you cannot turn them off. Outreach paces like a human, ramps new accounts gradually, and spreads across your connected senders so no single account is ever overloaded. And because every prospect is qualified against your ICP and real buying intent before anyone is contacted, you're not spraying strangers — you're reaching people who were already in-market." },
      { t: "p", text: "That's the difference between automation that's a risk and automation that's an advantage: not how much it can send, but how carefully it refuses to cross the line." },
    ],
  },
  {
    slug: "best-waalaxy-alternative",
    title: "The Best Waalaxy Alternative for Quality-First LinkedIn Outreach (2026)",
    description:
      "Looking for a Waalaxy alternative that prioritizes qualified pipeline over raw volume? Here's what to look for — and how a quality-first system compares.",
    category: "Comparison",
    date: "2026-06-24",
    readingMinutes: 7,
    keywords: ["waalaxy alternative", "best linkedin automation tool", "goji berry alternative"],
    body: [
      { t: "p", text: "Tools like Waalaxy made LinkedIn automation mainstream, and that's a good thing — manual prospecting doesn't scale. But as teams mature, many start looking for an alternative for the same reason: volume-first tooling fills your pipeline with the wrong people. More sends, more sequences, more contacts — and a reply rate that quietly drops as your sender reputation and your prospects' patience wear thin." },
      { t: "h2", text: "Why teams outgrow volume-first tools" },
      { t: "p", text: "The volume model optimizes the wrong number. When the goal is 'contact more people,' you end up:" },
      { t: "ul", items: [
        "Reaching prospects who never fit your ICP, dragging acceptance and reply rates down.",
        "Managing sequence sprawl instead of conversations that actually move toward revenue.",
        "Pushing your account closer to safety limits to hit arbitrary contact targets.",
        "Writing 'personalized' templates with merge tags that everyone can tell are templates.",
      ] },
      { t: "h2", text: "Quality-first vs volume-first" },
      { t: "p", text: "A quality-first system inverts the model. Instead of asking 'how many people can we contact,' it asks 'who is actually in-market right now, and what should we say to them.' Fewer, sharper conversations beat thousands of ignored invites — for your pipeline and for your account health." },
      { t: "h2", text: "What to look for in a Waalaxy alternative" },
      { t: "ul", items: [
        "Real qualification: ICP fit plus genuine buying-intent signals, not just a job-title filter.",
        "Personalization from real activity — messages grounded in what a prospect actually posts and engages with, not {{first_name}} swaps.",
        "Account safety built into the scheduler, non-configurable below safe thresholds.",
        "Human-in-the-loop control: you approve every message before it sends.",
        "A clean path from reply to closed, including pushing won deals to your CRM.",
      ] },
      { t: "h2", text: "How Vantera compares" },
      { t: "p", text: "Vantera is built quality-first from the ground up. Its agents identify people showing real intent on LinkedIn, qualify them against your ICP, and draft a message for each one grounded in their actual activity — then queue it for your approval. Nothing sends automatically, pacing stays under hard safety ceilings, and the whole system is focused on LinkedIn rather than spraying across five channels at once." },
      { t: "p", text: "If you're happy maximizing send count, a volume tool is fine. If you want qualified conversations that turn into revenue — without risking the account they run on — that's the gap a quality-first alternative is meant to close." },
    ],
  },
  {
    slug: "how-to-find-in-market-buyers-on-linkedin",
    title: "How to Find In-Market Buyers on LinkedIn",
    description:
      "Most LinkedIn outreach fails because it targets the wrong people. Here's how to find buyers who are actually in-market — using ICP fit and intent signals.",
    category: "Playbook",
    date: "2026-06-26",
    readingMinutes: 6,
    keywords: ["find buyers on linkedin", "linkedin intent signals", "in-market buyers"],
    body: [
      { t: "p", text: "The hardest part of LinkedIn outreach isn't the message — it's the list. Reach out to the wrong people and even a perfect message gets ignored. Reach out to someone already feeling the problem you solve, and an average message gets a reply. The whole game is finding people who are in-market right now." },
      { t: "h2", text: "What 'in-market' actually means" },
      { t: "p", text: "In-market doesn't mean 'matches your ideal title.' It means someone is actively experiencing the problem you solve and is open to a solution — today, not someday. A VP of Sales who fits your ICP perfectly but has no current pain is a worse prospect than a slightly-off-ICP manager who just posted about the exact problem you fix." },
      { t: "h2", text: "The signals that reveal buying intent" },
      { t: "p", text: "Intent shows up as behavior. On LinkedIn, the strongest tells are:" },
      { t: "ul", items: [
        "Posting about the problem — frustration, a question, or a 'how do you all handle this' thread.",
        "Engaging with content in your space — commenting on competitors, tools, or thought leaders.",
        "Company triggers — new funding, a relevant exec hire, a tech change, or fast headcount growth.",
        "Following or interacting with the categories adjacent to what you sell.",
      ] },
      { t: "h2", text: "ICP fit + intent: the two-filter approach" },
      { t: "p", text: "Neither filter works alone. Intent without fit gets you enthusiastic people who can't buy. Fit without intent gets you perfect-on-paper prospects who aren't ready. The buyers worth your time clear both bars: they match your ICP and they're showing a real, recent reason to care." },
      { t: "quote", text: "Intent is a second filter, never a bypass. The goal isn't more people — it's the right people at the right moment." },
      { t: "h2", text: "Turning signals into conversations" },
      { t: "p", text: "Once you've found someone who fits and is in-market, the message writes itself — because you have a real reason to reach out. Reference the post they wrote, the problem they're clearly feeling, the trigger at their company. Skip the template. A short, specific, human note that proves you actually understand their moment will out-convert a thousand generic invites." },
      { t: "p", text: "This is exactly the workflow Vantera automates: it watches LinkedIn for in-market behavior, scores each person on ICP fit and intent, and drafts a message grounded in their real activity — so you spend your time approving good conversations instead of building lists." },
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

export function formatPostDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
