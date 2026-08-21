import type { UseCaseContent } from "@/components/landing/use-case/types";

/**
 * "For Founders" — founder-led sales. Same product, angled at the solo/early operator who
 * can't afford an SDR and can't risk their one LinkedIn account. Grounded in the real
 * product (Scout + Outreach, ≥70 gate, approve-every-send, safe pacing, HubSpot/Pipedrive).
 * The differentiator card uses the single-account "pace" mock (one account, not multi-sender).
 */
export const FOUNDERS_CONTENT: UseCaseContent = {
  slug: "for-founders",
  seo: {
    title: "LinkedIn Automation for Founders — Founder-Led Sales on Autopilot | Vantera",
    description:
      "Pipeline while you build. Vantera runs founder-led LinkedIn outreach for you — finds in-market buyers, qualifies them against your ICP, and drafts every message in your voice. You approve in minutes a day. No SDR hire required.",
  },

  hero: {
    eyebrow: "For founders",
    headlinePre: "Your first sales hire is an",
    headlineHighlight: "AI SDR team",
    headlinePost: ".",
    sub: "You don't have time to prospect and can't afford an SDR yet. Vantera runs founder-led outreach on your LinkedIn — surfacing in-market buyers, qualifying them against your ICP, and drafting every message in your voice. You approve a few minutes a day. Pipeline builds while you build the product.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "See how it works", href: "#how-it-works" },
    trust: ["7-day free trial", "Live in ~15 minutes", "You approve every message"],
    visual: {
      title: "Your pipeline",
      period: "This week",
      funnel: [
        { label: "Sourced", value: 480 },
        { label: "Qualified", value: 118 },
        { label: "Contacted", value: 104 },
        { label: "Replied", value: 41 },
        { label: "Booked", value: 14 },
      ],
      reps: [
        { initials: "DM", name: "Dana Meyer", role: "VP Sales · Northwind", booked: 94, trend: [70, 74, 80, 86, 90, 94], delta: "+intent", tint: "#1877f2" },
        { initials: "PN", name: "Priya Nair", role: "RevOps · Cadence", booked: 91, trend: [64, 70, 76, 82, 88, 91], delta: "+intent", tint: "#5E6AD2" },
        { initials: "LR", name: "Luis Ramos", role: "Head of Sales · Meridian", booked: 88, trend: [60, 66, 72, 80, 85, 88], delta: "+intent", tint: "#0C9FCE" },
      ],
      replyRate: 41,
      replyRateLabel: "Reply rate",
      bookedTrend: [3, 5, 4, 8, 10, 14],
      bookedDelta: "+40%",
      toast: {
        name: "Dana Meyer",
        role: "VP Sales · Northwind",
        fit: 94,
        signal: "Posted about switching off a manual sales process · 3h ago",
      },
      leaderboardTitle: "Booked · fit score",
      leaderboardTrendLabel: "6-wk intent",
      funnelCaption: "Sourced → Booked",
      toastLabel: "New qualified lead",
    },
  },

  problem: {
    eyebrow: "The problem",
    title: "You're the founder, the product, and the sales team.",
    subtitle:
      "Prospecting is the first thing that slips when you're building — and the DIY tools that promise to fix it put your name and your one LinkedIn account on the line.",
    items: [
      {
        icon: "clock",
        title: "Selling steals time from building",
        body: "Every hour hand-prospecting on LinkedIn is an hour not shipping — so outreach happens in bursts, then stops.",
        costValue: "Stop-start",
        costLabel: "outreach that never compounds",
      },
      {
        icon: "safety",
        title: "Your personal account is the asset",
        body: "DIY blasters push volume that gets your one profile restricted — the account your whole network and reputation live on.",
        costValue: "1",
        costLabel: "account you can't afford to lose",
      },
      {
        icon: "outreach",
        title: "Generic outreach burns your name",
        body: "Templated spray to your own network reads as desperate — it costs you the reputation a founder actually sells on.",
        costValue: "1st",
        costLabel: "impression, spent on spam",
      },
      {
        icon: "users",
        title: "Too early to hire an SDR",
        body: "A good SDR is $70k+ and months of ramp — capital and time you rarely have before there's pipeline to justify it.",
        costValue: "$70k+",
        costLabel: "for a hire you can't de-risk yet",
      },
    ],
    kicker: "You don't have to choose between building and selling. Vantera runs the selling — you just approve it.",
  },

  compare: {
    eyebrow: "Before / after",
    title: "Two ways to do founder-led sales.",
    subtitle:
      "One eats the hours you don't have and risks the account you can't replace. The other runs in the background and waits for your OK.",
    before: {
      heading: "Doing it yourself",
      caption: "In the gaps between building",
      steps: [
        { label: "Block time to prospect (that gets eaten)", meta: "~2 hrs" },
        { label: "Scroll LinkedIn guessing who's a fit" },
        { label: "Write each message between meetings" },
        { label: "Send in bursts, then go quiet for weeks" },
        { label: "Risk your one account on volume" },
        { label: "Lose track of who to follow up" },
      ],
    },
    after: {
      heading: "With Vantera",
      caption: "Founder-led, hands-off",
      steps: [
        { label: "Agents surface in-market buyers", meta: "24/7" },
        { label: "Scored against your ICP", meta: "≥ 70 to pass" },
        { label: "Drafted in your voice from real activity" },
        { label: "You approve in a few taps", meta: "~15 min/day" },
        { label: "Safe pacing protects your account" },
        { label: "Replies and follow-ups handled for you" },
      ],
    },
  },

  benefits: {
    eyebrow: "Why founders run it",
    title: "Pipeline that compounds while you build.",
    subtitle:
      "A few minutes of approvals a day, and outreach that never goes quiet — without a hire, a spreadsheet, or a spammed network.",
    items: [
      {
        icon: "clock",
        value: "~15 min",
        title: "A day is all it takes",
        body: "Approve or tweak the day's drafts over coffee. The sourcing, qualifying, and writing already happened.",
      },
      {
        icon: "filter",
        value: "≥ 70",
        title: "Only people worth your time",
        body: "Every prospect clears a fit-and-intent gate, so you talk to buyers — not tire-kickers.",
        trend: [4, 5, 6, 7, 8, 9],
      },
      {
        icon: "safety",
        value: "1 account",
        title: "Kept safe",
        body: "Human-like pacing protects the profile your reputation lives on. Never a setting you can push past.",
        trend: [40, 55, 62, 70, 78, 84],
      },
      {
        icon: "outreach",
        value: "Your voice",
        title: "Not a template",
        body: "Messages are written from each prospect's real activity in your tone — so outreach still sounds like you.",
      },
    ],
  },

  features: {
    eyebrow: "The platform",
    title: "Your AI SDR team, working while you build.",
    subtitle:
      "The whole outbound motion — sourcing, qualifying, writing, safe sending — run for you, and nothing sends without your OK.",
    highlightMock: "pace",
    items: [
      {
        icon: "prospecting",
        label: "Scout",
        title: "Finds your in-market buyers",
        body: "Agents watch LinkedIn for buying behavior and rank every match against your ICP, so your few selling hours go to the best-fit people.",
        chips: ["intent signals", "ICP scoring", "lookalikes"],
      },
      {
        icon: "filter",
        label: "Qualification",
        title: "Only high-quality leads pass",
        body: "A deterministic fit gate plus an AI rank score every prospect on fit, seniority, and intent — only 70-and-up reach you.",
        chips: ["fit + intent", "score ≥ 70", "no spray"],
      },
      {
        icon: "outreach",
        label: "Outreach",
        title: "Messages in your voice",
        body: "Every draft is written from each prospect's real activity in your tone — never a merge tag — so outreach still sounds like you.",
        chips: ["your voice", "context-aware", "personalized"],
      },
      {
        icon: "safety",
        label: "LinkedIn-safe pacing",
        title: "Protects your one account",
        body: "Your profile ramps and paces like a human, under a hard weekly ceiling — the account your reputation lives on stays safe. Built in, never a setting you can push past.",
        chips: ["human pacing", "weekly cap", "account-safe"],
        highlight: true,
      },
      {
        icon: "control",
        label: "Approve in minutes",
        title: "You stay in control",
        body: "Every draft waits for a one-tap approve, edit, or skip. Go full-auto when you trust it, and anything questionable routes back to you.",
        chips: ["approve or auto", "one tap", "nothing sends unseen"],
      },
      {
        icon: "crm",
        label: "CRM sync",
        title: "Clean handoff when you land one",
        body: "Qualified and closed conversations push into HubSpot or Pipedrive — so when you do hire, the pipeline's already organized.",
        chips: ["HubSpot", "Pipedrive", "auto-sync"],
      },
    ],
  },

  review: {
    eyebrow: "See it in action",
    title: "Every message, in your voice — you just approve.",
    subtitle:
      "This is the queue you live in for a few minutes a day. Pick a draft to see the signal that triggered it, the insight behind it, and the message — then approve, edit, or skip.",
    drafts: [
      {
        initials: "DM",
        name: "Dana Meyer",
        role: "VP Sales",
        company: "Northwind",
        fit: 94,
        tint: "#1877f2",
        signal: "Posted about moving off a manual sales process · 3h ago",
        insights: [
          { label: "Pain", value: "Manual sales eating the team's week" },
          { label: "Trigger", value: "Publicly rethinking their process" },
          { label: "Angle", value: "Founder-to-buyer, built for this" },
        ],
        message:
          "Hi Dana — your post on moving off a manual sales process hit home; I ran into the same wall doing founder-led sales and ended up building for it. Happy to show you what actually changed things — no pitch. Worth 15 minutes?",
      },
      {
        initials: "LR",
        name: "Luis Ramos",
        role: "Head of Sales",
        company: "Meridian",
        fit: 88,
        tint: "#5E6AD2",
        signal: "Company raised a round · 3w ago",
        insights: [
          { label: "Pain", value: "Pressure to show pipeline fast" },
          { label: "Trigger", value: "New funding, hiring plans" },
          { label: "Angle", value: "Coverage before the hires ramp" },
        ],
        message:
          "Hi Luis — congrats on the raise. Before the SDR hires ramp, founder-led outbound can keep pipeline moving. I went through the same crunch — happy to share what worked without adding headcount.",
      },
      {
        initials: "PN",
        name: "Priya Nair",
        role: "RevOps Lead",
        company: "Cadence",
        fit: 91,
        tint: "#0C9FCE",
        signal: "Commented on a thread about LinkedIn accounts getting flagged · 1d ago",
        insights: [
          { label: "Pain", value: "Worried about account safety" },
          { label: "Trigger", value: "Public concern about bans" },
          { label: "Angle", value: "Safe pacing is the whole point" },
        ],
        message:
          "Hi Priya — caught your comment on accounts getting flagged. That's exactly why I obsess over safe pacing in what we built — it's enforced, not a toggle. Happy to walk you through how it stays under the line.",
      },
    ],
  },

  pipeline: {
    eyebrow: "How it works",
    title: "From in-market signal to a booked call.",
    subtitle: "One system runs the whole motion — and stops at your approval, every time.",
    nodes: [
      { icon: "radar", label: "Identify", line: "ICP fit + LinkedIn intent", metric: "24/7 scan" },
      { icon: "filter", label: "Qualify", line: "Scored on fit + intent", metric: "≥ 70 to pass" },
      { icon: "outreach", label: "Draft", line: "Written in your voice", metric: "0 templates" },
      { icon: "control", label: "Approve", line: "One-tap approve or edit", metric: "you, in minutes" },
      { icon: "safety", label: "Send", line: "Safe, human-like pacing", metric: "≤ 100 / wk" },
      { icon: "replies", label: "Converse", line: "Replies captured + drafted", metric: "full visibility" },
      { icon: "calendar", label: "Book", line: "Qualified calls land", metric: "on your calendar" },
      { icon: "crm", label: "Sync", line: "Wins pushed to your CRM", metric: "HubSpot · Pipedrive" },
    ],
    howto: [
      { name: "Identify in-market buyers", text: "Vantera's Scout agent watches LinkedIn for buying behavior and matches people to your ideal customer profile." },
      { name: "Qualify against your ICP", text: "Each prospect is scored on fit, seniority, and intent; only those scoring 70 or above enter outreach." },
      { name: "Draft in your voice", text: "The Outreach agent writes each message from the prospect's real activity in your tone — never a template." },
      { name: "Approve the send", text: "Every draft waits in a review queue for you to approve, edit, or skip before anything sends." },
      { name: "Send with safe pacing", text: "Approved messages send within human-like limits to keep your one account safe." },
      { name: "Book and sync", text: "Replies are captured and drafted, booked calls land on your calendar, and closed conversations sync to your CRM." },
    ],
  },

  outcomes: {
    eyebrow: "Outcomes",
    title: "What founders see.",
    subtitle:
      "Directional figures from founders running quality-first outreach — pipeline that builds without a hire or a spammed network.",
    metrics: [
      { value: 3.4, decimals: 1, suffix: "×", label: "reply rate vs. templates", caption: "Messages in your voice, from real activity." },
      { value: 15, suffix: "min", label: "a day to run it", caption: "Approve the day's drafts — that's it." },
      { value: 1, suffix: "wk", label: "to first replies", caption: "Agents work the moment you deploy." },
      { value: 0, label: "account restrictions", caption: "Safe pacing, enforced — never optional." },
    ],
    quote: {
      text: "I'm a technical founder who hated selling. This books calls with people who actually fit while I stay in the code — and it still sounds like me.",
      name: "Sam Okafor",
      role: "Founder",
      company: "Trellis",
      initials: "SO",
    },
  },

  roi: {
    eyebrow: "Business impact",
    title: "What could a few minutes a day add?",
    subtitle: "Move the sliders to your world. Illustrative — but the shape of the win holds.",
    reps: { min: 1, max: 10, default: 1 },
    dealSize: { min: 1000, max: 100000, step: 1000, default: 12000 },
    meetings: { min: 1, max: 20, default: 8, label: "New qualified meetings / month" },
    assumptions:
      "Illustrative only. Assumes the meetings above per month, a 25% meeting-to-opportunity rate, and time you'd otherwise spend prospecting by hand. Your results depend on your ICP, offer, and market.",
    monthlyCost: 45,
    repsLabel: "Founders on it",
    hoursLabel: "Hours reclaimed / week",
    equivalentUnit: "full-time SDRs",
    equivalentTail: "without your first sales hire.",
  },

  faq: {
    eyebrow: "FAQ",
    title: "Questions founders ask.",
    subtitle: "No team required, your voice, your account safe — answered straight.",
    items: [
      {
        q: "Do I need a sales team to use this?",
        a: "No — Vantera is built for founder-led sales. It runs the sourcing, qualifying, and drafting so you can run real outbound in a few minutes a day, without hiring an SDR. When you do hire, the pipeline and CRM are already organized for them.",
      },
      {
        q: "Will it sound like me, or like a bot?",
        a: "Like you. Every message is drafted from the prospect's real LinkedIn activity in your tone — not a template — and a humanizer check flags anything that reads automated before it reaches your queue. You approve or tweak before it sends.",
      },
      {
        q: "Is my personal LinkedIn account safe?",
        a: "Yes. Safe pacing is enforced, not optional: your account ramps gradually, stays under a hard weekly invite ceiling, and every action fires with human-like timing. It protects the one profile your reputation and network live on — the limits can't be pushed past.",
      },
      {
        q: "How much time does it actually take me?",
        a: "A few minutes a day. The agents source, qualify, and draft around the clock; your only job is to approve, edit, or skip the day's drafts — over coffee. When you trust it, switch an agent to full-auto and it sends clean drafts on its own.",
      },
      {
        q: "How is this different from Waalaxy or other LinkedIn tools?",
        a: "Most tools help you send more. Vantera decides who's worth sending to: only prospects that clear a fit-and-intent gate get a message, every message is written from real activity, and you approve the sends. For a founder, that means protecting your name and your account instead of spraying your network.",
      },
      {
        q: "What does it cost?",
        a: "Starter is $45/month — built for a solo founder running account-safe outreach with a deployed agent. Plans scale with your revenue goal, not a long-term contract, so you can change or cancel anytime.",
      },
      {
        q: "How fast will I see results?",
        a: "Agents go to work the moment you deploy, so most founders see first replies within the first week. Volume ramps deliberately to keep your account safe, so momentum builds over the first few weeks rather than spiking on day one.",
      },
      {
        q: "Does it sync with my CRM?",
        a: "Yes — qualified and closed conversations push into HubSpot or Pipedrive automatically. Vantera fills the pipeline; your CRM keeps it, so nothing's lost when you scale up.",
      },
    ],
  },

  finalCta: {
    eyebrow: "Get started",
    title: "Your next ten customers are on LinkedIn — while you're heads-down building.",
    urgency:
      "Every week without outbound is pipeline a competitor is booking instead. Deploy your AI SDR team today — live in about fifteen minutes, first replies this week.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "See pricing", href: "/#pricing" },
    reassurance: ["7-day free trial", "Live in ~15 min", "You approve every message"],
  },
};
