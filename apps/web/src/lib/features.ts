import {
  BrainCircuit,
  MessagesSquare,
  Radar,
  RefreshCw,
  ScanSearch,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { CEILING_FACT, CUSTODY_SENTENCE, ONBOARDING_MINUTES } from "@/components/landing/claims";

/**
 * The feature sub-landing pages (/features and /features/[slug]) — one typed entry per
 * feature, after rankbox.xyz's data/features.ts. Pages render this copy; they don't own
 * any. Every claim here is a product fact from the locked rules (01/04/05/06/08/11) or
 * the owner's positioning (autopilot sending, machine-learned targeting, ~3-minute
 * setup — claims.ts). Specs are facts, never promised outcomes. No vendor names
 * (white-label, rules 03–05).
 */

/** A title in two parts: the lead in ink, the closing phrase bold blue. */
export interface TwoPart {
  lead: string;
  accent: string;
}

export interface FeatureFaq {
  q: string;
  a: string;
}

/** A product fact shown in the band under the hero. Facts, not outcomes. */
export interface FeatureSpec {
  value: string;
  label: string;
}

/** A "Keep exploring" card: a real route elsewhere on the site. */
export interface FeatureLink {
  kind: string;
  title: string;
  desc: string;
  href: string;
}

/** Which column a feature sits under in the nav's Platform menu. */
export type FeatureGroup = "Find buyers" | "Book meetings";

export const FEATURE_GROUPS: FeatureGroup[] = ["Find buyers", "Book meetings"];

export interface Feature {
  slug: string;
  group: FeatureGroup;
  name: string;
  /** One line: nav rows, the engine grid, the /features index. */
  tagline: string;
  icon: LucideIcon;
  /** Pill above the H1 — carries the page's primary keyword. */
  eyebrow: string;
  /** The H1: `lead` on the first line, `accent` (blue, led by the icon tile) on the
      second. Keep each part under ~20 characters so the lockup holds everywhere. */
  headline: TwoPart;
  subhead: string;
  metaTitle: string;
  metaDescription: string;
  specs: FeatureSpec[];
  problem: { title: TwoPart; body: string; before: string[]; after: string[] };
  benefitsTitle: TwoPart;
  benefitsIntro: string;
  benefits: { title: string; body: string }[];
  stepsTitle: TwoPart;
  steps: { title: string; body: string }[];
  /** How this feature feeds, and is fed by, the rest of the engine. */
  connects: string;
  faqs: FeatureFaq[];
  ctaTitle: string;
  ctaBody: string;
  explore: { title: string; links: FeatureLink[]; terms: { label: string; href: string }[] };
}

const SETUP = `${ONBOARDING_MINUTES} min`;

export const FEATURES: Feature[] = [
  {
    slug: "prospect-discovery",
    group: "Find buyers",
    name: "Prospect discovery",
    tagline: "Agents search your ICP on a schedule for buyers who fit.",
    icon: Radar,
    eyebrow: "AI prospecting for LinkedIn",
    headline: { lead: "Find the buyers", accent: "worth messaging" },
    subhead:
      "Vantera's agents search your ideal customer profile on the schedule you set, check every person against your fit rules, read the signals that show they're in-market, and hand only qualified prospects to outreach.",
    metaTitle: "AI Prospecting on LinkedIn: Find In-Market Buyers | Vantera",
    metaDescription:
      "Vantera's prospecting agents search your ICP daily or weekly, qualify every person against your fit rules and buying signals, and queue only high-fit buyers for outreach.",
    specs: [
      { value: "Up to 3", label: "ideal customer profiles per agent" },
      { value: "Daily or weekly", label: "runs, at the time you choose" },
      { value: "2 stages", label: "a fit gate, then an AI rank on signals" },
      { value: SETUP, label: "from your website to a live agent" },
    ],
    problem: {
      title: { lead: "Stop prospecting from", accent: "stale lists" },
      body: "Exported lists go stale the day you pull them, and most of the names were never a fit. Good prospecting finds the right people at the right moment, every week, without the spreadsheet.",
      before: [
        "Exporting lists from search filters and cleaning them by hand",
        "Messaging everyone with a matching title, fit or not",
        "Missing the moment a buyer posts, hires, or raises",
        "Rebuilding the same searches every Monday",
      ],
      after: [
        "Your ICP searched on a schedule, automatically",
        "Every person checked against your fit rules first",
        "Buying signals read for everyone who passes",
        "Only qualified prospects handed to outreach",
      ],
    },
    benefitsTitle: { lead: "Prospecting that runs", accent: "while you sell" },
    benefitsIntro:
      "Tell the agent who you sell to once. It searches, filters, and ranks on its own, and explains every pick.",
    benefits: [
      {
        title: "Your ICP, searched on a schedule",
        body: "Pick daily or weekly and a time. Each run searches up to three customer profiles by title, seniority, industry, company size, and region.",
      },
      {
        title: "A fit gate before anything else",
        body: "Hard rules on title, industry, headcount, and geography come first, so nobody off-profile gets near your outreach.",
      },
      {
        title: "Signals that say why now",
        body: "For everyone who passes, the agent reads recent posts, hiring, funding, and job changes, and writes down why this person, and why now.",
      },
    ],
    stepsTitle: { lead: "From your website to", accent: "a live agent" },
    steps: [
      {
        title: "Paste your website",
        body: "Vantera reads your site and drafts your buyer profile as editable chips.",
      },
      {
        title: "Confirm your ICP",
        body: "Keep the suggested profile, or set up to three of your own.",
      },
      {
        title: "Pick a schedule",
        body: "Daily or weekly, at a time you choose. The first run starts within minutes.",
      },
    ],
    connects:
      "Discovery is where the engine starts. Everyone it finds is scored for fit, targeting learns from who replies, and outreach writes to the people who clear the bar.",
    faqs: [
      {
        q: "Where do prospects come from?",
        a: "Agents search a large B2B database of companies and people, filtered by the ideal customer profile you set: title, seniority, industry, company size, and region. Contact details are only enriched for people who pass your fit rules.",
      },
      {
        q: "How many profiles can one agent target?",
        a: "Up to three ideal customer profiles per agent. The profile Vantera drafts from your website is offered as a starting point, and you can change it anytime.",
      },
      {
        q: "How often does it run?",
        a: "Daily or weekly, at a time you choose, in your timezone. The first run starts within minutes of deploying.",
      },
      {
        q: "Does it only find people by job title?",
        a: "No. Fit comes first, then signals: what people post about, whether their company is hiring or just raised, and recent job changes. Signals lift a prospect's score, but they never replace fit.",
      },
      {
        q: "Will it reach people outside my ICP?",
        a: "No. Anyone who fails the fit gate is dropped before enrichment, and only prospects who score 70 or above move on to outreach.",
      },
    ],
    ctaTitle: "See who fits your ICP this week",
    ctaBody: `Paste your website and your first agent starts searching in about ${ONBOARDING_MINUTES} minutes.`,
    explore: {
      title: "Find the buyers who fit",
      links: [
        { kind: "Feature", title: "Fit scoring", desc: "The bar every prospect clears before outreach.", href: "/features/fit-scoring" },
        { kind: "Use case", title: "Vantera for founders", desc: "Your first repeatable outbound channel.", href: "/use-cases/for-founders" },
        { kind: "Free tool", title: "Sales Navigator Boolean generator", desc: "Build precise searches for your ICP.", href: "/tools/sales-navigator-boolean-generator" },
        { kind: "Playbooks", title: "Outbound playbooks", desc: "LinkedIn plays your agents can run.", href: "/playbooks" },
        { kind: "Guide", title: "How we prove it", desc: "How Vantera measures what it claims.", href: "/how-we-prove-it" },
        { kind: "Use case", title: "Vantera for sales teams", desc: "Pipeline without more headcount.", href: "/use-cases/for-sales-teams" },
      ],
      terms: [
        { label: "LinkedIn Sales Navigator", href: "/glossary/linkedin-sales-navigator" },
        { label: "Social selling", href: "/glossary/social-selling" },
        { label: "BANT", href: "/glossary/bant" },
        { label: "Outreach automation", href: "/glossary/outreach-automation" },
      ],
    },
  },
  {
    slug: "fit-scoring",
    group: "Find buyers",
    name: "Fit scoring",
    tagline: "Every prospect scored, with the math shown.",
    icon: ScanSearch,
    eyebrow: "AI lead scoring for LinkedIn",
    headline: { lead: "Score every prospect", accent: "with receipts" },
    subhead:
      "Vantera checks each person against your fit rules, then ranks the ones who pass on their buying signals and writes down why. Only prospects who score 70 or above reach outreach, and every number shows its math.",
    metaTitle: "AI Lead Scoring for LinkedIn Prospects | Vantera",
    metaDescription:
      "Two-stage lead scoring: a hard fit gate on title, industry, and headcount, then an AI rank on buying signals, with a written rationale behind every score.",
    specs: [
      { value: "70+", label: "score to enter outreach" },
      { value: "2 stages", label: "a fit gate, then an AI rank" },
      { value: "Every score", label: "ships with written reasoning" },
      { value: "0", label: "suppressed contacts ever messaged" },
    ],
    problem: {
      title: { lead: "Stop guessing who's", accent: "worth a message" },
      body: "A title match isn't a buyer. Without a real bar, outreach goes to whoever fits a filter, and your reply rate pays for it.",
      before: [
        "Messaging everyone with the right job title",
        "Lead scores nobody can explain",
        "Warm buyers buried in a list of thousands",
        "No record of why anyone was picked",
      ],
      after: [
        "A hard fit gate before anything else",
        "An AI rank on real buying signals",
        "A written rationale behind every score",
        "Only 70+ reaches outreach",
      ],
    },
    benefitsTitle: { lead: "Scores you can read,", accent: "not just trust" },
    benefitsIntro:
      "Two stages, both visible: the rules that let a prospect in, and the signals that ranked them.",
    benefits: [
      {
        title: "A fit gate on hard rules",
        body: "Title, seniority, industry, headcount, and region are checked first. Fail a rule and the prospect never reaches enrichment or outreach.",
      },
      {
        title: "An AI rank on buying signals",
        body: "Survivors are ranked on what they're doing now: posts about the problem you solve, hiring, funding, and job changes.",
      },
      {
        title: "A rationale behind every score",
        body: "Each score comes with the agent's written reasoning and its evidence: the pain points, the trigger, and the angle to open with.",
      },
    ],
    stepsTitle: { lead: "How a prospect", accent: "earns a score" },
    steps: [
      { title: "Check the fit", body: "Rules on title, industry, size, and region filter the bulk." },
      { title: "Read the signals", body: "Posts, hiring, funding, and job changes are weighed for everyone who passes." },
      { title: "Clear the bar", body: "70 or above enters outreach. Everyone else stays out of it." },
    ],
    connects:
      "Scoring is the gate between discovery and outreach. Targeting learns from which scores turned into replies, and outreach opens with the angle the score found.",
    faqs: [
      {
        q: "How is the score calculated?",
        a: "In two stages. A deterministic gate checks fit on title, seniority, industry, headcount, and region. Prospects who pass are then ranked by AI on buying signals, and the score comes with a written rationale.",
      },
      {
        q: "What score does a prospect need?",
        a: "70 or above enters outreach by default. Anyone below it is never messaged.",
      },
      {
        q: "Can I see why someone scored high?",
        a: "Yes. Every score shows its parts and the agent's reasoning: the signals it found, the pain points they suggest, and the angle to open with.",
      },
      {
        q: "What signals does it use?",
        a: "Recent posts and comments about your problem space, hiring, funding, job changes, and company changes. Signals lift a score, but they never get anyone past the fit gate.",
      },
      {
        q: "Does it respect opt-outs?",
        a: "Always. Suppressed contacts are checked before every draft and every send, and they are never messaged again.",
      },
    ],
    ctaTitle: "Only message people who clear the bar",
    ctaBody: "Set your ICP once. Every prospect after that comes scored, explained, and ready.",
    explore: {
      title: "Know why every prospect made the list",
      links: [
        { kind: "Feature", title: "Prospect discovery", desc: "How agents find the people they score.", href: "/features/prospect-discovery" },
        { kind: "Feature", title: "Targeting that learns", desc: "How scores improve from real replies.", href: "/features/machine-learned-targeting" },
        { kind: "Guide", title: "How we prove it", desc: "How Vantera measures what it claims.", href: "/how-we-prove-it" },
        { kind: "Use case", title: "Vantera for sales teams", desc: "Pipeline without more headcount.", href: "/use-cases/for-sales-teams" },
        { kind: "Free tool", title: "LinkedIn profile analyzer", desc: "Score a profile in seconds.", href: "/tools/linkedin-profile-analyzer" },
        { kind: "Compare", title: "Why Vantera", desc: "Not another sequencer, not a black box.", href: "/why-vantera" },
      ],
      terms: [
        { label: "BANT", href: "/glossary/bant" },
        { label: "MEDDIC", href: "/glossary/meddic" },
        { label: "Discovery call", href: "/glossary/discovery-call" },
        { label: "Personalization", href: "/glossary/personalization" },
      ],
    },
  },
  {
    slug: "machine-learned-targeting",
    group: "Find buyers",
    name: "Targeting that learns",
    tagline: "Machine learning sharpens who you target, every week.",
    icon: BrainCircuit,
    eyebrow: "Machine-learned targeting",
    headline: { lead: "Targeting that", accent: "learns every week" },
    subhead:
      "Vantera studies who accepts, who replies, and who books, then shifts your outreach toward the buyers who respond. No rules to tune and no lists to rebuild: every week, the floor rises.",
    metaTitle: "Machine-Learned Targeting for LinkedIn Outreach | Vantera",
    metaDescription:
      "Vantera learns from who accepts, replies, and books, and sharpens your LinkedIn targeting every week, with no rules to tune and automatic rollback if a change does worse.",
    specs: [
      { value: "Weekly", label: "learning cycles on real outcomes" },
      { value: "3 outcomes", label: "accepted, replied, booked" },
      { value: "Auto rollback", label: "if a change performs worse" },
      { value: "0", label: "rules for you to tune" },
    ],
    problem: {
      title: { lead: "Stop freezing your targeting", accent: "on day one" },
      body: "Most tools target exactly what you guessed at setup, forever. The market moves, your best buyers shift, and the list never notices.",
      before: [
        "Targeting frozen at whatever you guessed in setup",
        "Rebuilding filters by hand when replies dry up",
        "No idea which titles or industries actually book",
        "Wins that never feed back into who you message",
      ],
      after: [
        "Every outcome feeds the model: accepted, replied, booked",
        "Profiles that respond earn more of your outreach",
        "Profiles that don't earn less, automatically",
        "A clear view of what it's testing, and why",
      ],
    },
    benefitsTitle: { lead: "A model that learns", accent: "from your results" },
    benefitsIntro:
      "It starts from what already works, tests small changes on real conversations, and keeps only what wins.",
    benefits: [
      {
        title: "Learns from real outcomes",
        body: "Connections accepted, replies that show interest, and meetings booked. Not opens, not opinions.",
      },
      {
        title: "Shifts weight toward who responds",
        body: "Titles, company sizes, industries, and signals that convert earn more of your outreach; the ones that don't earn less.",
      },
      {
        title: "Rolls back what doesn't work",
        body: "Every change is measured on real conversations. If a new version performs worse, it's rolled back automatically.",
      },
    ],
    stepsTitle: { lead: "How it gets sharper", accent: "every week" },
    steps: [
      {
        title: "Start from proven plays",
        body: "Your first messages run on targeting and plays that already work for buyers like yours.",
      },
      {
        title: "Test on a small slice",
        body: "New ideas run on a small share of new conversations, inside the same safety limits.",
      },
      {
        title: "Keep what wins",
        body: "Winners earn more of your outreach and are remembered for every conversation after.",
      },
    ],
    connects:
      "Targeting closes the engine's loop. It learns from every reply the inbox classifies and every meeting booked, then steers discovery and scoring toward the buyers who respond.",
    faqs: [
      {
        q: "What does it learn from?",
        a: "Real outcomes on your own outreach: which connection requests are accepted, which replies show interest, and which conversations turn into meetings.",
      },
      {
        q: "Do I have to set up rules?",
        a: "No. You set your ideal customer profile once. The model adjusts who gets prioritised inside it as results come in.",
      },
      {
        q: "Can it make my targeting worse?",
        a: "Every change is measured against real outcomes, and a version that performs worse is rolled back automatically.",
      },
      {
        q: "Will it reach outside my ICP?",
        a: "No. Learning happens inside the profiles you set, and your fit rules still gate every prospect.",
      },
      {
        q: "Can I see what it's testing?",
        a: "Yes. Your dashboard shows what the agents are testing right now, and why.",
      },
    ],
    ctaTitle: "Let your targeting learn from every reply",
    ctaBody: "Start with the profile you know. Vantera sharpens it every week from who actually responds.",
    explore: {
      title: "See how the learning works",
      links: [
        { kind: "Guide", title: "How it learns", desc: "The whole learning loop, in plain English.", href: "/how-it-learns" },
        { kind: "Guide", title: "Proven plays", desc: "The plays every agent starts from.", href: "/proven-plays" },
        { kind: "Feature", title: "Fit scoring", desc: "The bar the model learns inside.", href: "/features/fit-scoring" },
        { kind: "Playbooks", title: "Outbound playbooks", desc: "LinkedIn plays your agents can run.", href: "/playbooks" },
        { kind: "Use case", title: "Vantera for sales teams", desc: "Pipeline without more headcount.", href: "/use-cases/for-sales-teams" },
        { kind: "Compare", title: "Why Vantera", desc: "Not another sequencer, not a black box.", href: "/why-vantera" },
      ],
      terms: [
        { label: "Personalization", href: "/glossary/personalization" },
        { label: "Attribution", href: "/glossary/attribution" },
        { label: "Outreach automation", href: "/glossary/outreach-automation" },
      ],
    },
  },
  {
    slug: "autopilot-outreach",
    group: "Book meetings",
    name: "Autopilot outreach",
    tagline: "Openers written from real activity, sent on autopilot.",
    icon: Send,
    eyebrow: "LinkedIn outreach automation",
    headline: { lead: "Outreach that runs", accent: "on autopilot" },
    subhead:
      "Vantera writes every connection request and message from the prospect's real activity, your goal, and your own content, then sends at a safe, human pace. You set it up once; the agents do the rest.",
    metaTitle: "LinkedIn Outreach on Autopilot: Personalized Messages | Vantera",
    metaDescription:
      "Vantera writes every LinkedIn opener from the prospect's real activity and sends it on autopilot at a safe, human pace, with suppression checked before every send.",
    specs: [
      { value: "Every message", label: "written from the prospect's activity" },
      { value: CEILING_FACT, label: "invite ceiling per account" },
      { value: "0", label: "templates to write" },
      { value: SETUP, label: "to set up" },
    ],
    problem: {
      title: { lead: "Stop sending templates", accent: "nobody reads" },
      body: "A template with a first-name merge field is still a template. Buyers can tell, and so can LinkedIn when the same message goes out a thousand times.",
      before: [
        "One template, a merge field, a thousand sends",
        "Hours a week writing and sending by hand",
        "Follow-ups forgotten or sent on the wrong day",
        "Volume spikes that put your account at risk",
      ],
      after: [
        "Each opener written from what the buyer actually did",
        "Your goal and your content in every message",
        "Sending handled on autopilot, at a human pace",
        "Hard weekly ceilings no setting can raise",
      ],
    },
    benefitsTitle: { lead: "Messages that sound", accent: "like you wrote them" },
    benefitsIntro: "Each one starts from a real signal and ends with your call to action.",
    benefits: [
      {
        title: "Written from real activity",
        body: "The opener references what the prospect posted, who they're hiring, or what just changed, never a generic merge field.",
      },
      {
        title: "Your goal, your content",
        body: "Set the call to action once and add case studies or links. Every message uses them as context.",
      },
      {
        title: "Sent at a human pace",
        body: "Randomized gaps, a gradual ramp, and a hard weekly ceiling. Anything that reads robotic is rewritten before it goes.",
      },
    ],
    stepsTitle: { lead: "From signal to message,", accent: "automatically" },
    steps: [
      { title: "Pick up the signal", body: "A qualified prospect posts, hires, or raises." },
      { title: "Write the opener", body: "The agent writes from that moment, your goal, and your content." },
      { title: "Send it safely", body: "Suppression is checked, then it sends inside your account's pacing." },
    ],
    connects:
      "Outreach sits in the middle of the engine. It writes to the prospects scoring clears, hands replies to the inbox, and every outcome teaches targeting who to reach next.",
    faqs: [
      {
        q: "Do I have to approve every message?",
        a: "No. Vantera runs on autopilot: agents write each message and send it at a safe, human pace. You can pause an agent or step into any conversation anytime.",
      },
      {
        q: "How is each message personalized?",
        a: "Each opener is written from the prospect's real activity, like a post, a new hire, or a funding round, plus your call to action and any content you add.",
      },
      {
        q: "What does it send?",
        a: "Connection requests and messages from your own connected LinkedIn account, at a human pace.",
      },
      {
        q: "How many invites does it send?",
        a: `Up to the weekly ceiling of ${CEILING_FACT} per account, with randomized pacing and a gradual ramp for newer accounts. The ceiling can't be raised.`,
      },
      {
        q: "Will it message someone who opted out?",
        a: "Never. Suppression is checked before every draft and again before every send.",
      },
    ],
    ctaTitle: "Put your LinkedIn outreach on autopilot",
    ctaBody: "Set your goal once. Every opener after that is written from a real signal and sent at a safe pace.",
    explore: {
      title: "Write openers people answer",
      links: [
        { kind: "Free tool", title: "Connection request generator", desc: "Notes people actually accept.", href: "/tools/connection-request-generator" },
        { kind: "Free tool", title: "Cold outreach generator", desc: "A first message built on a real reason.", href: "/tools/cold-outreach-generator" },
        { kind: "Feature", title: "Account safety", desc: "The limits every send stays inside.", href: "/features/account-safety" },
        { kind: "Use case", title: "Vantera for agencies", desc: "Every client, one dashboard.", href: "/use-cases/for-agencies" },
        { kind: "Guide", title: "Proven plays", desc: "The plays every agent starts from.", href: "/proven-plays" },
        { kind: "Compare", title: "Why Vantera", desc: "Not another sequencer, not a black box.", href: "/why-vantera" },
      ],
      terms: [
        { label: "Connection request", href: "/glossary/connection-request" },
        { label: "Personalization", href: "/glossary/personalization" },
        { label: "Outreach automation", href: "/glossary/outreach-automation" },
        { label: "Multi-touch campaign", href: "/glossary/multi-touch-campaign" },
      ],
    },
  },
  {
    slug: "unified-inbox",
    group: "Book meetings",
    name: "Unified inbox",
    tagline: "Every reply classified, warm ones first, answered on autopilot.",
    icon: MessagesSquare,
    eyebrow: "LinkedIn reply management",
    headline: { lead: "One inbox for", accent: "every reply" },
    subhead:
      "Replies from every connected LinkedIn account land in one inbox, classified and sorted warm-first. The agent answers on autopilot and keeps each conversation moving toward a meeting, and you can step in anytime.",
    metaTitle: "Unified LinkedIn Inbox with AI Reply Handling | Vantera",
    metaDescription:
      "Every LinkedIn reply in one inbox, classified and sorted warm-first, answered on autopilot, with opt-outs added to your suppression list automatically.",
    specs: [
      { value: "1 inbox", label: "for every connected sender" },
      { value: "Warm first", label: "replies sorted by intent" },
      { value: "Automatic", label: "opt-outs added to suppression" },
      { value: "Anytime", label: "step into any conversation" },
    ],
    problem: {
      title: { lead: "Stop losing warm replies", accent: "in the noise" },
      body: "Replies arrive across accounts and threads, mixed in with everything else. The warm ones go cold while you dig.",
      before: [
        "Replies scattered across LinkedIn accounts",
        "Warm leads buried under polite no-thank-yous",
        "Hours a week typing the same next step",
        "Opt-outs tracked in a spreadsheet, if at all",
      ],
      after: [
        "Every reply in one inbox",
        "Classified and sorted, warm ones first",
        "The next move answered on autopilot",
        "“Not interested” suppressed automatically",
      ],
    },
    benefitsTitle: { lead: "An inbox that knows", accent: "what to do next" },
    benefitsIntro: "It reads every reply, sorts it, and keeps each conversation moving.",
    benefits: [
      {
        title: "Classified the moment it lands",
        body: "Interested, a question, not now, or not interested: every reply is read and labelled, so warm leads surface first.",
      },
      {
        title: "Answered on autopilot",
        body: "The agent replies with the next step toward a meeting, using your goal and your content.",
      },
      {
        title: "Opt-outs handled for you",
        body: "“Not interested” goes straight onto your suppression list, so that person is never messaged again.",
      },
    ],
    stepsTitle: { lead: "From reply to", accent: "booked meeting" },
    steps: [
      { title: "A reply lands", body: "From any connected account, straight into one inbox." },
      { title: "It's classified", body: "Warm replies rise to the top; opt-outs are suppressed." },
      { title: "The agent answers", body: "It moves the conversation toward a meeting. Step in whenever you like." },
    ],
    connects:
      "The inbox is where outreach pays off. Every classified reply teaches targeting what works, and won conversations go to your CRM.",
    faqs: [
      {
        q: "Which replies does it handle?",
        a: "Replies to your agents' outreach, on every LinkedIn account you connect.",
      },
      {
        q: "Does the agent reply for me?",
        a: "Yes. It answers on autopilot with the next step toward a meeting. You can take over any conversation at any time.",
      },
      {
        q: "What happens when someone says no?",
        a: "“Not interested” adds them to your suppression list automatically, and they're never messaged again.",
      },
      {
        q: "Where do won conversations go?",
        a: "Every closed win lands in your CRM automatically — HubSpot, Salesforce, or GoHighLevel — with an alert in Slack or monday.com if you connect one.",
      },
    ],
    ctaTitle: "Never let a warm reply go cold",
    ctaBody: "Every reply in one place, sorted warm-first and answered on autopilot.",
    explore: {
      title: "Turn replies into meetings",
      links: [
        { kind: "Free tool", title: "Follow-up message generator", desc: "A follow-up that adds something new.", href: "/tools/follow-up-message-generator" },
        { kind: "Free tool", title: "Breakup message generator", desc: "Close the loop without burning the bridge.", href: "/tools/breakup-message-generator" },
        { kind: "Feature", title: "CRM sync", desc: "Where won conversations go next.", href: "/features/crm-sync" },
        { kind: "Use case", title: "Vantera for sales teams", desc: "Pipeline without more headcount.", href: "/use-cases/for-sales-teams" },
        { kind: "Feature", title: "Autopilot outreach", desc: "The openers these replies answer.", href: "/features/autopilot-outreach" },
        { kind: "Playbooks", title: "Outbound playbooks", desc: "LinkedIn plays your agents can run.", href: "/playbooks" },
      ],
      terms: [
        { label: "Objection handling", href: "/glossary/objection-handling" },
        { label: "Discovery call", href: "/glossary/discovery-call" },
        { label: "Multi-touch campaign", href: "/glossary/multi-touch-campaign" },
      ],
    },
  },
  {
    slug: "account-safety",
    group: "Book meetings",
    name: "Account safety",
    tagline: "Hard ceilings, human pacing, and a login we never see.",
    icon: ShieldCheck,
    eyebrow: "LinkedIn automation safety",
    headline: { lead: "Built to keep", accent: "your account safe" },
    subhead:
      "Your login never touches Vantera. Every send stays inside a hard weekly ceiling, paced like a person, with a gradual ramp for newer accounts and an automatic pause the moment LinkedIn asks for a check.",
    metaTitle: "Is LinkedIn Automation Safe? Account Safety | Vantera",
    metaDescription:
      "Hosted LinkedIn sign-in, a hard weekly invite ceiling, randomized human pacing, a gradual warmup, and auto-pause on security checks — safety Vantera can't switch off.",
    specs: [
      { value: CEILING_FACT, label: "invite ceiling, not configurable above it" },
      { value: "0", label: "passwords stored by Vantera" },
      { value: "Gradual", label: "weekly ramp for newer accounts" },
      { value: "Auto-pause", label: "on any security check" },
    ],
    problem: {
      title: { lead: "Stop trading your account", accent: "for volume" },
      body: "Most restrictions come from volume spikes and robotic timing, not from automation itself. A tool that lets you send hundreds of invites a day is a liability.",
      before: [
        "Volume sliders that go far past safe",
        "Sends fired on the second, around the clock",
        "New accounts blasting invites on day one",
        "A shared password in a browser extension",
      ],
      after: [
        "A hard weekly ceiling no setting can raise",
        "Randomized, human-like gaps between actions",
        "A gradual ramp for newer accounts",
        "Hosted sign-in: your password never touches Vantera",
      ],
    },
    benefitsTitle: { lead: "Safety you", accent: "can't switch off" },
    benefitsIntro:
      "The limits live in the scheduler itself, so neither you nor we can push past them.",
    benefits: [
      {
        title: "A login we never see",
        body: CUSTODY_SENTENCE,
      },
      {
        title: "Hard ceilings, human pacing",
        body: "A weekly invite ceiling, randomized gaps between actions, and volume spread across your connected senders.",
      },
      {
        title: "A ramp, and a pause",
        body: "Newer accounts ramp up gradually, and any security check pauses everything until it's resolved.",
      },
    ],
    stepsTitle: { lead: "Safe from", accent: "the first send" },
    steps: [
      { title: "Connect securely", body: "Sign in through LinkedIn's own flow. Vantera never sees your password." },
      { title: "Ramp gradually", body: "Volume builds week by week for newer accounts." },
      { title: "Send inside the ceiling", body: "Randomized pacing, hard limits, and an automatic pause on any check." },
    ],
    connects:
      "Safety wraps the whole engine. Every send outreach makes and every reply the inbox answers goes through the same ceilings and pacing.",
    faqs: [
      {
        q: "Is LinkedIn automation safe?",
        a: "It's safe when it respects limits and paces like a person. Vantera enforces a hard weekly ceiling, randomized pacing, and a gradual ramp for newer accounts, and none of them can be raised past the safe line.",
      },
      {
        q: "Does Vantera store my LinkedIn password?",
        a: `No. ${CUSTODY_SENTENCE}`,
      },
      {
        q: "What happens if LinkedIn asks for a security check?",
        a: "Everything pauses automatically until you've resolved it.",
      },
      {
        q: "Can I raise the limits?",
        a: "No. The ceilings can't be raised — not by you, not by us.",
      },
      {
        q: "What if I connect more than one account?",
        a: "Volume is spread across your connected senders, so no single account carries risky volume.",
      },
    ],
    ctaTitle: "Automate LinkedIn without risking your account",
    ctaBody: "Hard ceilings, human pacing, and a login we never see. Built in, not bolted on.",
    explore: {
      title: "Keep your account safe",
      links: [
        { kind: "Guide", title: "How pacing works", desc: "The ceilings and pacing, in detail.", href: "/safety" },
        { kind: "Article", title: "Is LinkedIn automation safe?", desc: "What actually gets accounts restricted.", href: "/blog/is-linkedin-automation-safe" },
        { kind: "Feature", title: "Autopilot outreach", desc: "The sends these limits protect.", href: "/features/autopilot-outreach" },
        { kind: "Free tool", title: "LinkedIn SSI score checker", desc: "See how LinkedIn rates your activity.", href: "/tools/linkedin-ssi-score-checker" },
        { kind: "Policy", title: "Opt-out", desc: "How anyone can stop hearing from Vantera users.", href: "/opt-out" },
        { kind: "Compare", title: "Why Vantera", desc: "Not another sequencer, not a black box.", href: "/why-vantera" },
      ],
      terms: [
        { label: "LinkedIn SSI", href: "/glossary/linkedin-ssi" },
        { label: "Connection request", href: "/glossary/connection-request" },
        { label: "Outreach automation", href: "/glossary/outreach-automation" },
      ],
    },
  },
  {
    slug: "crm-sync",
    group: "Book meetings",
    name: "CRM sync",
    tagline: "Every win lands in your CRM, with an alert in Slack.",
    icon: RefreshCw,
    eyebrow: "LinkedIn to CRM sync",
    headline: { lead: "From LinkedIn reply", accent: "to CRM deal" },
    subhead:
      "When a conversation is won, Vantera creates the contact and the deal in your CRM: HubSpot, Salesforce, or GoHighLevel. Slack and monday.com hear about it, and Claude can run Vantera over MCP. Vantera isn't a CRM; it feeds the one you already run.",
    metaTitle: "Sync LinkedIn Leads to HubSpot, Salesforce & GoHighLevel | Vantera",
    metaDescription:
      "Every won LinkedIn conversation lands in HubSpot, Salesforce, or GoHighLevel as a contact and a deal, with win alerts in Slack or monday.com. Run Vantera from Claude over MCP.",
    specs: [
      { value: "3 CRMs", label: "HubSpot, Salesforce, and GoHighLevel" },
      { value: "Contact + deal", label: "created for every closed win" },
      { value: "Automatic", label: "no copy-paste, no export" },
      { value: "2 alerts", label: "Slack messages and monday.com items" },
    ],
    problem: {
      title: { lead: "Stop retyping leads", accent: "into your CRM" },
      body: "The moment a LinkedIn conversation turns real, someone has to copy it into the CRM. Usually late, usually missing half the story.",
      before: [
        "Copying names and notes from LinkedIn by hand",
        "Deals logged days after the meeting",
        "A pipeline that doesn't match what's really happening",
        "Wins the rest of the team hears about last",
      ],
      after: [
        "Every closed win pushed to your CRM automatically",
        "A contact and a deal created for you",
        "Fields mapped to the way your CRM is set up",
        "Your team told in Slack or monday.com",
      ],
    },
    benefitsTitle: { lead: "Your CRM, kept current", accent: "by your agents" },
    benefitsIntro: "Vantera finds, qualifies, and converses. Your CRM keeps the record.",
    benefits: [
      {
        title: "Contacts and deals, created for you",
        body: "HubSpot, Salesforce, and GoHighLevel each get a contact and a deal for every closed win, mapped to your fields.",
      },
      {
        title: "Wins posted where your team works",
        body: "Slack gets a message and monday.com gets a board item the moment a deal lands.",
      },
      {
        title: "Run it from Claude",
        body: "Connect Claude over MCP and work your pipeline from your chat window.",
      },
    ],
    stepsTitle: { lead: "Three steps to", accent: "a current CRM" },
    steps: [
      { title: "Connect your CRM", body: "Authorize HubSpot, Salesforce, or GoHighLevel from your settings." },
      { title: "Win the conversation", body: "Agents carry it on LinkedIn until it's won." },
      { title: "It lands as a deal", body: "A contact and a deal appear in your CRM, and Slack hears about it." },
    ],
    connects:
      "CRM sync is where the engine hands off. Discovery, scoring, outreach, and the inbox all exist to put a won conversation into the system your team already runs on.",
    faqs: [
      {
        q: "Which CRMs does Vantera support?",
        a: "HubSpot, Salesforce, and GoHighLevel. Every closed win creates a contact and a deal, so your pipeline stays current without manual data entry.",
      },
      {
        q: "Can my team get notified?",
        a: "Yes. Connect Slack to get a message, or monday.com to get a board item, whenever a deal lands.",
      },
      {
        q: "Is Vantera a CRM?",
        a: "No. Vantera does the finding, qualifying, and outreach, then hands won conversations to the CRM your team already uses.",
      },
      {
        q: "Can I choose which fields get filled?",
        a: "Yes. The defaults map the contact and the deal for you, and you can override which of your CRM's fields each value lands in.",
      },
      {
        q: "Can I use Vantera from Claude?",
        a: "Yes. Connect Claude over MCP and run Vantera from your chat window. The Claude & MCP guide walks through setup.",
      },
    ],
    ctaTitle: "Turn LinkedIn conversations into CRM pipeline",
    ctaBody: "Agents win the conversation; your CRM gets the contact and the deal, without the copy-paste.",
    explore: {
      title: "Connect Vantera to your stack",
      links: [
        { kind: "Integration", title: "Claude & MCP", desc: "Run Vantera from your chat window.", href: "/claude-linkedin-mcp" },
        { kind: "Feature", title: "Unified inbox", desc: "Where the conversations are won.", href: "/features/unified-inbox" },
        { kind: "Use case", title: "Vantera for sales teams", desc: "Pipeline without more headcount.", href: "/use-cases/for-sales-teams" },
        { kind: "Use case", title: "Vantera for agencies", desc: "Every client, one dashboard.", href: "/use-cases/for-agencies" },
        { kind: "Guide", title: "How it learns", desc: "How every outcome feeds back in.", href: "/how-it-learns" },
        { kind: "Compare", title: "Why Vantera", desc: "Not another sequencer, not a black box.", href: "/why-vantera" },
      ],
      terms: [
        { label: "Attribution", href: "/glossary/attribution" },
        { label: "CAC", href: "/glossary/cac" },
        { label: "LTV", href: "/glossary/ltv" },
      ],
    },
  },
];

/** The engine, in the order a prospect moves through it. */
export const ENGINE_ORDER = [
  "prospect-discovery",
  "fit-scoring",
  "machine-learned-targeting",
  "autopilot-outreach",
  "unified-inbox",
  "account-safety",
  "crm-sync",
] as const;

export type FeatureSlug = (typeof ENGINE_ORDER)[number];

export function getFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

export function featuresIn(group: FeatureGroup): Feature[] {
  return FEATURES.filter((f) => f.group === group);
}
