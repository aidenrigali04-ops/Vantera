import type { UseCaseContent } from "@/components/landing/use-case/types";

/**
 * "For Agencies" — lead-gen / outbound agencies running LinkedIn for many clients. Same
 * product, angled at the multi-client operator: seats, multi-sender distribution per client
 * account, safe pacing on every account, one queue, clean reporting. Grounded in the real
 * product; the differentiator card keeps the multi-sender "senders" mock.
 */
export const AGENCIES_CONTENT: UseCaseContent = {
  slug: "for-agencies",
  seo: {
    title: "LinkedIn Automation for Agencies — Run Outbound for Every Client | Vantera",
    description:
      "Run safe, quality-first LinkedIn outreach for every client from one place. Vantera finds in-market buyers, qualifies them to each client's ICP, and drafts every message — your team approves. Seats, multi-sender, and clean reporting built in.",
  },

  hero: {
    eyebrow: "For agencies",
    headlinePre: "Run outbound for every client from",
    headlineHighlight: "one place",
    headlinePost: ".",
    sub: "Vantera runs a team of AI SDRs across your clients' LinkedIn accounts — finding in-market buyers, qualifying them to each client's ICP, and drafting every message from real activity. Your team approves. Safe pacing on every account, one login, reporting that runs itself.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "See how it works", href: "#how-it-works" },
    trust: ["Every client, one login", "Safe pacing per account", "You approve every send"],
    visual: {
      title: "Client pipeline",
      period: "This week",
      funnel: [
        { label: "Sourced", value: 3200 },
        { label: "Qualified", value: 720 },
        { label: "Contacted", value: 664 },
        { label: "Replied", value: 214 },
        { label: "Booked", value: 68 },
      ],
      reps: [
        { initials: "NW", name: "Northwind", role: "SaaS · 8 seats", booked: 22, trend: [10, 13, 15, 18, 20, 22], delta: "+19%", tint: "#1877f2" },
        { initials: "MD", name: "Meridian", role: "Fintech · 5 seats", booked: 18, trend: [8, 11, 13, 15, 17, 18], delta: "+24%", tint: "#5E6AD2" },
        { initials: "CD", name: "Cadence", role: "DevTools · 6 seats", booked: 16, trend: [6, 9, 11, 13, 15, 16], delta: "+31%", tint: "#0C9FCE" },
      ],
      replyRate: 31,
      replyRateLabel: "Reply rate",
      bookedTrend: [28, 34, 40, 52, 60, 68],
      bookedDelta: "+28%",
      toast: {
        name: "Dana Meyer",
        role: "VP Sales · Northwind (client)",
        fit: 92,
        signal: "Posted about vendor consolidation · 4h ago",
      },
      leaderboardTitle: "Clients · booked",
      leaderboardTrendLabel: "6-week trend",
      funnelCaption: "Sourced → Booked",
      toastLabel: "New qualified lead",
    },
  },

  problem: {
    eyebrow: "The problem",
    title: "Every client wants results. None want to hear about your tooling.",
    subtitle:
      "Running outbound for multiple clients means juggling logins, tools, and safety limits — while each client judges you on booked meetings, not effort.",
    items: [
      {
        icon: "layers",
        title: "A different tool stack per client",
        body: "List tools, senders, sequencers, inboxes — multiplied by every client. Nothing talks to anything.",
        costValue: "×N",
        costLabel: "tools to babysit per client",
      },
      {
        icon: "safety",
        title: "One flagged account is a fire",
        body: "Push volume on a client's account and get it restricted — now you're explaining a ban instead of showing pipeline.",
        costValue: "1 ban",
        costLabel: "= an at-risk retainer",
      },
      {
        icon: "outreach",
        title: "Generic outreach churns clients",
        body: "Templated spray gets ignored, replies dry up, and the client blames the agency — retainers don't renew on activity.",
        costValue: "Churn",
        costLabel: "when replies go quiet",
      },
      {
        icon: "chart",
        title: "Reporting eats your margin",
        body: "Stitching results across clients by hand every week is time you can't bill — and it's the first thing to slip.",
        costValue: "Hours",
        costLabel: "lost to manual reporting",
      },
    ],
    kicker: "Run every client on one system that qualifies before it sends, paces safely per account, and reports itself.",
  },

  compare: {
    eyebrow: "Before / after",
    title: "Two ways to run outbound for clients.",
    subtitle:
      "One is a per-client scramble across tools and logins. The other runs every client on one system — and only ever touches buyers worth their time.",
    before: {
      heading: "The multi-tool scramble",
      caption: "Per client, every week",
      steps: [
        { label: "Log into each client's stack" },
        { label: "Rebuild lists tool by tool" },
        { label: "Guess who's worth messaging" },
        { label: "Copy-paste sequences across accounts" },
        { label: "Watch for account flags by hand" },
        { label: "Assemble client reports manually" },
      ],
    },
    after: {
      heading: "With Vantera",
      caption: "Every client, one system",
      steps: [
        { label: "Agents source in-market buyers", meta: "per client" },
        { label: "Scored to each client's ICP", meta: "≥ 70" },
        { label: "Messages drafted from real activity" },
        { label: "Your team approves in one queue" },
        { label: "Safe pacing on every account" },
        { label: "Reporting and CRM handoff, automatic" },
      ],
    },
  },

  benefits: {
    eyebrow: "Why agencies switch",
    title: "More client results, less operational drag.",
    subtitle:
      "Fewer, sharper conversations per client — from one system that keeps every account safe and reports itself.",
    items: [
      {
        icon: "layers",
        value: "1 login",
        title: "Every client, one place",
        body: "Run sourcing, qualifying, drafting, and approvals for all clients from a single system — no tool sprawl.",
      },
      {
        icon: "filter",
        value: "≥ 70",
        title: "Quality your clients feel",
        body: "Only ICP-fit, in-market leads per client — booked calls that make retainers renew.",
        trend: [4, 5, 6, 7, 8, 9],
      },
      {
        icon: "safety",
        value: "0",
        title: "Flagged accounts",
        body: "Safe pacing enforced per account and spread across senders — scale every client without risking one.",
        trend: [40, 55, 62, 70, 78, 84],
      },
      {
        icon: "chart",
        value: "Auto",
        title: "Client-ready reporting",
        body: "Every client's pipeline and outcomes tracked automatically — less unbillable ops, cleaner QBRs.",
      },
    ],
  },

  features: {
    eyebrow: "The platform",
    title: "An AI SDR team for every client you run.",
    subtitle:
      "The whole outbound motion — sourcing, qualifying, writing, safe sending — run per client, with your team in control of every send.",
    items: [
      {
        icon: "prospecting",
        label: "Scout",
        title: "Finds each client's buyers",
        body: "Agents watch LinkedIn for buying behavior and rank every match against that client's ICP — effort lands on the accounts most likely to close for them.",
        chips: ["intent signals", "per-client ICP", "lookalikes"],
      },
      {
        icon: "filter",
        label: "Qualification",
        title: "Only high-quality leads pass",
        body: "A deterministic fit gate plus an AI rank score every prospect on fit, seniority, and intent — only 70-and-up reach the queue.",
        chips: ["fit + intent", "score ≥ 70", "no spray"],
      },
      {
        icon: "outreach",
        label: "Outreach",
        title: "Messages from real activity",
        body: "Every draft is written from a prospect's own posts and signals, in each client's voice — never a merge tag.",
        chips: ["context-aware", "per-client voice", "personalized"],
      },
      {
        icon: "safety",
        label: "Multi-sender distribution",
        title: "Safe scale across every account",
        body: "Volume is spread across every connected sender per client inside human-like limits — more reach, no account carrying risk. Built in, never a setting you can push past.",
        chips: ["per-account limits", "human pacing", "more safe reach"],
        highlight: true,
      },
      {
        icon: "replies",
        label: "Shared review queue",
        title: "Approve across clients in one place",
        body: "Every drafted message and reply lands in one queue your team works together — approve, edit, or skip, nothing slips through.",
        chips: ["one queue", "one-click approve", "full reply visibility"],
      },
      {
        icon: "crm",
        label: "CRM sync",
        title: "Clean handoff to each client's CRM",
        body: "Qualified conversations and closed deals flow straight into each client's HubSpot or Pipedrive — no copy-paste, no lost context.",
        chips: ["HubSpot", "Pipedrive", "per-client sync"],
      },
    ],
  },

  review: {
    eyebrow: "See it in action",
    title: "Every message, drafted from real activity — your team just approves.",
    subtitle:
      "This is the queue your team works across every client. Pick a draft to see the signal that triggered it, the insight behind it, and the message — then approve, edit, or skip.",
    drafts: [
      {
        initials: "DM",
        name: "Dana Meyer",
        role: "VP Sales · Northwind",
        company: "for Acme",
        fit: 92,
        tint: "#1877f2",
        signal: "Posted about consolidating vendors this quarter · 4h ago",
        insights: [
          { label: "Pain", value: "Too many overlapping tools" },
          { label: "Trigger", value: "Publicly consolidating vendors" },
          { label: "Angle", value: "One platform replaces several" },
        ],
        message:
          "Hi Dana — saw your note on cutting down vendors this quarter. Acme replaced three overlapping tools with one and clawed back both budget and admin time. Happy to share exactly what they consolidated if it's useful.",
      },
      {
        initials: "LR",
        name: "Luis Ramos",
        role: "Head of Sales · Meridian",
        company: "for Bright",
        fit: 88,
        tint: "#5E6AD2",
        signal: "Company hiring 4 SDRs · raised a round 3w ago",
        insights: [
          { label: "Pain", value: "Ramping SDRs is slow and costly" },
          { label: "Trigger", value: "Hiring spree after the raise" },
          { label: "Angle", value: "Coverage before headcount lands" },
        ],
        message:
          "Hi Luis — congrats on the raise and the SDR hiring push. While those seats ramp, Bright kept top-of-funnel covered without waiting a quarter for pipeline. Happy to show what week one looked like for them.",
      },
      {
        initials: "PN",
        name: "Priya Nair",
        role: "RevOps · Cadence",
        company: "for Loop",
        fit: 91,
        tint: "#0C9FCE",
        signal: "Commented on a thread about LinkedIn account bans · 1d ago",
        insights: [
          { label: "Pain", value: "Burned by an unsafe outreach tool" },
          { label: "Trigger", value: "Publicly worried about bans" },
          { label: "Angle", value: "Safe pacing as compliance" },
        ],
        message:
          "Hi Priya — caught your comment on accounts getting flagged. That risk is exactly why Loop moved to pacing that's enforced, not a setting — they've run for months without a restriction. Can share how the limits work if it helps.",
      },
    ],
  },

  pipeline: {
    eyebrow: "How it works",
    title: "From in-market signal to a client's booked meeting.",
    subtitle: "One system runs the whole motion for every client — and stops at your approval, every time.",
    nodes: [
      { icon: "radar", label: "Identify", line: "Client ICP + LinkedIn intent", metric: "24/7 scan" },
      { icon: "filter", label: "Qualify", line: "Scored to each client", metric: "≥ 70 to pass" },
      { icon: "outreach", label: "Draft", line: "In each client's voice", metric: "0 templates" },
      { icon: "control", label: "Approve", line: "Your team, one queue", metric: "100% yours" },
      { icon: "safety", label: "Send", line: "Safe pacing per account", metric: "≤ 100 / wk" },
      { icon: "replies", label: "Converse", line: "Replies captured + drafted", metric: "full visibility" },
      { icon: "calendar", label: "Book", line: "Client meetings land", metric: "on their calendar" },
      { icon: "crm", label: "Sync", line: "Wins to each client's CRM", metric: "HubSpot · Pipedrive" },
    ],
    howto: [
      { name: "Identify each client's buyers", text: "Vantera's Scout agent watches LinkedIn for buying behavior and matches people to each client's ideal customer profile." },
      { name: "Qualify against the client's ICP", text: "Each prospect is scored on fit, seniority, and intent; only those scoring 70 or above enter outreach." },
      { name: "Draft in the client's voice", text: "The Outreach agent writes each message from the prospect's real activity in the client's voice — never a template." },
      { name: "Approve the send", text: "Every draft waits in a shared review queue for your team to approve, edit, or skip before anything sends." },
      { name: "Send with safe pacing", text: "Approved messages send within human-like limits spread across each client's senders to keep accounts safe." },
      { name: "Book and sync", text: "Replies are captured and drafted, booked meetings land on the calendar, and closed deals sync to each client's CRM." },
    ],
  },

  outcomes: {
    eyebrow: "Outcomes",
    title: "What agencies see.",
    subtitle:
      "Directional figures from agencies running quality-first outbound across their book — booked calls per client, on accounts that stay safe.",
    metrics: [
      { value: 3.1, decimals: 1, suffix: "×", label: "reply rate vs. templates", caption: "Real activity per client, not merge tags." },
      { value: 1, suffix: "wk", label: "to first replies", caption: "Agents work the moment they deploy." },
      { value: 0, label: "account flags", caption: "Safe pacing enforced on every account." },
      { value: 1, label: "login, every client", caption: "One system, no per-client tool sprawl." },
    ],
    quote: {
      text: "We run outbound for a dozen clients from one place now. Every account stays safe, every client sees booked calls, and our team stopped drowning in tools.",
      name: "Elena Fischer",
      role: "Founder",
      company: "Loop Outbound",
      initials: "EF",
    },
  },

  roi: {
    eyebrow: "Business impact",
    title: "What could this add across your clients?",
    subtitle: "Move the sliders to your book of business. Illustrative — but the leverage is real.",
    reps: { min: 1, max: 40, default: 6 },
    dealSize: { min: 1000, max: 100000, step: 1000, default: 14000 },
    meetings: { min: 1, max: 20, default: 6, label: "New meetings / client / month" },
    assumptions:
      "Illustrative only. Assumes the meetings above per client each month, a 25% meeting-to-opportunity rate, and ~10 hours/client/week reclaimed from manual work. Actual results depend on each client's ICP, offer, and market.",
    monthlyCost: 45,
    repsLabel: "Active clients",
    dealSizeLabel: "Average client deal size",
    pipelineLabel: "Client pipeline / month",
    meetingsOutputLabel: "Client meetings / mo",
    hoursLabel: "Ops hours reclaimed / week",
    equivalentUnit: "full-time SDRs",
    equivalentTail: "without hiring per client.",
  },

  faq: {
    eyebrow: "FAQ",
    title: "Questions agencies ask.",
    subtitle: "Multi-client, account safety, seats, and reporting — answered straight.",
    items: [
      {
        q: "Can I run multiple clients from one account?",
        a: "Yes — that's the point. You run sourcing, qualifying, drafting, and approvals for every client from one login, with each client's targeting, voice, senders, and reporting kept separate. No more juggling a different tool stack per client.",
      },
      {
        q: "How does it keep each client's LinkedIn accounts safe?",
        a: "Safe pacing is enforced per account, not left to your team. Every connected sender works within its own ramp and hard weekly ceiling, with human-like timing, and volume is spread across senders so no single account is ever pushed past a safe threshold. The limits can't be raised below the safe line.",
      },
      {
        q: "Will the outreach sound like each client, or generic?",
        a: "Like each client. Every message is drafted from the prospect's real LinkedIn activity in that client's voice — not a shared template — and a humanizer check flags anything that reads automated before it reaches your queue.",
      },
      {
        q: "How is this different from stitching together separate tools?",
        a: "Most agencies run a list tool, a sequencer, an inbox, and safety tooling per client that half-talk to each other. Vantera runs the whole motion — sourcing, qualifying, drafting, safe sending, replies, and CRM handoff — as one system, per client, so your team stops babysitting tools and clients see booked calls.",
      },
      {
        q: "Does it report per client?",
        a: "Yes. Each client's pipeline and outcomes are tracked automatically, so your QBRs and updates come together without hand-stitching spreadsheets every week — time you can put back into results instead of ops.",
      },
      {
        q: "Does it sync to each client's CRM?",
        a: "Yes — qualified and closed conversations push into each client's HubSpot or Pipedrive, so their pipeline stays current without manual data entry. Vantera fills the pipeline; their CRM keeps it.",
      },
      {
        q: "How fast do clients see results?",
        a: "Agents go to work the moment a client is deployed, so most see first replies within week one. Volume ramps deliberately to keep every account safe, so momentum builds over the first few weeks.",
      },
      {
        q: "What does it cost?",
        a: "Plans scale with seats and volume rather than a long-term contract. Starter is $45/month to get going; for a multi-client book, our Custom plan is scoped to your seats and senders — talk to us and we'll size it with you.",
      },
    ],
  },

  finalCta: {
    eyebrow: "Get started",
    title: "Run every client's outbound from one system — and show the booked calls.",
    urgency:
      "Every week of tool-juggling is margin you're not billing and pipeline your clients aren't seeing. Move your book onto one safe, quality-first system — live in minutes, first replies this week.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "Talk to sales", href: "/pricing" },
    reassurance: ["Every client, one login", "Safe pacing per account", "You approve every send"],
  },
};
