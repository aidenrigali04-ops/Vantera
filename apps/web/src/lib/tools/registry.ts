import {
  Heading,
  FileText,
  UserRound,
  Anchor,
  MousePointerClick,
  UserPlus,
  Reply,
  HeartCrack,
  Snowflake,
  Briefcase,
  Filter,
  Gauge,
  ScanSearch,
  Flame,
  Image as ImageIcon,
  GalleryHorizontalEnd,
  type LucideIcon,
} from "lucide-react";

/**
 * Free LinkedIn tools — a registry-driven suite of public, AI-backed generators and
 * analyzers (mirrors the USE_CASES / glossary registries). Each entry drives its SEO
 * page (`/tools/[slug]`), the interactive runner, and the `/tools` hub. This file is
 * CLIENT-SAFE metadata only — the model system prompts live server-side in `prompts.ts`
 * so they never ship in the client bundle.
 */

/** How a tool's result is shaped + rendered. One renderer per mode. */
export type ToolOutput = "variants" | "boolean" | "score" | "roast";

export type ToolFieldType = "text" | "textarea" | "select";

export interface ToolSelectOption {
  value: string;
  label: string;
}

export interface ToolField {
  /** key sent in the request body + referenced in the prompt */
  name: string;
  label: string;
  type: ToolFieldType;
  placeholder?: string;
  /** helper line under the input */
  hint?: string;
  required?: boolean;
  /** per-field character cap (enforced client + server) */
  maxLength: number;
  /** select-only */
  options?: ToolSelectOption[];
  /** textarea rows */
  rows?: number;
}

export interface ToolFaq {
  q: string;
  a: string;
}

export type ToolCategory =
  | "Profile"
  | "Content"
  | "Outreach"
  | "Recruiting"
  | "Sales"
  | "Analysis"
  | "Visual";

export interface Tool {
  slug: string;
  /** false = "coming soon": shown on the hub, no page, not in the sitemap */
  live: boolean;
  name: string;
  category: ToolCategory;
  icon: LucideIcon;
  /** small uppercase eyebrow on the tool page */
  eyebrow: string;
  /** one-liner under the H1 + on the hub card */
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  fields: ToolField[];
  /** primary button label */
  cta: string;
  output: ToolOutput;
  /** heading above the rendered results */
  outputHeading: string;
  faqs: ToolFaq[];
  /** slugs of related tools shown at the bottom */
  related: string[];
}

const TONE_OPTIONS: ToolSelectOption[] = [
  { value: "professional", label: "Professional" },
  { value: "confident", label: "Confident & bold" },
  { value: "friendly", label: "Warm & friendly" },
  { value: "data-driven", label: "Data-driven" },
  { value: "witty", label: "Witty" },
];

export const TOOLS: Tool[] = [
  /* ── Profile ─────────────────────────────────────────────────────────────── */
  {
    slug: "linkedin-headline-generator",
    live: true,
    name: "LinkedIn Headline Generator",
    category: "Profile",
    icon: Heading,
    eyebrow: "Profile",
    tagline: "Turn your role into a headline that gets profile clicks and shows up in search.",
    metaTitle: "Free LinkedIn Headline Generator — AI Headlines That Convert | Vantera",
    metaDescription:
      "Generate a LinkedIn headline that stops the scroll and ranks in search. Free AI tool — describe what you do and get 5 keyword-rich, benefit-led headlines in seconds.",
    keywords: [
      "linkedin headline generator",
      "linkedin headline examples",
      "professional headline linkedin",
      "linkedin headline ideas",
    ],
    fields: [
      { name: "role", label: "Your role or title", type: "text", required: true, maxLength: 120, placeholder: "Fractional CMO", hint: "What you do, in a few words." },
      { name: "audience", label: "Who you help", type: "text", required: true, maxLength: 160, placeholder: "B2B SaaS founders" },
      { name: "outcome", label: "The result you deliver", type: "text", required: true, maxLength: 200, placeholder: "predictable pipeline without a bigger team" },
      { name: "keywords", label: "Keywords to include", type: "text", required: false, maxLength: 160, placeholder: "demand gen, GTM, positioning", hint: "Optional — terms you want to rank for in search." },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate headlines",
    output: "variants",
    outputHeading: "Your headlines",
    faqs: [
      { q: "How long should a LinkedIn headline be?", a: "The headline field allows up to 220 characters. Use them — a fuller headline gives you room for keywords and a clear promise, and it shows more of your value in search results and comment threads." },
      { q: "What makes a good LinkedIn headline?", a: "A strong headline names who you help and the outcome you create, not just your job title. It reads like a promise, includes the terms your buyers search for, and is specific enough that the right person keeps reading." },
      { q: "Is this LinkedIn headline generator free?", a: "Yes. Generate headlines free, no signup required. Vantera builds it as a taste of the copy our SDR agents write across full LinkedIn outreach." },
    ],
    related: ["linkedin-about-generator", "linkedin-bio-generator", "linkedin-profile-analyzer"],
  },
  {
    slug: "linkedin-about-generator",
    live: true,
    name: "LinkedIn About Generator",
    category: "Profile",
    icon: FileText,
    eyebrow: "Profile",
    tagline: "Write an About section that reads like you — and makes the right people reach out.",
    metaTitle: "Free LinkedIn About Section Generator — AI Summary Writer | Vantera",
    metaDescription:
      "Write a LinkedIn About (summary) section that converts. Free AI generator — give it your role, audience, and proof, and get a full first-person summary in your voice.",
    keywords: [
      "linkedin about generator",
      "linkedin summary generator",
      "linkedin about section examples",
      "linkedin bio writer",
    ],
    fields: [
      { name: "role", label: "Your role or focus", type: "text", required: true, maxLength: 140, placeholder: "Head of Sales at a Series B fintech" },
      { name: "audience", label: "Who you serve", type: "text", required: true, maxLength: 160, placeholder: "mid-market finance teams" },
      { name: "value", label: "What you do & the outcome", type: "textarea", required: true, maxLength: 1200, rows: 4, placeholder: "I help finance teams close the books 40% faster by...", hint: "The problem you solve and the result you create." },
      { name: "proof", label: "Proof points", type: "textarea", required: false, maxLength: 900, rows: 3, placeholder: "12 years in fintech, scaled 3 teams, $40M in closed pipeline", hint: "Optional — achievements, numbers, or credibility markers." },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Write my About",
    output: "variants",
    outputHeading: "Your About section",
    faqs: [
      { q: "What should a LinkedIn About section include?", a: "Open with a hook, name who you help and the outcome you deliver, back it with a little proof, and end with a clear next step. Write in first person — it's your voice, not a résumé." },
      { q: "How long should the About section be?", a: "LinkedIn allows up to 2,600 characters. Aim for a focused few short paragraphs — enough to build credibility and a story, short enough that people actually read it." },
      { q: "Will it sound like AI wrote it?", a: "No. The generator avoids buzzwords and corporate filler and writes in a plain, human voice — the same standard our SDR agents hold every LinkedIn message to." },
    ],
    related: ["linkedin-headline-generator", "linkedin-bio-generator", "linkedin-profile-analyzer"],
  },
  {
    slug: "linkedin-bio-generator",
    live: true,
    name: "LinkedIn Bio Generator",
    category: "Profile",
    icon: UserRound,
    eyebrow: "Profile",
    tagline: "A short, sharp bio you can drop into your profile, a talk intro, or a pitch.",
    metaTitle: "Free LinkedIn Bio Generator — Short Professional Bios | Vantera",
    metaDescription:
      "Generate a short professional LinkedIn bio in seconds. Free AI tool — get 4 concise, on-brand bios for your profile, speaker intros, or company page.",
    keywords: [
      "linkedin bio generator",
      "professional bio generator",
      "short bio for linkedin",
      "linkedin bio examples",
    ],
    fields: [
      { name: "name", label: "Your name", type: "text", required: false, maxLength: 80, placeholder: "Jordan Rivera" },
      { name: "role", label: "Role & focus", type: "text", required: true, maxLength: 160, placeholder: "Product leader building AI tools for sales teams" },
      { name: "highlights", label: "A highlight or two", type: "text", required: false, maxLength: 240, placeholder: "ex-Stripe, 2x founder, angel investor", hint: "Optional — the credibility you want up front." },
      { name: "length", label: "Length", type: "select", required: false, maxLength: 30, options: [
        { value: "short", label: "Short (1–2 sentences)" },
        { value: "medium", label: "Medium (3–4 sentences)" },
      ] },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate bios",
    output: "variants",
    outputHeading: "Your bios",
    faqs: [
      { q: "What's the difference between a bio and the About section?", a: "A bio is a short, self-contained paragraph you can reuse anywhere — a speaker intro, a newsletter byline, a pitch deck. The About section is the longer, story-driven summary on your LinkedIn profile." },
      { q: "Should a LinkedIn bio be first or third person?", a: "Third person reads well for speaker intros and company pages; first person feels more personal on your own profile. Generate both and use whichever fits the context." },
      { q: "Is the bio generator really free?", a: "Yes — no signup, no card. It's a free sample of the copy quality Vantera's agents bring to full LinkedIn outreach." },
    ],
    related: ["linkedin-headline-generator", "linkedin-about-generator", "linkedin-profile-roaster"],
  },

  /* ── Content ─────────────────────────────────────────────────────────────── */
  {
    slug: "linkedin-hook-generator",
    live: true,
    name: "LinkedIn Hook Generator",
    category: "Content",
    icon: Anchor,
    eyebrow: "Content",
    tagline: "Write scroll-stopping first lines — the opener decides whether the post gets read.",
    metaTitle: "Free LinkedIn Hook Generator — Scroll-Stopping First Lines | Vantera",
    metaDescription:
      "Generate LinkedIn post hooks that stop the scroll. Free AI tool — give it your topic and angle and get 6 punchy opening lines engineered for the 'see more' click.",
    keywords: [
      "linkedin hook generator",
      "linkedin post hooks",
      "scroll stopping hooks",
      "linkedin content ideas",
    ],
    fields: [
      { name: "topic", label: "What's the post about?", type: "textarea", required: true, maxLength: 700, rows: 3, placeholder: "Why most outbound fails: teams optimize for volume, not fit." },
      { name: "audience", label: "Who's it for?", type: "text", required: true, maxLength: 160, placeholder: "founders and heads of sales" },
      { name: "angle", label: "Angle", type: "select", required: false, maxLength: 40, options: [
        { value: "contrarian", label: "Contrarian take" },
        { value: "story", label: "Personal story" },
        { value: "stat", label: "Surprising stat" },
        { value: "question", label: "Provocative question" },
        { value: "howto", label: "How-to / lesson" },
      ] },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate hooks",
    output: "variants",
    outputHeading: "Your hooks",
    faqs: [
      { q: "What is a LinkedIn hook?", a: "The hook is the first one or two lines of a post — the only text visible before the 'see more' cut. It decides whether someone expands your post or scrolls past, so it carries most of the weight." },
      { q: "What makes a hook work?", a: "Tension. A good hook creates a small open loop — a bold claim, an unexpected number, a question the reader needs answered — that can only be closed by reading on. It's specific, never generic." },
      { q: "Can I use these hooks anywhere?", a: "Yes. They're written for LinkedIn posts, but the same openers work for newsletters, cold DMs, and video intros." },
    ],
    related: ["linkedin-cta-generator", "linkedin-about-generator", "cold-outreach-generator"],
  },
  {
    slug: "linkedin-cta-generator",
    live: true,
    name: "LinkedIn CTA Generator",
    category: "Content",
    icon: MousePointerClick,
    eyebrow: "Content",
    tagline: "End posts and messages with an ask that actually earns the reply, click, or booking.",
    metaTitle: "Free LinkedIn CTA Generator — Calls to Action That Convert | Vantera",
    metaDescription:
      "Generate calls to action for LinkedIn posts, DMs, and messages. Free AI tool — pick your goal and get 5 natural CTAs that drive replies, comments, and bookings.",
    keywords: [
      "linkedin cta generator",
      "call to action generator",
      "linkedin post cta",
      "cta examples",
    ],
    fields: [
      { name: "goal", label: "What do you want them to do?", type: "select", required: true, maxLength: 40, options: [
        { value: "reply", label: "Reply to my message" },
        { value: "comment", label: "Comment on my post" },
        { value: "book", label: "Book a call" },
        { value: "dm", label: "DM me" },
        { value: "signup", label: "Sign up / try it" },
        { value: "download", label: "Download a resource" },
      ] },
      { name: "context", label: "What are you offering?", type: "textarea", required: true, maxLength: 700, rows: 3, placeholder: "a free teardown of their outbound sequence" },
      { name: "audience", label: "Who's it for?", type: "text", required: false, maxLength: 160, placeholder: "SaaS sales leaders" },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate CTAs",
    output: "variants",
    outputHeading: "Your CTAs",
    faqs: [
      { q: "What is a good CTA on LinkedIn?", a: "A good CTA asks for one small, specific action and lowers the effort of saying yes. 'Want the template? Comment TEMPLATE' beats 'Let me know if interested' every time." },
      { q: "Where do I use these?", a: "At the end of posts to lift comments, in DMs to earn a reply, and in outreach to move toward a call. Match the CTA's ask to how warm the reader already is." },
      { q: "Why do soft CTAs work better in outreach?", a: "A hard 'book a 30-minute demo' asks a stranger for a lot. An interest-based ask ('worth a look?') gets a reply first — and a reply is what you actually need to start a conversation." },
    ],
    related: ["linkedin-hook-generator", "follow-up-message-generator", "cold-outreach-generator"],
  },

  /* ── Outreach ────────────────────────────────────────────────────────────── */
  {
    slug: "connection-request-generator",
    live: true,
    name: "Connection Request Generator",
    category: "Outreach",
    icon: UserPlus,
    eyebrow: "Outreach",
    tagline: "Personalized connection notes under 300 characters that actually get accepted.",
    metaTitle: "Free LinkedIn Connection Request Generator — Notes That Get Accepted | Vantera",
    metaDescription:
      "Write LinkedIn connection request notes that get accepted. Free AI tool — get personalized, non-salesy notes under 300 characters that read like a real person.",
    keywords: [
      "linkedin connection request generator",
      "linkedin connection message",
      "connection request note",
      "linkedin invite message",
    ],
    fields: [
      { name: "recipient", label: "Who are you connecting with?", type: "text", required: true, maxLength: 160, placeholder: "Priya, VP Marketing at Acme" },
      { name: "reason", label: "Why connect / what you have in common", type: "textarea", required: true, maxLength: 700, rows: 3, placeholder: "saw her post on attribution; we both came up through demand gen", hint: "A genuine trigger or commonality — this is what earns the accept." },
      { name: "yourRole", label: "Your role", type: "text", required: false, maxLength: 140, placeholder: "founder of a B2B attribution tool" },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate notes",
    output: "variants",
    outputHeading: "Your connection notes",
    faqs: [
      { q: "What's the character limit on a connection request?", a: "LinkedIn allows up to 300 characters in a connection note (200 on free accounts). Every note here is written to fit — short, specific, and complete." },
      { q: "Should a connection request include a pitch?", a: "No. A note that pitches gets ignored or reported. The only job of the note is to earn the accept by referencing something real — save the conversation for after they connect." },
      { q: "Do personalized connection notes get more accepts?", a: "A note that references the person's actual work or a genuine commonality reads like a peer reaching out, not a sales blast — and that's what lifts accept rates." },
    ],
    related: ["cold-outreach-generator", "follow-up-message-generator", "linkedin-cta-generator"],
  },
  {
    slug: "follow-up-message-generator",
    live: true,
    name: "Follow-up Message Generator",
    category: "Outreach",
    icon: Reply,
    eyebrow: "Outreach",
    tagline: "Follow-ups that add a reason to reply — never a hollow 'just bumping this'.",
    metaTitle: "Free LinkedIn Follow-up Message Generator — Get the Reply | Vantera",
    metaDescription:
      "Write LinkedIn follow-up messages that earn a reply. Free AI tool — give it the context and get 4 follow-ups that add value instead of just bumping the thread.",
    keywords: [
      "linkedin follow up message",
      "follow up message generator",
      "sales follow up template",
      "how to follow up on linkedin",
    ],
    fields: [
      { name: "context", label: "Where does the conversation stand?", type: "textarea", required: true, maxLength: 900, rows: 3, placeholder: "Connected 2 weeks ago, sent one message about their hiring push, no reply yet." },
      { name: "goal", label: "What's the ask?", type: "text", required: true, maxLength: 200, placeholder: "a 15-min chat about how we cut their SDR ramp time" },
      { name: "previous", label: "Your previous message", type: "textarea", required: false, maxLength: 800, rows: 3, placeholder: "Optional — paste what you already sent so the follow-up builds on it.", hint: "Optional — helps the follow-up avoid repeating yourself." },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate follow-ups",
    output: "variants",
    outputHeading: "Your follow-ups",
    faqs: [
      { q: "How many times should I follow up on LinkedIn?", a: "Two to three thoughtful touches is plenty. Each one should add a new angle or reason to reply — if you have nothing new to say, a breakup message is the better move." },
      { q: "How long should I wait to follow up?", a: "Give it a few days to a week between messages. On LinkedIn, spacing your touches also keeps your account within safe, human-like pacing." },
      { q: "What makes a follow-up work?", a: "A reason to reply. The best follow-ups reference something the prospect cares about — a trigger, a result, a relevant idea — instead of just asking whether they saw your last message." },
    ],
    related: ["breakup-message-generator", "connection-request-generator", "cold-outreach-generator"],
  },
  {
    slug: "breakup-message-generator",
    live: true,
    name: "Breakup Message Generator",
    category: "Outreach",
    icon: HeartCrack,
    eyebrow: "Outreach",
    tagline: "The graceful last message that closes the loop — and often gets the reply.",
    metaTitle: "Free LinkedIn Breakup Message Generator — Close the Loop | Vantera",
    metaDescription:
      "Write a polite LinkedIn breakup message that closes the loop and often revives the thread. Free AI tool — get 4 no-pressure last touches that leave the door open.",
    keywords: [
      "breakup email generator",
      "sales breakup message",
      "linkedin breakup message",
      "last follow up message",
    ],
    fields: [
      { name: "context", label: "The situation", type: "textarea", required: true, maxLength: 900, rows: 3, placeholder: "Reached out 3 times about their onboarding pain, no reply." },
      { name: "offer", label: "What you were offering", type: "text", required: true, maxLength: 240, placeholder: "a faster way to onboard new customers" },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate breakup messages",
    output: "variants",
    outputHeading: "Your breakup messages",
    faqs: [
      { q: "What is a breakup message?", a: "It's the final message in a sequence — a polite note that acknowledges you haven't connected and closes the loop. Done well, it removes pressure, and that's often exactly what earns the reply." },
      { q: "Why do breakup messages get replies?", a: "They flip the dynamic. Instead of chasing, you're gracefully stepping back — which triggers a 'wait, actually…' response from people who were interested but busy." },
      { q: "Should the breakup message be pushy?", a: "Never. The whole point is a no-pressure exit that leaves the door open. Pushy defeats the purpose and burns the relationship." },
    ],
    related: ["follow-up-message-generator", "cold-outreach-generator", "connection-request-generator"],
  },
  {
    slug: "cold-outreach-generator",
    live: true,
    name: "Cold Outreach Generator",
    category: "Outreach",
    icon: Snowflake,
    eyebrow: "Outreach",
    tagline: "A cold LinkedIn message built around them — the trigger, the value, one soft ask.",
    metaTitle: "Free Cold Outreach Message Generator for LinkedIn | Vantera",
    metaDescription:
      "Write cold LinkedIn messages that get replies. Free AI tool — give it who you're targeting and your offer, and get personalized cold outreach that doesn't read as spam.",
    keywords: [
      "cold outreach generator",
      "cold message linkedin",
      "cold dm generator",
      "linkedin cold outreach template",
    ],
    fields: [
      { name: "recipient", label: "Who are you messaging?", type: "text", required: true, maxLength: 180, placeholder: "Head of RevOps at a Series B SaaS company" },
      { name: "offer", label: "What you do / your offer", type: "textarea", required: true, maxLength: 900, rows: 3, placeholder: "we cut CRM data-entry time by automating pipeline updates" },
      { name: "outcome", label: "The outcome for them", type: "text", required: true, maxLength: 240, placeholder: "reps spend 5 fewer hours a week in the CRM" },
      { name: "trigger", label: "Personalization / trigger", type: "textarea", required: false, maxLength: 700, rows: 2, placeholder: "they just posted about scaling their sales team", hint: "Optional — a real reason you're reaching out now." },
      { name: "cta", label: "Your ask", type: "text", required: false, maxLength: 200, placeholder: "worth a quick look?" },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate cold messages",
    output: "variants",
    outputHeading: "Your cold messages",
    faqs: [
      { q: "What makes a cold LinkedIn message work?", a: "Relevance and restraint. Lead with something true about them, connect it to one concrete outcome, and end with a soft ask. Long pitches and hard demos get ignored." },
      { q: "How long should a cold message be?", a: "Short. A few sentences that a busy person can read on their phone and reply to in one line. If it needs scrolling, it's too long." },
      { q: "Is cold outreach on LinkedIn allowed?", a: "Yes, within LinkedIn's limits. Keep volume human, personalize genuinely, and respect opt-outs. Vantera automates this exact motion with built-in pacing and suppression so your account stays safe." },
    ],
    related: ["connection-request-generator", "follow-up-message-generator", "recruiter-message-generator"],
  },

  /* ── Recruiting ──────────────────────────────────────────────────────────── */
  {
    slug: "recruiter-message-generator",
    live: true,
    name: "Recruiter Message Generator",
    category: "Recruiting",
    icon: Briefcase,
    eyebrow: "Recruiting",
    tagline: "Candidate outreach that respects their time and actually sells the role.",
    metaTitle: "Free Recruiter Message Generator for LinkedIn — InMail That Gets Replies | Vantera",
    metaDescription:
      "Write recruiter outreach and InMail that candidates reply to. Free AI tool — give it the role and candidate, and get personalized messages that sell the opportunity.",
    keywords: [
      "recruiter message generator",
      "linkedin inmail template recruiter",
      "recruiting outreach message",
      "candidate outreach linkedin",
    ],
    fields: [
      { name: "role", label: "Role you're hiring for", type: "text", required: true, maxLength: 160, placeholder: "Senior Backend Engineer (Go)" },
      { name: "company", label: "Company", type: "text", required: true, maxLength: 160, placeholder: "a well-funded climate-tech startup" },
      { name: "candidate", label: "Candidate background", type: "textarea", required: true, maxLength: 700, rows: 3, placeholder: "6 yrs building distributed systems, currently at a big fintech" },
      { name: "why", label: "Why them / why now", type: "text", required: false, maxLength: 240, placeholder: "their open-source work maps exactly to our stack" },
      { name: "perks", label: "What's attractive about the role", type: "textarea", required: false, maxLength: 500, rows: 2, placeholder: "remote, greenfield rebuild, top-of-market equity", hint: "Optional — the hooks that make it worth a reply." },
      { name: "tone", label: "Tone", type: "select", required: false, maxLength: 40, options: TONE_OPTIONS },
    ],
    cta: "Generate recruiter messages",
    output: "variants",
    outputHeading: "Your recruiter messages",
    faqs: [
      { q: "What makes recruiter outreach get replies?", a: "Specificity. Candidates ignore mass InMail. A message that shows you actually looked at their work, names why they're a fit, and is honest about the role earns a reply — even a 'not now, but thanks'." },
      { q: "How long should a recruiter message be?", a: "Short enough to read in 15 seconds. Lead with why them, give one or two real reasons the role is worth a look, and make the next step easy." },
      { q: "Should I mention comp or company name?", a: "Name the company (or at least the stage and space) — vague 'exciting opportunity' outreach reads as spam. Comp isn't required up front, but a signal of range or equity helps." },
    ],
    related: ["cold-outreach-generator", "connection-request-generator", "linkedin-cta-generator"],
  },

  /* ── Sales ───────────────────────────────────────────────────────────────── */
  {
    slug: "sales-navigator-boolean-generator",
    live: true,
    name: "Sales Navigator Boolean Generator",
    category: "Sales",
    icon: Filter,
    eyebrow: "Sales",
    tagline: "Turn a messy list of titles and keywords into a clean Boolean search string.",
    metaTitle: "Free Sales Navigator Boolean Search Generator | Vantera",
    metaDescription:
      "Build LinkedIn and Sales Navigator Boolean search strings in seconds. Free tool — enter titles, keywords, and exclusions and get a ready-to-paste Boolean query.",
    keywords: [
      "sales navigator boolean search",
      "boolean search generator",
      "linkedin boolean search",
      "boolean search string builder",
    ],
    fields: [
      { name: "titles", label: "Titles or keywords to match (any of these)", type: "textarea", required: true, maxLength: 700, rows: 3, placeholder: "VP Sales, Head of Revenue, Chief Revenue Officer, Sales Director" },
      { name: "alsoInclude", label: "Must ALSO include (all of these)", type: "text", required: false, maxLength: 300, placeholder: "SaaS, software", hint: "Optional — terms that must all be present (AND)." },
      { name: "exclude", label: "Exclude", type: "text", required: false, maxLength: 300, placeholder: "assistant, junior, intern", hint: "Optional — terms to filter out (NOT)." },
    ],
    cta: "Build Boolean string",
    output: "boolean",
    outputHeading: "Your Boolean search",
    faqs: [
      { q: "What is Boolean search on LinkedIn?", a: "Boolean search combines terms with operators — AND, OR, NOT, quotes, and parentheses — to precisely control who shows up in your results. It works in LinkedIn's keyword search and in Sales Navigator." },
      { q: "How do the operators work?", a: "Quotes match an exact phrase (\"head of sales\"), OR widens (any term matches), AND narrows (all terms must appear), NOT excludes, and parentheses group logic together. This tool assembles them for you." },
      { q: "Does this work for Sales Navigator and regular LinkedIn?", a: "Yes. The generated string works in the keyword field of both. Note that Sales Navigator also has structured filters — Boolean is most powerful in the free-text keyword box." },
    ],
    related: ["cold-outreach-generator", "connection-request-generator", "linkedin-profile-analyzer"],
  },

  /* ── Analysis ────────────────────────────────────────────────────────────── */
  {
    slug: "linkedin-ssi-score-checker",
    live: true,
    name: "LinkedIn SSI Score Checker",
    category: "Analysis",
    icon: Gauge,
    eyebrow: "Analysis",
    tagline: "Estimate your Social Selling Index across all four pillars — and how to lift it.",
    metaTitle: "Free LinkedIn SSI Score Checker & Estimator | Vantera",
    metaDescription:
      "Estimate your LinkedIn Social Selling Index (SSI) across the four pillars. Free tool — answer a few questions and get an estimated score with specific ways to raise it.",
    keywords: [
      "linkedin ssi score",
      "social selling index checker",
      "ssi score linkedin",
      "how to improve ssi score",
    ],
    fields: [
      { name: "brand", label: "Profile completeness & content", type: "select", required: true, maxLength: 40, options: [
        { value: "bare", label: "Bare-bones profile, rarely post" },
        { value: "decent", label: "Complete profile, post occasionally" },
        { value: "strong", label: "Optimized profile, post & share weekly" },
      ] },
      { name: "prospecting", label: "Finding the right people", type: "select", required: true, maxLength: 40, options: [
        { value: "rarely", label: "Rarely search or use filters" },
        { value: "sometimes", label: "Search sometimes, basic filters" },
        { value: "daily", label: "Use search / Sales Nav daily with saved filters" },
      ] },
      { name: "insights", label: "Engaging with insights", type: "select", required: true, maxLength: 40, options: [
        { value: "lurk", label: "Mostly lurk, rarely comment" },
        { value: "some", label: "Like and comment sometimes" },
        { value: "active", label: "Comment and share thoughtfully most days" },
      ] },
      { name: "relationships", label: "Building relationships", type: "select", required: true, maxLength: 40, options: [
        { value: "small", label: "Small network, few new connections" },
        { value: "growing", label: "Growing network, connect weekly" },
        { value: "active", label: "Connect with decision-makers regularly" },
      ] },
      { name: "connections", label: "Rough network size", type: "select", required: false, maxLength: 40, options: [
        { value: "under500", label: "Under 500" },
        { value: "500to2k", label: "500–2,000" },
        { value: "over2k", label: "2,000+" },
      ] },
    ],
    cta: "Estimate my SSI",
    output: "score",
    outputHeading: "Your estimated SSI",
    faqs: [
      { q: "What is the LinkedIn SSI score?", a: "The Social Selling Index is LinkedIn's 0–100 measure of how effectively you use the platform to sell, built from four pillars: your professional brand, finding the right people, engaging with insights, and building relationships." },
      { q: "Is this my real SSI score?", a: "No — it's an estimate based on your answers. Your official score lives at linkedin.com/sales/ssi. This tool shows roughly where you stand and, more usefully, exactly which pillar to work on." },
      { q: "How do I improve my SSI?", a: "Lift the weakest pillar first: complete and post from your profile, search with intent, comment thoughtfully every day, and connect with real decision-makers. The estimate breaks down where your points are being left on the table." },
    ],
    related: ["linkedin-profile-analyzer", "linkedin-headline-generator", "linkedin-profile-roaster"],
  },
  {
    slug: "linkedin-profile-analyzer",
    live: true,
    name: "LinkedIn Profile Analyzer",
    category: "Analysis",
    icon: ScanSearch,
    eyebrow: "Analysis",
    tagline: "Paste your profile, get a scored breakdown and the specific fixes that matter.",
    metaTitle: "Free LinkedIn Profile Analyzer — Scored Feedback & Fixes | Vantera",
    metaDescription:
      "Analyze your LinkedIn profile in seconds. Free AI tool — paste your headline and About and get a scored, section-by-section breakdown with concrete improvements.",
    keywords: [
      "linkedin profile analyzer",
      "linkedin profile review",
      "linkedin profile checker",
      "optimize linkedin profile",
    ],
    fields: [
      { name: "goal", label: "What's your main goal?", type: "select", required: true, maxLength: 40, options: [
        { value: "sales", label: "Win business / sales" },
        { value: "job", label: "Land a job" },
        { value: "brand", label: "Build a personal brand" },
        { value: "recruiting", label: "Recruit talent" },
      ] },
      { name: "headline", label: "Your headline", type: "text", required: true, maxLength: 260, placeholder: "Paste your current LinkedIn headline" },
      { name: "about", label: "Your About section", type: "textarea", required: true, maxLength: 3000, rows: 6, placeholder: "Paste your current About / summary text" },
      { name: "experience", label: "Current role & headline experience", type: "textarea", required: false, maxLength: 1500, rows: 4, placeholder: "Optional — paste your current title and top experience bullets." },
    ],
    cta: "Analyze my profile",
    output: "score",
    outputHeading: "Your profile analysis",
    faqs: [
      { q: "What does the profile analyzer check?", a: "It scores the parts that decide whether the right people stop and read: your headline, your About section, positioning and clarity, keyword coverage for search, and how strong your call to action is." },
      { q: "Does it read my live LinkedIn profile?", a: "No — you paste your text, so nothing is scraped and your privacy is respected. Paste your headline and About, and optionally your current role, for the sharpest read." },
      { q: "How is the score calculated?", a: "It weighs clarity, specificity, keyword coverage, and how well the profile serves your stated goal — then flags the highest-leverage fixes first so you know exactly where to start." },
    ],
    related: ["linkedin-profile-roaster", "linkedin-ssi-score-checker", "linkedin-headline-generator"],
  },
  {
    slug: "linkedin-profile-roaster",
    live: true,
    name: "LinkedIn Profile Roaster",
    category: "Analysis",
    icon: Flame,
    eyebrow: "Analysis",
    tagline: "A brutally funny roast of your profile — then the real fixes, once you've recovered.",
    metaTitle: "LinkedIn Profile Roaster — Get Roasted (Then Fixed) | Vantera",
    metaDescription:
      "Get your LinkedIn profile roasted by AI — funny, savage, and weirdly useful. Free tool — paste your headline and About for a roast plus the real fixes underneath.",
    keywords: [
      "linkedin profile roaster",
      "roast my linkedin",
      "linkedin roast generator",
      "roast my profile",
    ],
    fields: [
      { name: "headline", label: "Your headline", type: "text", required: true, maxLength: 260, placeholder: "Paste your LinkedIn headline (the more buzzwords, the better the roast)" },
      { name: "about", label: "Your About section", type: "textarea", required: true, maxLength: 3000, rows: 6, placeholder: "Paste your About / summary — don't hold back" },
      { name: "role", label: "Current role", type: "text", required: false, maxLength: 200, placeholder: "Optional — e.g. 'Visionary Thought Leader & Growth Ninja'" },
    ],
    cta: "Roast me",
    output: "roast",
    outputHeading: "The roast",
    faqs: [
      { q: "Is the roast mean?", a: "It's savage but not cruel — it goes after the buzzwords, the humble-brags, and the 'passionate about synergy' clichés, not you as a person. And it ends with fixes you can actually use." },
      { q: "Is there anything useful in it?", a: "Yes. Under the jokes is a real critique — the same weak spots our profile analyzer flags, just funnier. Every roast comes with straight-talk fixes." },
      { q: "Will you store my profile text?", a: "No. You paste your text, it's used to generate the roast, and it isn't saved or scraped from LinkedIn." },
    ],
    related: ["linkedin-profile-analyzer", "linkedin-ssi-score-checker", "linkedin-about-generator"],
  },

  /* ── Visual (coming soon) ────────────────────────────────────────────────── */
  {
    slug: "linkedin-banner-generator",
    live: false,
    name: "LinkedIn Banner Generator",
    category: "Visual",
    icon: ImageIcon,
    eyebrow: "Visual",
    tagline: "Design an on-brand LinkedIn banner in seconds — copy, layout, and download.",
    metaTitle: "LinkedIn Banner Generator — Coming Soon | Vantera",
    metaDescription: "A free LinkedIn banner generator from Vantera — coming soon.",
    keywords: ["linkedin banner generator", "linkedin cover image maker"],
    fields: [],
    output: "variants",
    cta: "Notify me",
    outputHeading: "",
    faqs: [],
    related: ["linkedin-headline-generator", "linkedin-about-generator"],
  },
  {
    slug: "linkedin-carousel-generator",
    live: false,
    name: "LinkedIn Carousel Generator",
    category: "Visual",
    icon: GalleryHorizontalEnd,
    eyebrow: "Visual",
    tagline: "Turn one idea into a swipeable, download-ready LinkedIn carousel.",
    metaTitle: "LinkedIn Carousel Generator — Coming Soon | Vantera",
    metaDescription: "A free LinkedIn carousel generator from Vantera — coming soon.",
    keywords: ["linkedin carousel generator", "linkedin carousel maker"],
    fields: [],
    output: "variants",
    cta: "Notify me",
    outputHeading: "",
    faqs: [],
    related: ["linkedin-hook-generator", "linkedin-cta-generator"],
  },
];

/** All categories in display order for the hub. */
export const TOOL_CATEGORIES: ToolCategory[] = [
  "Profile",
  "Content",
  "Outreach",
  "Recruiting",
  "Sales",
  "Analysis",
  "Visual",
];

export const LIVE_TOOLS = TOOLS.filter((t) => t.live);

export function getTool(slug: string): Tool | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getLiveTool(slug: string): Tool | undefined {
  return LIVE_TOOLS.find((t) => t.slug === slug);
}
