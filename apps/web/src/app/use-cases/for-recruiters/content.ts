import type { UseCaseContent } from "@/components/landing/use-case/types";

/**
 * "For Recruiters" — a market-expansion page. Vantera's engine (find in-market people, fit-
 * score them, personalize from real activity, pace safely, approve every send) applied to
 * candidate sourcing on LinkedIn. HONESTY GUARDRAILS: no fabricated ATS integrations — the
 * only real sync targets are HubSpot/Pipedrive, framed as "your CRM". Intent is framed
 * softly as "signals they may be open to a move" (no claim of a bespoke open-to-work detector).
 */
export const RECRUITERS_CONTENT: UseCaseContent = {
  slug: "for-recruiters",
  seo: {
    title: "LinkedIn Automation for Recruiters — Source & Reach Candidates | Vantera",
    description:
      "Source and reach qualified candidates on LinkedIn without the spam. Vantera finds people who fit the role, personalizes every message from their real activity, and paces safely — you approve every send. More replies, zero account risk.",
  },

  hero: {
    eyebrow: "For recruiters",
    headlinePre: "Fill every role with",
    headlineHighlight: "qualified candidates",
    headlinePost: ".",
    sub: "Vantera runs candidate outreach on LinkedIn for you — surfacing people who fit the role, personalizing every message from their real activity, and pacing safely so your account stays clean. You approve every send. More replies from the right people, less time sourcing.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "See how it works", href: "#how-it-works" },
    trust: ["3-day free trial", "Safe pacing built in", "You approve every message"],
    visual: {
      title: "Requisitions",
      period: "This week",
      funnel: [
        { label: "Sourced", value: 960 },
        { label: "Qualified", value: 268 },
        { label: "Contacted", value: 240 },
        { label: "Replied", value: 88 },
        { label: "Interview", value: 26 },
      ],
      reps: [
        { initials: "BE", name: "Senior Backend", role: "Eng · Berlin", booked: 14, trend: [4, 6, 8, 10, 12, 14], delta: "+21%", tint: "#1877f2" },
        { initials: "PM", name: "Product Manager", role: "Product · Remote", booked: 11, trend: [3, 5, 7, 8, 10, 11], delta: "+18%", tint: "#5E6AD2" },
        { initials: "DS", name: "Data Scientist", role: "Data · NYC", booked: 9, trend: [2, 4, 5, 7, 8, 9], delta: "+26%", tint: "#0C9FCE" },
      ],
      replyRate: 29,
      replyRateLabel: "Response rate",
      bookedTrend: [10, 14, 13, 19, 22, 26],
      bookedDelta: "+30%",
      toast: {
        name: "Alex Rivera",
        role: "Senior Backend Engineer",
        fit: 93,
        signal: "Updated headline to 'open to opportunities' · 5h ago",
      },
      leaderboardTitle: "Open roles · pipeline",
      leaderboardTrendLabel: "6-week trend",
      funnelCaption: "Sourced → Interview",
      toastLabel: "New qualified candidate",
    },
  },

  problem: {
    eyebrow: "The problem",
    title: "Great candidates ignore generic outreach.",
    subtitle:
      "The best people get messaged every day. Blasting templated InMail buries you in the noise — and the volume risks the account you source from.",
    items: [
      {
        icon: "clock",
        title: "Sourcing eats the day",
        body: "Hours in search filters and copy-pasted messages is time not spent talking to candidates or closing roles.",
        costValue: "~10 hrs",
        costLabel: "lost to manual sourcing / wk",
      },
      {
        icon: "outreach",
        title: "Templated outreach gets ignored",
        body: "Strong candidates see through merge-tag spam — reply rates crater and roles stay open longer.",
        costValue: "Ignored",
        costLabel: "when it reads like a blast",
      },
      {
        icon: "safety",
        title: "Volume flags your account",
        body: "Mass messages and invites get the account you source from restricted — and your whole pipeline freezes.",
        costValue: "1 flag",
        costLabel: "freezes your sourcing",
      },
      {
        icon: "filter",
        title: "Wrong-fit outreach wastes everyone's time",
        body: "No fit gate means chasing people who were never right for the role — and annoying good candidates for later.",
        costValue: "Noise",
        costLabel: "instead of a shortlist",
      },
    ],
    kicker: "Reach fewer, better-fit candidates with messages worth replying to — safely, on your approval.",
  },

  compare: {
    eyebrow: "Before / after",
    title: "Two ways to source on LinkedIn.",
    subtitle:
      "One burns your hours and risks your account for outreach people ignore. The other runs itself — and only reaches candidates who actually fit.",
    before: {
      heading: "Manual sourcing",
      caption: "Every role, every day",
      steps: [
        { label: "Boolean-search for hours" },
        { label: "Guess who's actually open" },
        { label: "Copy-paste InMail templates" },
        { label: "Blast and hope for replies" },
        { label: "Chase follow-ups by hand" },
        { label: "Risk the account on volume" },
      ],
    },
    after: {
      heading: "With Vantera",
      caption: "Your AI sourcer, in the background",
      steps: [
        { label: "Agents surface fitting candidates", meta: "24/7" },
        { label: "Scored against the role profile", meta: "≥ 70 to pass" },
        { label: "Messages from their real activity" },
        { label: "You approve in one click" },
        { label: "Safe pacing protects your account" },
        { label: "Replies captured, follow-ups handled" },
      ],
    },
  },

  benefits: {
    eyebrow: "Why recruiters run it",
    title: "More replies from the right people. Zero account risk.",
    subtitle:
      "Fewer, better-fit candidates, reached with messages worth answering — while the account you source from stays clean.",
    items: [
      {
        icon: "clock",
        value: "3×",
        title: "More time with candidates",
        body: "Sourcing and drafting run themselves — spend your day in conversations, not in search filters.",
      },
      {
        icon: "filter",
        value: "≥ 70",
        title: "A shortlist, not a list",
        body: "Every candidate is scored against the role profile, so you reach fits — not everyone with the title.",
        trend: [4, 5, 6, 7, 8, 9],
      },
      {
        icon: "safety",
        value: "0",
        title: "Account restrictions",
        body: "Safe pacing enforced — source at volume without the account you rely on getting flagged.",
        trend: [40, 55, 62, 70, 78, 84],
      },
      {
        icon: "outreach",
        value: "Personal",
        title: "Not a merge tag",
        body: "Every message references the candidate's real work and activity, so the right people actually reply.",
      },
    ],
  },

  features: {
    eyebrow: "The platform",
    title: "An AI sourcer that works while you close roles.",
    subtitle:
      "The whole outreach motion — finding fits, qualifying, personalizing, safe sending — run for you, with you approving every message.",
    items: [
      {
        icon: "prospecting",
        label: "Sourcing",
        title: "Finds candidates who fit the role",
        body: "Agents match people to your role profile and surface signals they may be open to a move — so effort lands on the strongest fits.",
        chips: ["fit signals", "role profile", "lookalikes"],
      },
      {
        icon: "filter",
        label: "Qualification",
        title: "Only strong fits pass",
        body: "A deterministic fit gate plus an AI rank score every candidate on fit and signals — only the best reach your queue.",
        chips: ["fit + signals", "score ≥ 70", "a real shortlist"],
      },
      {
        icon: "outreach",
        label: "Outreach",
        title: "Messages from their real work",
        body: "Every draft is written from the candidate's own projects, posts, and activity — never a template — so the right people reply.",
        chips: ["context-aware", "personalized", "reply-worthy"],
      },
      {
        icon: "safety",
        label: "Multi-sender distribution",
        title: "Safe scale across your seats",
        body: "Volume is spread across every connected sender inside human-like limits, so your team sources at scale without any one account carrying risk. Built in, never a setting you can push past.",
        chips: ["per-account limits", "human pacing", "more safe reach"],
        highlight: true,
      },
      {
        icon: "replies",
        label: "Shared review queue",
        title: "Approve outreach in one place",
        body: "Every drafted message and reply lands in one queue your team works together — approve, edit, or skip, nothing slips through.",
        chips: ["one queue", "one-click approve", "full reply visibility"],
      },
      {
        icon: "crm",
        label: "CRM sync",
        title: "Clean handoff to your CRM",
        body: "Interested candidates flow into your CRM — with native connections to HubSpot and Pipedrive — so nothing gets lost between LinkedIn and your pipeline.",
        chips: ["HubSpot", "Pipedrive", "auto-sync"],
      },
    ],
  },

  review: {
    eyebrow: "See it in action",
    title: "Every message, from their real work — you just approve.",
    subtitle:
      "This is the queue you live in. Pick a candidate to see the signal that surfaced them, why they fit, and the message — then approve, edit, or skip.",
    drafts: [
      {
        initials: "AR",
        name: "Alex Rivera",
        role: "Senior Backend Engineer",
        company: "Stripe",
        fit: 93,
        tint: "#1877f2",
        signal: "Updated headline to 'open to opportunities' · 5h ago",
        insights: [
          { label: "Fit", value: "Go + high-scale infra, your stack" },
          { label: "Signal", value: "Just flagged open to a move" },
          { label: "Angle", value: "Team and scope match" },
        ],
        message:
          "Hi Alex — saw you're open to something new. Your work on payment infra lines up closely with a backend role I'm helping fill (Go, high-scale, small team). Happy to share the details if you're curious — no pressure.",
      },
      {
        initials: "MC",
        name: "Maya Chen",
        role: "Product Manager",
        company: "Notion",
        fit: 89,
        tint: "#5E6AD2",
        signal: "Posted about wanting more 0-to-1 ownership · 2d ago",
        insights: [
          { label: "Fit", value: "0-to-1 PM background" },
          { label: "Signal", value: "Wants more ownership" },
          { label: "Angle", value: "Founding-PM scope" },
        ],
        message:
          "Hi Maya — your post on wanting more 0-to-1 ownership stuck with me. I'm helping a team fill a founding-PM role that's exactly that scope. Worth a quick look? Happy to send the specifics.",
      },
      {
        initials: "SN",
        name: "Sam Ndiaye",
        role: "Data Scientist",
        company: "Spotify",
        fit: 91,
        tint: "#0C9FCE",
        signal: "Commented on a thread about big-company bureaucracy · 1d ago",
        insights: [
          { label: "Fit", value: "ML at scale" },
          { label: "Signal", value: "Frustrated with big-co pace" },
          { label: "Angle", value: "Smaller team, real impact" },
        ],
        message:
          "Hi Sam — caught your comment on big-company pace. A team I work with is hiring a DS who wants impact without the bureaucracy — your ML background fits well. Open to hearing more?",
      },
    ],
  },

  pipeline: {
    eyebrow: "How it works",
    title: "From a role profile to a booked interview.",
    subtitle: "One system runs the whole motion — and stops at your approval, every time.",
    nodes: [
      { icon: "radar", label: "Identify", line: "Role fit + open-to-move signals", metric: "24/7 scan" },
      { icon: "filter", label: "Qualify", line: "Scored to the role profile", metric: "≥ 70 to pass" },
      { icon: "outreach", label: "Draft", line: "From their real work", metric: "0 templates" },
      { icon: "control", label: "Approve", line: "One-click approve or edit", metric: "100% yours" },
      { icon: "safety", label: "Send", line: "Safe, human-like pacing", metric: "≤ 100 / wk" },
      { icon: "replies", label: "Converse", line: "Replies captured + drafted", metric: "full visibility" },
      { icon: "calendar", label: "Interview", line: "Candidates booked in", metric: "on the calendar" },
      { icon: "crm", label: "Sync", line: "Warm candidates to your CRM", metric: "HubSpot · Pipedrive" },
    ],
    howto: [
      { name: "Identify candidates who fit", text: "Vantera's Scout agent matches people on LinkedIn to your role profile and surfaces signals they may be open to a move." },
      { name: "Qualify against the role", text: "Each candidate is scored on fit and signals; only those scoring 70 or above enter outreach." },
      { name: "Draft from their real work", text: "The Outreach agent writes each message from the candidate's own projects and activity — never a template." },
      { name: "Approve the send", text: "Every draft waits in a review queue for you to approve, edit, or skip before anything sends." },
      { name: "Send with safe pacing", text: "Approved messages send within human-like limits spread across your seats to keep the account safe." },
      { name: "Book and sync", text: "Replies are captured and drafted, interviews land on the calendar, and interested candidates sync to your CRM." },
    ],
  },

  outcomes: {
    eyebrow: "Outcomes",
    title: "What recruiters see.",
    subtitle:
      "Directional figures from recruiters running quality-first candidate outreach — more replies from the right people, on accounts that stay safe.",
    metrics: [
      { value: 3.3, decimals: 1, suffix: "×", label: "reply rate vs. templates", caption: "Messages from real work, not merge tags." },
      { value: 1, suffix: "wk", label: "to first replies", caption: "Agents work the moment they deploy." },
      { value: 0, label: "account restrictions", caption: "Safe pacing enforced, never optional." },
      { value: 10, suffix: "hrs", label: "reclaimed / week", caption: "Sourcing you used to do by hand." },
    ],
    quote: {
      text: "The messages actually reference the candidate's work, so the right people reply instead of ignoring me. And I've sourced for months without a single account flag.",
      name: "Nadia Haddad",
      role: "Talent Lead",
      company: "Northbeam",
      initials: "NH",
    },
  },

  roi: {
    eyebrow: "Business impact",
    title: "What could this add to your placements?",
    subtitle: "Move the sliders to your desk. Illustrative — but the shape of the win holds.",
    reps: { min: 1, max: 40, default: 4 },
    dealSize: { min: 2000, max: 50000, step: 1000, default: 18000 },
    meetings: { min: 1, max: 30, default: 8, label: "Qualified candidates / recruiter / month" },
    assumptions:
      "Illustrative only. Assumes the qualified candidates above per recruiter each month, a 25% candidate-to-placement rate, and ~10 hours/recruiter/week reclaimed from manual sourcing. Results depend on your roles, market, and process.",
    monthlyCost: 45,
    repsLabel: "Recruiters",
    dealSizeLabel: "Average placement fee",
    pipelineLabel: "Placement value / month",
    meetingsOutputLabel: "Qualified candidates / mo",
    hoursLabel: "Hours reclaimed / week",
    equivalentUnit: "full-time sourcers",
    equivalentTail: "without adding headcount.",
  },

  faq: {
    eyebrow: "FAQ",
    title: "Questions recruiters ask.",
    subtitle: "Account safety, personalization, fit, and where candidates land — answered straight.",
    items: [
      {
        q: "Is this safe for the LinkedIn account I source from?",
        a: "Yes. Safe pacing is enforced, not optional: your account ramps gradually, stays under a hard weekly ceiling, and every action fires with human-like timing, spread across your seats. Treat the limits as protection for the account your pipeline depends on — they can't be pushed past.",
      },
      {
        q: "Will candidates know it's automated?",
        a: "No. Every message is drafted from the candidate's own work and activity — a project, a post, a signal — not a merge tag. A humanizer check flags anything that reads automated before it hits your queue, so what you send sounds personal, because it is.",
      },
      {
        q: "Do I approve every message?",
        a: "Yes by default. Agents draft, you approve, edit, or skip, and nothing sends until you sign off. When you trust the drafts for a role, switch to full-auto and it sends clean messages on its own, routing anything questionable back to you.",
      },
      {
        q: "How does it know who's a fit?",
        a: "You define the role profile; Vantera scores every candidate on fit and on signals they may be open to a move, and only those clearing the bar reach your queue. You get a shortlist worth messaging, not a raw search dump.",
      },
      {
        q: "How is this different from LinkedIn Recruiter or InMail blasts?",
        a: "Volume tools help you send more messages. Vantera decides who's worth reaching and writes each message from the candidate's real activity, then waits for your approval — so the right people reply and your account stays safe. It's the quality of outreach, not the quantity of sends.",
      },
      {
        q: "Does it connect to my ATS or CRM?",
        a: "Interested candidates sync into your CRM, with native connections to HubSpot and Pipedrive, so nothing gets lost between LinkedIn and your pipeline. Vantera handles the sourcing and outreach and hands the warm conversations to the system you track people in.",
      },
      {
        q: "How fast will I see replies?",
        a: "Agents work the moment they're deployed, so most recruiters see first replies within the first week. Volume ramps deliberately to keep your account safe, so it builds over the first few weeks rather than spiking on day one.",
      },
      {
        q: "What does it cost?",
        a: "Starter is $45/month to get one recruiter running account-safe candidate outreach. Plans scale with your hiring volume, not a long-term contract, so you can change or cancel anytime.",
      },
    ],
  },

  finalCta: {
    eyebrow: "Get started",
    title: "The candidate you need is on LinkedIn — and getting spammed by everyone else.",
    urgency:
      "Every day a role stays open, the best people get hired elsewhere. Deploy candidate outreach that actually gets replies — live in minutes, first replies this week.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "See pricing", href: "/#pricing" },
    reassurance: ["3-day free trial", "Safe pacing built in", "You approve every message"],
  },
};
