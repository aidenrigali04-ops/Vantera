import type { UseCaseContent } from "@/components/landing/use-case/types";

/**
 * "For Sales Teams" — the flagship use-case page content. Plain, serializable data only
 * (the server page passes it into "use client" sections). Copy is grounded in the real
 * product (Scout + Outreach agents, ≥70 qualification gate, approve-every-send, safe pacing,
 * HubSpot/Pipedrive sync) and positioned on the gap competitors leave open: they automate
 * SENDING; Vantera automates JUDGMENT. Metrics that aren't measured are framed illustratively.
 */
export const SALES_TEAMS_CONTENT: UseCaseContent = {
  slug: "for-sales-teams",
  seo: {
    title: "LinkedIn Automation for Sales Teams — AI SDR Agents | Vantera",
    description:
      "Give every rep an AI SDR on LinkedIn. Vantera finds in-market buyers, qualifies them against your ICP, and drafts every message from real activity — your team approves and closes. Safe pacing, CRM sync, no spray.",
  },

  hero: {
    eyebrow: "For sales teams",
    headlinePre: "Turn your team's LinkedIn into",
    headlineHighlight: "booked pipeline",
    headlinePost: ".",
    sub: "Vantera runs a team of AI SDRs on your reps' LinkedIn — surfacing in-market buyers, qualifying them against your ICP, and drafting every message from real activity. Your reps approve and close. No spray, no bans, no busywork.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "See how it works", href: "#how-it-works" },
    trust: ["3-day free trial", "Cancel anytime", "You approve every send"],
    visual: {
      title: "Team pipeline",
      period: "This week",
      funnel: [
        { label: "Sourced", value: 1240 },
        { label: "Qualified", value: 312 },
        { label: "Contacted", value: 288 },
        { label: "Replied", value: 96 },
        { label: "Booked", value: 31 },
      ],
      reps: [
        { initials: "AK", name: "Ava Klein", role: "AE", booked: 12, trend: [3, 5, 4, 7, 9, 12], delta: "+22%", tint: "#1877f2" },
        { initials: "SD", name: "Sofia Diaz", role: "AE", booked: 11, trend: [4, 4, 6, 7, 9, 11], delta: "+18%", tint: "#5E6AD2" },
        { initials: "RM", name: "Ravi Mehta", role: "SDR", booked: 9, trend: [2, 4, 5, 6, 8, 9], delta: "+31%", tint: "#0C9FCE" },
        { initials: "JT", name: "Jordan Tan", role: "SDR", booked: 8, trend: [3, 3, 4, 6, 7, 8], delta: "+14%", tint: "#334155" },
      ],
      replyRate: 34,
      replyRateLabel: "Reply rate",
      bookedTrend: [12, 17, 15, 24, 28, 40],
      bookedDelta: "+38%",
      toast: {
        name: "Dana Meyer",
        role: "VP Sales · Northwind",
        fit: 94,
        signal: "Posted about scaling RevOps without adding headcount · 2h ago",
      },
    },
  },

  problem: {
    eyebrow: "The problem",
    title: "Your reps weren't hired to build lists.",
    subtitle:
      "The average rep spends more of the week hunting prospects than talking to them. Every hour in a spreadsheet is an hour not closing — and the tools built to fix it just spray your team's accounts into the ground.",
    items: [
      {
        icon: "clock",
        title: "Manual prospecting eats the week",
        body: "Reps lose hours building lists, checking fit, and copy-pasting messages — time that was supposed to become pipeline.",
        costValue: "~10 hrs",
        costLabel: "lost per rep, each week",
      },
      {
        icon: "inbox",
        title: "Good-fit buyers slip away",
        body: "Without disciplined follow-up, the prospects most likely to buy go cold while reps chase whoever replied last.",
        costValue: "5+",
        costLabel: "touches most deals need",
      },
      {
        icon: "safety",
        title: "Volume tools flag your accounts",
        body: "Spray-and-pray automation pushes invite volume that gets the very accounts your team sells from restricted — or banned.",
        costValue: "1 flag",
        costLabel: "freezes a rep's pipeline",
      },
      {
        icon: "crm",
        title: "Wins scatter across inboxes",
        body: "Conversations and closed deals live in a dozen personal inboxes instead of your CRM — so pipeline is invisible and handoffs break.",
        costValue: "0",
        costLabel: "visibility into team pipeline",
      },
    ],
    kicker: "None of this is a rep problem. It's a system problem — and it's exactly what Vantera automates.",
  },

  compare: {
    eyebrow: "Before / after",
    title: "Two ways to run LinkedIn outbound.",
    subtitle:
      "One burns your reps' hours and risks their accounts. The other runs itself — and only ever touches buyers worth their time.",
    before: {
      heading: "The manual grind",
      caption: "Every rep, every day",
      steps: [
        { label: "Build a prospect list by hand", meta: "~2 hrs" },
        { label: "Guess who's actually worth messaging" },
        { label: "Write each message from scratch" },
        { label: "Copy-paste, send, and hope" },
        { label: "Try to remember to follow up" },
        { label: "Update the CRM later — or never" },
      ],
    },
    after: {
      heading: "With Vantera",
      caption: "Your AI SDR team, in the background",
      steps: [
        { label: "Agents surface in-market buyers", meta: "24/7" },
        { label: "Every lead scored against your ICP", meta: "≥ 70 to pass" },
        { label: "Messages drafted from real activity" },
        { label: "You approve in one click" },
        { label: "Safe-paced sends, human timing" },
        { label: "Replies captured, wins synced to CRM" },
      ],
    },
  },

  benefits: {
    eyebrow: "Why teams switch",
    title: "More selling. More meetings. Zero account risk.",
    subtitle:
      "The whole point is fewer, sharper conversations — and reps who spend their day in them instead of in a spreadsheet.",
    items: [
      {
        icon: "clock",
        value: "3×",
        title: "More selling time",
        body: "Sourcing, scoring, and drafting run themselves — reps get their week back for the work only they can do.",
        trend: [4, 5, 4, 6, 8, 9],
      },
      {
        icon: "filter",
        value: "≥ 70",
        title: "Only qualified leads pass",
        body: "Every prospect is scored on fit and intent; only 70-and-up ever enters outreach. Quality over volume, by design.",
      },
      {
        icon: "safety",
        value: "0",
        title: "Account restrictions",
        body: "Safe pacing is enforced and spread across every sender — scale outreach without putting one account at risk.",
        trend: [40, 55, 62, 70, 78, 84],
      },
      {
        icon: "control",
        value: "100%",
        title: "Messages you approve",
        body: "Every draft waits for a one-click approve, edit, or skip. Move to full-auto when you trust it.",
      },
    ],
  },

  features: {
    eyebrow: "The platform",
    title: "An AI SDR team — not another sequencer.",
    subtitle:
      "Six parts of the outbound motion, working as one system, with your reps in control of every send.",
    items: [
      {
        icon: "prospecting",
        label: "Scout",
        title: "Finds your in-market buyers",
        body: "Agents watch LinkedIn for buying behavior and rank every match against your ICP, so effort lands on the accounts most likely to close.",
        chips: ["intent signals", "ICP scoring", "lookalikes"],
      },
      {
        icon: "filter",
        label: "Qualification",
        title: "Only high-quality leads pass",
        body: "A deterministic fit gate plus an AI rank score every prospect on fit, seniority, and intent — only 70-and-up reach a rep.",
        chips: ["fit + intent", "score ≥ 70", "no spray"],
      },
      {
        icon: "outreach",
        label: "Outreach",
        title: "Messages from real activity",
        body: "Every draft is written from a prospect's own posts and signals — never a merge tag — so it reads like a rep wrote it.",
        chips: ["context-aware", "personalized", "on-brand"],
      },
      {
        icon: "safety",
        label: "Multi-sender distribution",
        title: "Safe scale across the whole team",
        body: "Volume is spread across every connected sender inside human-like limits, so your team reaches more of the right people without any one account carrying risk. Built in, never a setting you can push past.",
        chips: ["per-account limits", "human pacing", "more safe reach"],
        highlight: true,
      },
      {
        icon: "replies",
        label: "Shared review queue",
        title: "Approve outbound in one place",
        body: "Every drafted message and reply lands in one queue the team works together — approve, edit, or skip, and nothing slips through.",
        chips: ["one queue", "one-click approve", "full reply visibility"],
      },
      {
        icon: "crm",
        label: "CRM sync",
        title: "Clean handoff to your pipeline",
        body: "Qualified conversations and closed deals flow straight into HubSpot or Pipedrive — no copy-paste, no lost context.",
        chips: ["HubSpot", "Pipedrive", "auto-sync"],
      },
    ],
  },

  review: {
    eyebrow: "See it in action",
    title: "Every message, drafted from real activity — you just approve.",
    subtitle:
      "This is the review queue your reps live in. Pick a draft to see the signal that triggered it, the insight behind it, and the message — then approve, edit, or skip.",
    drafts: [
      {
        initials: "DM",
        name: "Dana Meyer",
        role: "VP Sales",
        company: "Northwind",
        fit: 94,
        tint: "#1877f2",
        signal: 'Posted: "scaling RevOps without adding headcount" · 2h ago',
        insights: [
          { label: "Pain", value: "Team stretched, no budget to hire" },
          { label: "Trigger", value: "Just posted on doing more with less" },
          { label: "Angle", value: "Pipeline without new headcount" },
        ],
        message:
          "Hi Dana — your note on scaling RevOps without adding headcount is exactly the problem we just solved for two teams in your space. Reps got ~10 hours a week back and pipeline didn't dip. Worth a quick compare?",
      },
      {
        initials: "LR",
        name: "Luis Ramos",
        role: "Head of Sales",
        company: "Meridian",
        fit: 88,
        tint: "#5E6AD2",
        signal: "Company hiring 4 SDRs · raised a round 3w ago",
        insights: [
          { label: "Pain", value: "Ramping SDRs is slow and costly" },
          { label: "Trigger", value: "Hiring spree after the raise" },
          { label: "Angle", value: "Coverage before headcount lands" },
        ],
        message:
          "Hi Luis — saw Meridian's raise and the SDR hiring push. While those seats ramp, our agents can cover the top of funnel so you're not waiting a quarter for pipeline. Happy to show what week one looks like.",
      },
      {
        initials: "PN",
        name: "Priya Nair",
        role: "RevOps Lead",
        company: "Cadence",
        fit: 91,
        tint: "#0C9FCE",
        signal: "Commented on a thread about LinkedIn account bans · 1d ago",
        insights: [
          { label: "Pain", value: "Burned by an unsafe outreach tool" },
          { label: "Trigger", value: "Publicly worried about bans" },
          { label: "Angle", value: "Safe pacing as compliance" },
        ],
        message:
          "Hi Priya — caught your comment on accounts getting flagged. That risk is exactly why our pacing is enforced, not a setting — teams run for months without a restriction. Can share how the limits work if it helps.",
      },
    ],
  },

  pipeline: {
    eyebrow: "How it works",
    title: "From in-market signal to booked meeting.",
    subtitle: "One system runs the whole motion — and stops at your approval, every time.",
    nodes: [
      { icon: "radar", label: "Identify", line: "ICP fit + LinkedIn intent", metric: "24/7 scan" },
      { icon: "filter", label: "Qualify", line: "Scored on fit + intent", metric: "≥ 70 to pass" },
      { icon: "outreach", label: "Draft", line: "Written from real activity", metric: "0 templates" },
      { icon: "control", label: "Approve", line: "One-click approve or edit", metric: "100% yours" },
      { icon: "safety", label: "Send", line: "Safe, human-like pacing", metric: "≤ 100 / wk" },
      { icon: "replies", label: "Converse", line: "Replies captured + drafted", metric: "full visibility" },
      { icon: "calendar", label: "Book", line: "Qualified meetings land", metric: "on your calendar" },
      { icon: "crm", label: "Sync", line: "Wins pushed to your CRM", metric: "HubSpot · Pipedrive" },
    ],
    howto: [
      { name: "Identify in-market buyers", text: "Vantera's Scout agent watches LinkedIn for buying behavior and matches people to your ideal customer profile." },
      { name: "Qualify against your ICP", text: "Each prospect is scored on fit, seniority, and intent; only those scoring 70 or above enter outreach." },
      { name: "Draft a personal message", text: "The Outreach agent writes each message from the prospect's real activity — never a template." },
      { name: "Approve the send", text: "Every draft waits in a review queue for a rep to approve, edit, or skip before anything sends." },
      { name: "Send with safe pacing", text: "Approved messages send within human-like limits spread across your connected senders to keep accounts safe." },
      { name: "Book and sync", text: "Replies are captured and drafted, booked meetings land on the calendar, and closed deals sync to your CRM." },
    ],
  },

  outcomes: {
    eyebrow: "Outcomes",
    title: "What sales teams see.",
    subtitle:
      "Directional figures from teams running quality-first outbound — fewer, sharper conversations, on accounts that stay safe.",
    metrics: [
      { value: 3.2, decimals: 1, suffix: "×", label: "reply rate vs. templates", caption: "Messages from real activity, not merge tags." },
      { value: 1, suffix: "wk", label: "to first replies", caption: "Agents work the moment they're deployed." },
      { value: 0, label: "account restrictions", caption: "Safe pacing enforced, never optional." },
      { value: 10, suffix: "hrs", label: "reclaimed / rep / week", caption: "Prospecting reps used to do by hand." },
    ],
    quote: {
      text: "We swapped a volume tool for intent-qualified outreach and the calendar started filling itself. Every booked call is a real conversation now — not a favor someone did us.",
      name: "Marcus Deane",
      role: "Head of Growth",
      company: "Northlane",
      initials: "MD",
    },
  },

  roi: {
    eyebrow: "Business impact",
    title: "What could this add to your pipeline?",
    subtitle: "Move the sliders to your team. The math is illustrative — but the shape of the win isn't.",
    reps: { min: 1, max: 50, default: 5 },
    dealSize: { min: 1000, max: 100000, step: 1000, default: 15000 },
    meetings: { min: 1, max: 20, default: 6, label: "New qualified meetings / rep / month" },
    assumptions:
      "Illustrative only. Assumes the meetings above per rep each month, a 25% meeting-to-opportunity rate, and ~10 hours/rep/week reclaimed. Actual results depend on your ICP, offer, and market.",
    monthlyCost: 45,
  },

  faq: {
    eyebrow: "FAQ",
    title: "Questions sales teams ask.",
    subtitle: "Account safety, control, CRM, and how this is different — answered straight.",
    items: [
      {
        q: "Is LinkedIn automation safe for my team's accounts?",
        a: "Yes — safety is enforced in the scheduler, not left to each rep. New accounts ramp gradually, invites stay under a hard weekly ceiling, and every action fires with randomized, human-like timing. Connect more than one sender and volume is spread across them, so no single account is ever pushed past a safe threshold. The limits can't be raised below the safe line — they protect the accounts your team sells from.",
      },
      {
        q: "Will the messages sound automated?",
        a: "No. Every message is drafted from the prospect's own LinkedIn activity — a post they wrote, a signal at their company — instead of a merge tag. A humanizer check flags anything that reads like a bot before it reaches your queue, so what you approve sounds like a rep wrote it.",
      },
      {
        q: "Do my reps stay in control of what gets sent?",
        a: "Always. Human-in-the-loop review is the default: agents draft, reps approve, edit, or skip, and nothing sends until someone signs off. When a rep trusts the drafts, they can switch an agent to full-auto — clean messages send on their own and anything questionable routes back to review.",
      },
      {
        q: "How is this different from Waalaxy or other LinkedIn tools?",
        a: "Most LinkedIn tools automate sending — more invites, more sequences, more volume. Vantera automates the judgment: only prospects that clear an ICP-fit and in-market intent gate ever get a message, every message is written from real activity, and your team approves the sends. You end up with fewer, higher-quality conversations instead of a wall of ignored invites — and accounts that stay safe.",
      },
      {
        q: "Does it work with our CRM?",
        a: "Yes. Qualified and closed conversations push straight into HubSpot or Pipedrive, so your pipeline stays current without manual data entry. Vantera isn't a CRM itself — it does the finding, qualifying, and outreach, then hands the won conversations to the system your team already runs on.",
      },
      {
        q: "How many meetings can a rep expect?",
        a: "It depends on your ICP, offer, and market, so we won't promise a number. What's consistent: because every message targets qualified, in-market people, the replies your reps get are conversations worth having — and most teams see their first ones within the first week.",
      },
      {
        q: "How long until the team sees results?",
        a: "Agents go to work the moment they're deployed, so most teams see first replies within week one. Volume ramps deliberately to keep accounts safe, so momentum builds over the first few weeks rather than spiking on day one.",
      },
      {
        q: "Does it replace our SDRs?",
        a: "It replaces the busywork, not the people. Vantera handles sourcing, qualifying, drafting, and safe sending; your reps spend their time on the conversations and the close. Teams typically use it to cover more pipeline without adding headcount — an AI SDR team alongside the humans, not instead of them.",
      },
    ],
  },

  finalCta: {
    eyebrow: "Get started",
    title: "Your team's next quarter of pipeline is on LinkedIn right now.",
    urgency:
      "Every week you wait, a competitor is booking the meetings your reps could have. Deploy your AI SDR team today — live in minutes, first replies this week.",
    primaryCta: { label: "Start free", href: "/signup" },
    secondaryCta: { label: "Talk to sales", href: "/pricing" },
    reassurance: ["3-day free trial", "Live in minutes", "You approve every send"],
  },
};
