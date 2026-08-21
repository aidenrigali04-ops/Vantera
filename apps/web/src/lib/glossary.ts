/**
 * Glossary data — the seeded, accurate term library behind /glossary and /glossary/[slug].
 * This is a CURATED set (not "hundreds") written to be correct and citable; the model is
 * built to scale — adding a term is one entry here. Directory-level fields (summary,
 * difficulty, readingTime, popularity, updated, related) render on cards; the richer fields
 * (whyItMatters, howItWorks, mistakes, bestPractices, faqs, …) render on the detail page,
 * each section shown only when present.
 */

export type Difficulty = "Beginner" | "Intermediate" | "Advanced";

export type CategoryKey =
  | "linkedin"
  | "sales"
  | "cold-outreach"
  | "seo"
  | "ai-search"
  | "digital-marketing";

export interface GlossaryCategory {
  key: CategoryKey;
  label: string;
  tagline: string;
}

export interface GlossaryFaq {
  q: string;
  a: string;
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  /** Search synonyms / expansions (also indexed by the command palette). */
  aka?: string[];
  category: CategoryKey;
  difficulty: Difficulty;
  /** Estimated reading time for the detail page, minutes. */
  readingTime: number;
  /** 0–100 editorial popularity score (drives sort + trending). */
  popularity: number;
  /** ISO date the entry was last reviewed. */
  updated: string;
  /** One-line definition for cards + search results. */
  summary: string;
  /** 2–4 sentence definition for the detail hero. */
  definition: string;
  whyItMatters?: string;
  howItWorks?: string[];
  mistakes?: string[];
  bestPractices?: string[];
  tools?: string[];
  faqs?: GlossaryFaq[];
  furtherReading?: { label: string; href: string }[];
  /** Slugs of related terms (topic-cluster internal linking). */
  related: string[];
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  { key: "linkedin", label: "LinkedIn", tagline: "Social selling, Sales Navigator, and outreach on the platform that matters most." },
  { key: "sales", label: "Sales", tagline: "The frameworks and motions that qualify, run, and close B2B deals." },
  { key: "cold-outreach", label: "Cold Outreach", tagline: "Getting relevant messages to the right people — and into the inbox." },
  { key: "seo", label: "SEO", tagline: "Earning organic visibility through authority, structure, and relevance." },
  { key: "ai-search", label: "AI Search", tagline: "Being found and cited by AI answer engines and generative search." },
  { key: "digital-marketing", label: "Digital Marketing", tagline: "The metrics and motions of modern demand and growth." },
];

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  // ── LinkedIn ──────────────────────────────────────────────────────────────
  {
    slug: "linkedin-ssi",
    term: "LinkedIn SSI",
    aka: ["Social Selling Index", "SSI score"],
    category: "linkedin",
    difficulty: "Beginner",
    readingTime: 4,
    popularity: 82,
    updated: "2026-06-18",
    summary: "LinkedIn's 0–100 score for how effectively you use the platform to sell.",
    definition:
      "The Social Selling Index (SSI) is a LinkedIn-generated score from 0 to 100 that measures how effectively you use the platform across four dimensions: establishing your professional brand, finding the right people, engaging with insights, and building relationships. It updates daily and is often used as a directional proxy for social-selling effort.",
    whyItMatters:
      "SSI won't book meetings on its own, but the behaviors it rewards — a complete profile, targeted prospecting, useful engagement, and real relationships — are exactly the habits that make LinkedIn outreach land.",
    related: ["social-selling", "linkedin-sales-navigator", "connection-request"],
  },
  {
    slug: "social-selling",
    term: "Social Selling",
    aka: ["social selling on LinkedIn"],
    category: "linkedin",
    difficulty: "Beginner",
    readingTime: 6,
    popularity: 88,
    updated: "2026-06-22",
    summary: "Using social networks to find, connect with, and nurture buyers before pitching.",
    definition:
      "Social selling is the practice of using social networks — LinkedIn above all in B2B — to research prospects, build credibility, and start relationships through relevant interactions rather than cold pitches. Instead of interrupting strangers, you earn attention with useful content and personalized, timely outreach.",
    whyItMatters:
      "Buyers self-educate long before they talk to sales. Showing up with relevance where they already are builds the trust that turns a cold profile into a warm conversation — and it's the motion Vantera automates end to end.",
    howItWorks: [
      "Sharpen your profile so it reads as a resource, not a resume.",
      "Identify in-market, ICP-fit people using signals and search.",
      "Engage authentically with what they post before reaching out.",
      "Send a personalized message tied to their real activity — not a template.",
      "Follow up with value over multiple touches, on your prospect's timeline.",
    ],
    mistakes: [
      "Pitching in the first message instead of opening a relevant conversation.",
      "Spraying identical connection notes to everyone.",
      "Chasing volume over fit — quantity of invites over quality of targets.",
      "Ignoring account safety and getting the profile restricted.",
    ],
    bestPractices: [
      "Lead with the prospect's context (a post, a trigger, a shared problem).",
      "Qualify for fit and intent before you ever send a message.",
      "Keep pacing human and under safe limits to protect your account.",
      "Measure booked conversations, not invites sent.",
    ],
    faqs: [
      { q: "Is social selling just posting content?", a: "No. Content builds credibility, but social selling is the full motion of finding the right people, engaging relevantly, and moving relationships toward a conversation." },
      { q: "How is social selling different from cold outreach?", a: "Cold outreach reaches people with no prior relationship; social selling warms the relationship first through relevant engagement, so outreach lands better." },
    ],
    related: ["linkedin-ssi", "linkedin-sales-navigator", "connection-request", "personalization"],
  },
  {
    slug: "linkedin-sales-navigator",
    term: "LinkedIn Sales Navigator",
    aka: ["Sales Navigator", "Sales Nav"],
    category: "linkedin",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 79,
    updated: "2026-06-10",
    summary: "LinkedIn's premium prospecting tool: advanced search, lead lists, and alerts.",
    definition:
      "Sales Navigator is LinkedIn's premium prospecting product. It adds advanced search filters, saved lead and account lists, real-time alerts on buying signals, and InMail credits, letting sales teams build and monitor targeted books of business far beyond what the free experience allows.",
    whyItMatters:
      "It turns LinkedIn from a rolodex into a live prospecting surface — the filters and alerts are where in-market accounts and the right personas actually surface.",
    related: ["social-selling", "inmail", "linkedin-ssi", "connection-request"],
  },
  {
    slug: "inmail",
    term: "InMail",
    category: "linkedin",
    difficulty: "Beginner",
    readingTime: 4,
    popularity: 71,
    updated: "2026-05-28",
    summary: "LinkedIn's premium way to message members you're not connected to.",
    definition:
      "InMail is LinkedIn's premium private messaging feature that lets you contact members outside your network without a connection request. Credits are limited and partially refunded on reply, so relevance and personalization directly affect both response rate and cost-efficiency.",
    whyItMatters:
      "InMail skips the connection step, but the scarcity of credits punishes spray-and-pray — the message has to earn a reply on the first try.",
    related: ["linkedin-sales-navigator", "connection-request", "personalization"],
  },
  {
    slug: "connection-request",
    term: "Connection Request",
    aka: ["LinkedIn invite", "connection invite"],
    category: "linkedin",
    difficulty: "Beginner",
    readingTime: 3,
    popularity: 68,
    updated: "2026-06-02",
    summary: "An invitation to join someone's LinkedIn network — the door to direct messaging.",
    definition:
      "A connection request is an invitation to join another member's LinkedIn network. Once accepted, both parties can message each other directly. Acceptance rate is driven by relevance, a credible profile, and — where used — a short, personalized note. Weekly invite volume is subject to LinkedIn limits.",
    whyItMatters:
      "The connection request is the top of the LinkedIn funnel. A higher, safer acceptance rate means more conversations without pushing the account past safe limits.",
    related: ["social-selling", "linkedin-ssi", "inmail", "outreach-automation"],
  },
  {
    slug: "outreach-automation",
    term: "Outreach Automation",
    aka: ["LinkedIn automation", "automated outreach"],
    category: "linkedin",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 84,
    updated: "2026-06-25",
    summary: "Software that runs prospecting and outreach steps for you — safely, at human pace.",
    definition:
      "Outreach automation uses software to run repetitive prospecting steps — sourcing, sending connection requests and messages, and following up — on your behalf. Done responsibly, it enforces human-like pacing and safe volume limits so the account stays protected; done recklessly, it risks restrictions.",
    whyItMatters:
      "Automation is only an asset if it protects the account and preserves relevance. The winning approach automates the judgment (who to reach, what to say), not just the sending.",
    mistakes: [
      "Chasing maximum volume instead of safe, human-like pacing.",
      "Sending templated messages that ignore the prospect's context.",
      "Skipping qualification and spraying anyone who fits a title.",
    ],
    bestPractices: [
      "Keep pacing randomized and under safe weekly limits.",
      "Qualify for fit and intent before any message is drafted.",
      "Personalize from real activity, and keep a human approving sends.",
    ],
    related: ["social-selling", "connection-request", "personalization", "multi-touch-campaign"],
  },

  // ── Sales ─────────────────────────────────────────────────────────────────
  {
    slug: "bant",
    term: "BANT",
    aka: ["Budget Authority Need Timing"],
    category: "sales",
    difficulty: "Beginner",
    readingTime: 4,
    popularity: 74,
    updated: "2026-05-20",
    summary: "A lead-qualification checklist: Budget, Authority, Need, Timing.",
    definition:
      "BANT is a classic lead-qualification framework that checks whether a prospect has the Budget to buy, the Authority to decide, a genuine Need, and a Timing that fits your sales cycle. It's a fast, memorable filter for deciding which leads deserve time.",
    whyItMatters:
      "BANT keeps reps from pouring hours into deals that were never going to close — the same job a qualification gate does automatically at the top of the funnel.",
    related: ["meddic", "spin-selling", "discovery-call"],
  },
  {
    slug: "meddic",
    term: "MEDDIC",
    aka: ["MEDDPICC"],
    category: "sales",
    difficulty: "Advanced",
    readingTime: 7,
    popularity: 77,
    updated: "2026-06-14",
    summary: "An enterprise qualification method for complex, high-value deals.",
    definition:
      "MEDDIC is a sales qualification methodology for complex B2B deals, built on six elements: Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, and Champion. It forces rigor about what will actually move a deal to close in a multi-stakeholder environment.",
    whyItMatters:
      "In enterprise deals, losses usually come from a missing champion, an unengaged economic buyer, or an unclear decision process — MEDDIC surfaces those gaps early, while there's still time to fix them.",
    howItWorks: [
      "Metrics — quantify the economic impact the buyer expects.",
      "Economic buyer — identify who controls the budget and get access.",
      "Decision criteria — learn the formal and informal criteria you're judged on.",
      "Decision process — map the steps, approvals, and timeline to a signature.",
      "Identify pain — anchor to a compelling, quantified problem.",
      "Champion — develop an internal advocate who sells when you're not there.",
    ],
    mistakes: [
      "Confusing a friendly contact with a real champion who has influence.",
      "Never reaching the economic buyer until the deal stalls.",
      "Treating MEDDIC as a form to fill out instead of a discovery discipline.",
    ],
    bestPractices: [
      "Validate the champion by testing whether they'll take action for you.",
      "Tie every metric back to the buyer's own language and goals.",
      "Re-qualify continuously — the decision process changes as deals move.",
    ],
    faqs: [
      { q: "What's the difference between MEDDIC and BANT?", a: "BANT is a lightweight top-of-funnel filter; MEDDIC is a deeper methodology for navigating complex, multi-stakeholder enterprise deals through to close." },
      { q: "What does the extra 'PC' in MEDDPICC add?", a: "MEDDPICC adds Paper process (contracting/legal steps) and Competition, making the framework even more explicit about what can derail a late-stage deal." },
    ],
    related: ["bant", "spin-selling", "discovery-call", "objection-handling"],
  },
  {
    slug: "spin-selling",
    term: "SPIN Selling",
    aka: ["SPIN"],
    category: "sales",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 66,
    updated: "2026-05-12",
    summary: "A discovery questioning model: Situation, Problem, Implication, Need-payoff.",
    definition:
      "SPIN Selling is a research-backed questioning framework that structures discovery into four question types: Situation, Problem, Implication, and Need-payoff. By drawing out a problem and amplifying its cost before presenting a solution, the buyer talks themselves into the need.",
    whyItMatters:
      "It shifts selling from pitching features to uncovering value — the implication questions turn a mild problem into an urgent, fundable one.",
    related: ["discovery-call", "meddic", "objection-handling"],
  },
  {
    slug: "discovery-call",
    term: "Discovery Call",
    aka: ["discovery meeting"],
    category: "sales",
    difficulty: "Beginner",
    readingTime: 5,
    popularity: 72,
    updated: "2026-06-08",
    summary: "The early call to understand a prospect's situation, pain, and fit.",
    definition:
      "A discovery call is an early-stage sales conversation whose goal is to understand — not pitch. The rep learns the prospect's current situation, goals, pain, decision process, and fit, then decides with the buyer whether it's worth going further.",
    whyItMatters:
      "The discovery call sets up everything after it. Great discovery means tailored demos, cleaner forecasts, and fewer deals that stall because the real problem was never found.",
    related: ["spin-selling", "bant", "meddic", "objection-handling"],
  },
  {
    slug: "objection-handling",
    term: "Objection Handling",
    category: "sales",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 70,
    updated: "2026-05-30",
    summary: "Understanding and addressing a prospect's concerns to move a deal forward.",
    definition:
      "Objection handling is the skill of surfacing, understanding, and addressing a prospect's concerns — about price, timing, trust, or need — so a deal can progress. Done well, it's a diagnostic conversation, not a rebuttal contest: you validate the concern, explore what's behind it, and reframe.",
    whyItMatters:
      "Most objections are unspoken until late. Inviting them early and handling them with empathy is what separates deals that close from deals that quietly disappear.",
    related: ["discovery-call", "spin-selling", "meddic"],
  },

  // ── Cold Outreach ─────────────────────────────────────────────────────────
  {
    slug: "cold-email",
    term: "Cold Email",
    category: "cold-outreach",
    difficulty: "Beginner",
    readingTime: 6,
    popularity: 86,
    updated: "2026-06-20",
    summary: "A targeted first-touch email to a prospect you have no prior relationship with.",
    definition:
      "A cold email is an unsolicited but targeted email sent to a prospect with whom you have no prior relationship, aiming to start a relevant conversation. Its success depends on precise targeting, genuine personalization, strong deliverability, and compliance with laws like CAN-SPAM and GDPR.",
    whyItMatters:
      "Cold email scales outbound cheaply, but only if messages reach the inbox and read as relevant. Deliverability and personalization — not volume — are what separate a channel that works from one that gets flagged as spam.",
    howItWorks: [
      "Build a tightly-targeted, verified list that fits your ICP.",
      "Warm up and authenticate sending domains to protect deliverability.",
      "Write a short, relevant message anchored to the prospect's context.",
      "Sequence a few value-adding follow-ups over time.",
      "Honor unsubscribes instantly and keep list hygiene tight.",
    ],
    mistakes: [
      "Blasting a huge, unverified list and torching domain reputation.",
      "Leading with a paragraph about yourself instead of the prospect.",
      "Skipping authentication (SPF/DKIM/DMARC) and landing in spam.",
      "Ignoring compliance — no unsubscribe, no physical address.",
    ],
    bestPractices: [
      "Personalize from a real, specific detail, not a merge tag.",
      "Keep it short, one clear ask, easy to reply to.",
      "Warm up new mailboxes before sending at volume.",
      "Measure replies and positive sentiment, not just opens.",
    ],
    faqs: [
      { q: "Is cold email legal?", a: "B2B cold email is legal in many regions under rules like CAN-SPAM and legitimate-interest provisions of GDPR, provided you identify yourself honestly, don't deceive, and offer a clear way to opt out. Always check your jurisdiction." },
      { q: "Why do my cold emails land in spam?", a: "Usually a mix of a cold/un-warmed domain, missing authentication, low engagement, spammy content, or sending too much too fast. Deliverability is a reputation game." },
    ],
    related: ["deliverability", "email-warmup", "personalization", "multi-touch-campaign"],
  },
  {
    slug: "email-warmup",
    term: "Email Warmup",
    aka: ["mailbox warmup", "domain warmup"],
    category: "cold-outreach",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 73,
    updated: "2026-06-05",
    summary: "Gradually ramping a new sender's volume to build inbox reputation.",
    definition:
      "Email warmup is the process of gradually increasing a new domain or mailbox's sending volume while generating positive engagement (opens, replies, moves out of spam) to establish sender reputation with mailbox providers. It typically runs for two to four weeks before real outreach begins.",
    whyItMatters:
      "Send at volume from a cold domain and providers treat you as a spammer. Warmup is the unglamorous prerequisite that makes everything downstream actually reach the inbox.",
    related: ["deliverability", "cold-email", "multi-touch-campaign"],
  },
  {
    slug: "deliverability",
    term: "Deliverability",
    aka: ["email deliverability", "inbox placement"],
    category: "cold-outreach",
    difficulty: "Advanced",
    readingTime: 7,
    popularity: 80,
    updated: "2026-06-16",
    summary: "Whether your emails reach the inbox instead of spam or being blocked.",
    definition:
      "Deliverability is the ability of your emails to actually land in recipients' inboxes rather than the spam folder or being blocked entirely. It's driven by domain and IP reputation, authentication (SPF, DKIM, DMARC), recipient engagement, list hygiene, and content quality.",
    whyItMatters:
      "An email nobody sees can't convert. Deliverability is the invisible tax on every outbound program — teams that ignore it quietly lose most of their reach before a single reply is possible.",
    howItWorks: [
      "Authenticate your domain with SPF, DKIM, and DMARC.",
      "Warm up new domains and keep volume within reputation-safe limits.",
      "Send to verified, engaged recipients and prune dead addresses.",
      "Keep content relevant and low-spam-signal; avoid risky links.",
      "Monitor bounces, spam complaints, and inbox-placement over time.",
    ],
    mistakes: [
      "Buying lists and blasting unverified addresses.",
      "Skipping authentication records entirely.",
      "Sending identical high-volume templates that trip spam filters.",
      "Ignoring complaint and bounce rates until the domain is burned.",
    ],
    bestPractices: [
      "Treat reputation as an asset: warm up, pace, and protect it.",
      "Segment and personalize to keep engagement high.",
      "Use separate domains for outbound to isolate risk.",
      "Continuously verify lists and honor opt-outs immediately.",
    ],
    faqs: [
      { q: "What's the difference between delivery and deliverability?", a: "Delivery means the email wasn't bounced; deliverability means it actually reached the inbox rather than spam. You can have high delivery and poor deliverability." },
      { q: "How do SPF, DKIM, and DMARC help?", a: "They authenticate that your mail genuinely comes from your domain, which mailbox providers use as a core trust signal for inbox placement." },
    ],
    related: ["email-warmup", "cold-email", "personalization"],
  },
  {
    slug: "personalization",
    term: "Personalization",
    aka: ["outreach personalization"],
    category: "cold-outreach",
    difficulty: "Beginner",
    readingTime: 4,
    popularity: 81,
    updated: "2026-06-19",
    summary: "Tailoring outreach to the individual using real, specific details.",
    definition:
      "Personalization is tailoring an outreach message to the individual recipient using real, specific details — their role, company, recent activity, or a trigger event — so the message is relevant rather than generic. True personalization goes beyond a first-name merge tag to reference something only that person would recognize.",
    whyItMatters:
      "Relevance is the whole game. A message written from a prospect's real activity reads like a human wrote it, which is why it earns replies where templates get ignored.",
    related: ["cold-email", "social-selling", "outreach-automation", "multi-touch-campaign"],
  },
  {
    slug: "multi-touch-campaign",
    term: "Multi-touch Campaign",
    aka: ["sequence", "cadence"],
    category: "cold-outreach",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 69,
    updated: "2026-05-25",
    summary: "A coordinated sequence of outreach touches over time and channels.",
    definition:
      "A multi-touch campaign (or sequence/cadence) is a coordinated series of outreach touches — messages, follow-ups, and sometimes multiple channels — delivered over time. Because most replies come after several relevant contacts, sequencing systematically follows up without a rep having to remember to.",
    whyItMatters:
      "The money is in the follow-up. A single touch misses most prospects who were simply busy; a well-paced sequence catches them at the right moment without nagging.",
    related: ["cold-email", "personalization", "outreach-automation", "deliverability"],
  },

  // ── SEO ───────────────────────────────────────────────────────────────────
  {
    slug: "topical-authority",
    term: "Topical Authority",
    category: "seo",
    difficulty: "Intermediate",
    readingTime: 6,
    popularity: 78,
    updated: "2026-06-21",
    summary: "The depth and breadth of a site's coverage that signals subject expertise.",
    definition:
      "Topical authority is the degree to which a website comprehensively covers a subject, signaling expertise to search engines. It's built by publishing deep, interlinked content across a topic — a hub-and-spoke cluster — rather than isolated pages, so the site becomes a recognized authority on the theme.",
    whyItMatters:
      "Search engines increasingly reward sites that own a topic, not just a keyword. Topical authority is what lets a page rank for terms it doesn't even explicitly target — and it's exactly what a well-structured glossary builds.",
    howItWorks: [
      "Pick a core topic your business should be known for.",
      "Build a hub page and a cluster of supporting spoke pages.",
      "Interlink the cluster so relationships are explicit.",
      "Cover the topic comprehensively, including entities and subtopics.",
      "Keep it current and demonstrate real experience and expertise.",
    ],
    mistakes: [
      "Publishing shallow pages that each chase a single keyword.",
      "Never interlinking related content into a coherent cluster.",
      "Covering a topic once and letting it go stale.",
    ],
    bestPractices: [
      "Map the full topic before writing — subtopics, entities, questions.",
      "Use a hub-and-spoke architecture with strong internal links.",
      "Demonstrate first-hand experience, not rephrased competitor content.",
    ],
    faqs: [
      { q: "How is topical authority different from backlinks?", a: "Backlinks are external votes of trust; topical authority is earned by comprehensive, well-structured coverage on your own site. The two reinforce each other but aren't the same." },
      { q: "How long does topical authority take to build?", a: "It compounds over months as you publish and interlink a complete cluster and demonstrate ongoing expertise — there's no overnight switch." },
    ],
    related: ["semantic-seo", "internal-linking", "eeat", "entity-seo"],
  },
  {
    slug: "semantic-seo",
    term: "Semantic SEO",
    category: "seo",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 71,
    updated: "2026-06-11",
    summary: "Optimizing for meaning, entities, and intent rather than exact keywords.",
    definition:
      "Semantic SEO is the practice of optimizing content around meaning, relationships, and search intent rather than exact-match keywords. It aligns content with how modern search engines understand language — entities, context, and related concepts — so a page can satisfy a topic comprehensively.",
    whyItMatters:
      "Engines now interpret intent, not just strings. Writing for the concept and its related entities lets one strong page answer many queries and feeds the same understanding AI answer engines rely on.",
    related: ["topical-authority", "entity-seo", "structured-data", "eeat"],
  },
  {
    slug: "eeat",
    term: "E-E-A-T",
    aka: ["EEAT", "Experience Expertise Authoritativeness Trust"],
    category: "seo",
    difficulty: "Intermediate",
    readingTime: 6,
    popularity: 76,
    updated: "2026-06-17",
    summary: "Google's quality lens: Experience, Expertise, Authoritativeness, Trust.",
    definition:
      "E-E-A-T stands for Experience, Expertise, Authoritativeness, and Trustworthiness — the framework in Google's Search Quality Rater Guidelines used to assess content quality. It's especially important for YMYL (Your Money or Your Life) topics, where low-quality content can cause real harm.",
    whyItMatters:
      "E-E-A-T isn't a direct ranking number, but the signals it describes — real authorship, first-hand experience, citations, and trust — increasingly correlate with what ranks and what AI engines choose to cite.",
    howItWorks: [
      "Experience — show first-hand, real-world use of what you write about.",
      "Expertise — make author credentials and depth clear.",
      "Authoritativeness — earn recognition and citations from others.",
      "Trustworthiness — be accurate, transparent, and secure.",
    ],
    mistakes: [
      "Anonymous, un-bylined content on topics that demand expertise.",
      "Rephrasing competitors instead of adding real experience.",
      "Ignoring trust basics: accuracy, sourcing, and transparency.",
    ],
    bestPractices: [
      "Attribute content to real, credentialed authors.",
      "Include original data, examples, and first-hand insight.",
      "Cite reputable sources and keep facts current.",
    ],
    faqs: [
      { q: "Is E-E-A-T a ranking factor?", a: "Not a single measurable factor. It's a framework human raters use to evaluate quality; Google's systems approximate these signals in aggregate." },
      { q: "What does the extra 'E' add?", a: "The added 'Experience' emphasizes first-hand, lived experience with a topic — not just theoretical expertise — which is harder for thin, AI-spun content to fake." },
    ],
    related: ["topical-authority", "semantic-seo", "structured-data", "aeo"],
  },
  {
    slug: "structured-data",
    term: "Structured Data",
    aka: ["schema markup", "schema.org", "JSON-LD"],
    category: "seo",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 75,
    updated: "2026-06-13",
    summary: "Standardized markup that describes page content to search engines.",
    definition:
      "Structured data is standardized markup — usually schema.org vocabulary in JSON-LD — that explicitly describes a page's content to search engines: what's an article, an FAQ, a product, a breadcrumb, a defined term. It powers rich results and helps engines understand entities and relationships.",
    whyItMatters:
      "Structured data is how you speak search engines' and AI engines' native language. It's a key lever for rich snippets, clearer entity understanding, and being reliably parsed by answer engines.",
    related: ["semantic-seo", "entity-seo", "aeo", "eeat"],
  },
  {
    slug: "internal-linking",
    term: "Internal Linking",
    category: "seo",
    difficulty: "Beginner",
    readingTime: 4,
    popularity: 67,
    updated: "2026-05-22",
    summary: "Links between your own pages that spread authority and define structure.",
    definition:
      "Internal linking is the practice of linking between pages on the same website. It distributes link authority, helps search engines discover and crawl pages, and — through anchor text and structure — establishes topical relationships and hierarchy across a site.",
    whyItMatters:
      "Internal links are the connective tissue of topical authority. A well-linked cluster tells engines which pages are central and how concepts relate — and keeps readers moving deeper into your content.",
    related: ["topical-authority", "semantic-seo", "structured-data"],
  },

  // ── AI Search ─────────────────────────────────────────────────────────────
  {
    slug: "aeo",
    term: "Answer Engine Optimization (AEO)",
    aka: ["AEO", "answer engine optimization"],
    category: "ai-search",
    difficulty: "Intermediate",
    readingTime: 6,
    popularity: 90,
    updated: "2026-06-24",
    summary: "Optimizing content to be the cited answer in AI and answer engines.",
    definition:
      "Answer Engine Optimization (AEO) is the practice of structuring and writing content so it's selected as the direct answer by answer engines — Google's AI Overviews and featured snippets, voice assistants, and chat-based search. It favors concise, clearly-structured, authoritative answers that a machine can lift and cite.",
    whyItMatters:
      "Search is shifting from ten blue links to a single synthesized answer. AEO is how you stay visible when the engine answers the question directly — by being the source it quotes.",
    howItWorks: [
      "Answer the question directly and early, in plain language.",
      "Structure content with clear headings, lists, and definitions.",
      "Add FAQ and other structured data so answers are machine-readable.",
      "Demonstrate authority and keep facts accurate and current.",
      "Cover the topic comprehensively so you're the best single source.",
    ],
    mistakes: [
      "Burying the answer under preamble and fluff.",
      "Writing for keywords instead of the actual question.",
      "Skipping structure and schema that engines rely on to extract answers.",
    ],
    bestPractices: [
      "Lead each section with a crisp, quotable answer.",
      "Use question-based headings that mirror how people ask.",
      "Pair concise definitions with scannable supporting detail.",
    ],
    faqs: [
      { q: "How is AEO different from SEO?", a: "SEO aims to rank a page in a list of results; AEO aims to be the extracted, cited answer inside features like AI Overviews and snippets. They overlap but optimize for different outcomes." },
      { q: "Is AEO the same as GEO?", a: "They're closely related. AEO focuses on answer engines and snippets; GEO focuses on being surfaced and cited inside generative AI engines. Both reward structure, clarity, and authority." },
    ],
    related: ["geo", "llm-optimization", "structured-data", "eeat"],
  },
  {
    slug: "geo",
    term: "Generative Engine Optimization (GEO)",
    aka: ["GEO", "generative engine optimization"],
    category: "ai-search",
    difficulty: "Advanced",
    readingTime: 6,
    popularity: 89,
    updated: "2026-06-26",
    summary: "Optimizing to be surfaced and cited inside generative AI answers.",
    definition:
      "Generative Engine Optimization (GEO) is the practice of optimizing content, entities, and authority so your brand and pages are surfaced and cited within generative AI engines like ChatGPT, Perplexity, Gemini, and Google's AI Overviews. It blends classic SEO signals with structure and entity clarity that LLMs can retrieve and trust.",
    whyItMatters:
      "As buyers ask AI engines directly, being the source those models cite is the new front page. GEO is how a brand earns presence in answers it can't rank for the old way.",
    howItWorks: [
      "Publish clear, authoritative, well-structured content on your topics.",
      "Strengthen entity signals so models associate concepts with your brand.",
      "Earn citations and mentions across trusted sources.",
      "Use structured data so machines parse your content reliably.",
      "Keep information accurate, current, and easy to extract.",
    ],
    mistakes: [
      "Assuming AI visibility just follows from traditional rankings.",
      "Thin, unstructured pages that models can't confidently cite.",
      "Weak or ambiguous entity signals across the web.",
    ],
    bestPractices: [
      "Write quotable, self-contained statements models can lift.",
      "Build and reinforce entity relationships (who you are, what you cover).",
      "Combine authority (citations) with clarity (structure and schema).",
    ],
    faqs: [
      { q: "How do I measure GEO?", a: "Track mentions and citations of your brand inside AI engine answers for your key questions, share of voice versus competitors, and referral traffic from AI surfaces." },
      { q: "Does GEO replace SEO?", a: "No — it extends it. Many GEO signals (authority, structure, entities, accuracy) are strong SEO signals too; you optimize for both traditional and generative surfaces." },
    ],
    related: ["aeo", "llm-optimization", "entity-seo", "structured-data"],
  },
  {
    slug: "llm-optimization",
    term: "LLM Optimization",
    aka: ["LLMO", "large language model optimization"],
    category: "ai-search",
    difficulty: "Advanced",
    readingTime: 5,
    popularity: 83,
    updated: "2026-06-23",
    summary: "Shaping content and signals so LLMs understand and represent you accurately.",
    definition:
      "LLM Optimization is the practice of shaping content, structure, and entity signals so large language models can accurately understand, retrieve, and represent your brand and pages in their outputs. It overlaps heavily with GEO and AEO, focusing on being correctly interpreted and cited by models.",
    whyItMatters:
      "If models misread or ignore you, you're invisible in AI answers — or worse, misrepresented. LLM optimization is about being both retrievable and accurately understood.",
    related: ["geo", "aeo", "entity-seo", "rag"],
  },
  {
    slug: "rag",
    term: "Retrieval-Augmented Generation (RAG)",
    aka: ["RAG"],
    category: "ai-search",
    difficulty: "Advanced",
    readingTime: 6,
    popularity: 85,
    updated: "2026-06-15",
    summary: "Grounding AI answers by retrieving relevant sources at query time.",
    definition:
      "Retrieval-Augmented Generation (RAG) is an AI architecture that retrieves relevant external documents at query time and feeds them to a language model so its answer is grounded in specific, current sources rather than only its training data. It's the pattern behind most citation-capable AI search and enterprise assistants.",
    whyItMatters:
      "RAG is why AI answers can cite fresh, specific sources — and why well-structured, authoritative content that's easy to retrieve earns a place inside those answers.",
    related: ["geo", "llm-optimization", "entity-seo", "structured-data"],
  },
  {
    slug: "entity-seo",
    term: "Entity SEO",
    aka: ["entity optimization"],
    category: "ai-search",
    difficulty: "Advanced",
    readingTime: 5,
    popularity: 72,
    updated: "2026-06-09",
    summary: "Optimizing around defined entities and their relationships in knowledge graphs.",
    definition:
      "Entity SEO is the practice of optimizing around clearly-defined entities — people, brands, products, concepts — and their relationships in knowledge graphs, so search and AI engines understand what your content is about, not merely which keywords it contains. It leans on consistency, structured data, and corroborating sources.",
    whyItMatters:
      "Modern engines think in entities. Being an unambiguous, well-connected entity is what lets you show up for a concept across search, knowledge panels, and AI answers.",
    related: ["semantic-seo", "structured-data", "geo", "llm-optimization"],
  },

  // ── Digital Marketing ─────────────────────────────────────────────────────
  {
    slug: "cac",
    term: "Customer Acquisition Cost (CAC)",
    aka: ["CAC", "acquisition cost"],
    category: "digital-marketing",
    difficulty: "Beginner",
    readingTime: 5,
    popularity: 79,
    updated: "2026-06-12",
    summary: "The total sales & marketing cost to acquire one new customer.",
    definition:
      "Customer Acquisition Cost (CAC) is the total sales and marketing spend required to acquire one new customer over a period, calculated by dividing that spend by the number of new customers won. It's a foundational unit-economics metric for judging whether growth is efficient.",
    whyItMatters:
      "CAC only makes sense next to the value a customer returns. Watching CAC against LTV tells you whether you can profitably spend more to grow — or whether the model leaks.",
    howItWorks: [
      "Sum all sales and marketing costs for a period (people, ads, tools).",
      "Count the new customers acquired in that same period.",
      "Divide total cost by new customers to get CAC.",
      "Compare CAC to LTV and to your payback period.",
    ],
    mistakes: [
      "Leaving out salaries, tools, or overhead and understating true CAC.",
      "Measuring CAC without LTV, so efficiency is meaningless.",
      "Blending wildly different channels into one misleading average.",
    ],
    bestPractices: [
      "Track CAC by channel and segment, not just blended.",
      "Pair CAC with LTV:CAC ratio and payback period.",
      "Lower CAC by improving targeting and qualification, not just cutting spend.",
    ],
    faqs: [
      { q: "What's a good LTV:CAC ratio?", a: "A common benchmark for healthy B2B SaaS is roughly 3:1, with CAC payback inside 12 months — but the right target depends on margins, growth stage, and capital." },
      { q: "How do I lower CAC?", a: "Improve targeting and qualification so spend lands on people likely to convert, raise conversion rates, and lean on efficient channels — often quality beats volume." },
    ],
    related: ["ltv", "roas", "attribution", "cro"],
  },
  {
    slug: "ltv",
    term: "Lifetime Value (LTV)",
    aka: ["LTV", "CLV", "customer lifetime value"],
    category: "digital-marketing",
    difficulty: "Beginner",
    readingTime: 4,
    popularity: 74,
    updated: "2026-06-07",
    summary: "The total value a customer generates over their whole relationship.",
    definition:
      "Lifetime Value (LTV or CLV) is the total revenue — or, more rigorously, gross profit — a customer generates across their entire relationship with your business. It's typically weighed against CAC to judge whether acquisition is sustainable.",
    whyItMatters:
      "LTV sets the ceiling on what you can afford to spend to win a customer. Growing LTV through retention and expansion often beats chasing ever-cheaper acquisition.",
    related: ["cac", "roas", "attribution"],
  },
  {
    slug: "roas",
    term: "Return on Ad Spend (ROAS)",
    aka: ["ROAS"],
    category: "digital-marketing",
    difficulty: "Beginner",
    readingTime: 4,
    popularity: 70,
    updated: "2026-05-27",
    summary: "Revenue generated for each unit of advertising spend.",
    definition:
      "Return on Ad Spend (ROAS) measures the revenue generated for every unit of money spent on advertising, calculated as revenue attributable to ads divided by ad cost. It's a channel- and campaign-level efficiency metric, usually expressed as a ratio or percentage.",
    whyItMatters:
      "ROAS tells you which ad campaigns pay for themselves, but it ignores margin and lifetime value — read it alongside CAC and LTV to avoid scaling something that looks efficient but loses money.",
    related: ["cac", "ltv", "attribution", "cro"],
  },
  {
    slug: "attribution",
    term: "Attribution",
    aka: ["marketing attribution"],
    category: "digital-marketing",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 68,
    updated: "2026-05-18",
    summary: "Assigning credit for conversions to the touchpoints that influenced them.",
    definition:
      "Attribution is the practice of assigning credit for a conversion to the marketing touchpoints that influenced it. Models range from simple first-touch and last-touch to multi-touch and data-driven approaches, each telling a different story about which channels drive results.",
    whyItMatters:
      "Attribution decides where budget flows. Choosing a model that reflects your real buyer journey keeps you from over-crediting the last click and starving the channels that actually created demand.",
    related: ["cac", "roas", "ltv", "cro"],
  },
  {
    slug: "cro",
    term: "Conversion Rate Optimization (CRO)",
    aka: ["CRO"],
    category: "digital-marketing",
    difficulty: "Intermediate",
    readingTime: 5,
    popularity: 73,
    updated: "2026-06-04",
    summary: "Systematically increasing the share of visitors who take a desired action.",
    definition:
      "Conversion Rate Optimization (CRO) is the systematic practice of increasing the percentage of visitors who take a desired action — sign up, book a demo, buy — through research, testing, and improvements to UX, messaging, and flow. It's grounded in hypotheses and experiments, not guesswork.",
    whyItMatters:
      "CRO compounds the value of every visitor you already have. A higher conversion rate lowers effective CAC and makes every channel more efficient without spending a cent more on traffic.",
    related: ["cac", "roas", "attribution"],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────
export function getAllTerms(): GlossaryTerm[] {
  return GLOSSARY_TERMS;
}

export function getTermBySlug(slug: string): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((t) => t.slug === slug);
}

export function getTermsByCategory(key: CategoryKey): GlossaryTerm[] {
  return GLOSSARY_TERMS.filter((t) => t.category === key);
}

export function getCategory(key: CategoryKey): GlossaryCategory | undefined {
  return GLOSSARY_CATEGORIES.find((c) => c.key === key);
}

export function categoryLabel(key: CategoryKey): string {
  return getCategory(key)?.label ?? key;
}

/** Top terms by editorial popularity. */
export function getTrendingTerms(n = 6): GlossaryTerm[] {
  return [...GLOSSARY_TERMS].sort((a, b) => b.popularity - a.popularity).slice(0, n);
}

/** Most recently reviewed terms. */
export function getRecentTerms(n = 6): GlossaryTerm[] {
  return [...GLOSSARY_TERMS].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, n);
}

export function resolveRelated(term: GlossaryTerm): GlossaryTerm[] {
  return term.related.map((s) => getTermBySlug(s)).filter((t): t is GlossaryTerm => Boolean(t));
}
