import type { TodayView } from "@/lib/today/rows";

/**
 * Sample data for the Today design-review surface (rule 07's "UI Designer Reference" —
 * development-only, never user-facing). Identities are the blueprint's §7 sample cast and
 * nothing else: no real prospects, no real companies (blueprint §11 "sample data
 * discipline"). Every string here is already formatted exactly as the server would format
 * it, so the preview exercises the real components, not a parallel renderer.
 */

const QUEUE: TodayView["queue"]["rows"] = [
  {
    id: "d1",
    leadId: "l1",
    name: "Maya Chen",
    context: "Founder · Northwind",
    initials: "MC",
    signal: { label: "Hiring SDRs", age: "2d", glyph: "briefcase" },
    signalFallback: null,
    score: 91,
    step: "Invite",
    sends: { label: "2:10–4:30pm", sender: "Anna K.", held: false },
    body: "Saw Northwind is hiring two SDRs — usually that means the founder is still writing the outbound themselves. Worth a quick look at how we keep that pipeline warm without adding headcount?",
    styleFlags: null,
    channel: "linkedin",
    evidence: [
      { text: "Hiring SDRs", href: "https://www.linkedin.com/in/sample" },
      { text: "Founder still owns outbound" },
      { text: "No SDR tooling in the stack" },
    ],
    rationale: "Fit 52 · Intent 31 · Reach 8",
    charLimit: 200,
    linkedinUrl: "https://www.linkedin.com/in/sample",
  },
  {
    id: "d2",
    leadId: "l2",
    name: "Daniel Okafor",
    context: "Head of Growth · Brightline",
    initials: "DO",
    signal: { label: "Commented on outbound post", age: "5h", glyph: "message-circle" },
    signalFallback: null,
    score: 88,
    step: "Follow-up 1",
    sends: { label: "2:10–4:30pm", sender: "Anna K.", held: false },
    body: "You mentioned reply rates falling off after the first touch — that's usually a sequencing problem, not a copy one. Happy to show what changed for teams your size.",
    styleFlags: "exclamation mark",
    channel: "linkedin",
    evidence: [{ text: "Commented on outbound post" }, { text: "Growth lead, owns the number" }],
    rationale: "Fit 48 · Intent 34 · Reach 6",
    charLimit: 180,
    linkedinUrl: null,
  },
  {
    id: "d3",
    leadId: "l3",
    name: "Priya Raman",
    context: "Co-founder · Halden Labs",
    initials: "PR",
    signal: { label: "Changed role", age: "9d", glyph: "arrow-up-right" },
    signalFallback: null,
    score: 84,
    step: "Invite",
    sends: { label: "tomorrow 9:20am", sender: "Jonas M.", held: false },
    body: "New seat, same problem: pipeline has to exist before quarter two. Worth twenty minutes on what we're seeing work for founder-led sales right now?",
    styleFlags: null,
    channel: "linkedin",
    evidence: [{ text: "Changed role 9 days ago" }],
    rationale: "Fit 45 · Intent 30 · Reach 9",
    charLimit: 200,
    linkedinUrl: null,
  },
  {
    id: "d4",
    leadId: "l4",
    name: "Tom Ekström",
    context: "Managing Partner · Ekström & Vale",
    initials: "TE",
    signal: null,
    signalFallback: "Follow-up due",
    score: 79,
    step: "Follow-up 2",
    sends: { label: "3:05–4:30pm", sender: "Anna K.", held: false },
    body: "Circling back once — if the timing is wrong I'll leave it there. Is partner-led outreach still something you're working on this quarter?",
    styleFlags: null,
    channel: "linkedin",
    evidence: [],
    rationale: null,
    charLimit: 180,
    linkedinUrl: null,
  },
  {
    id: "d5",
    leadId: "l5",
    name: "Lucía Ferreira",
    context: "Founder · Solstice Studio",
    initials: "LF",
    signal: { label: "Launched agency", age: "14d", glyph: "rocket" },
    signalFallback: null,
    score: 76,
    step: "Invite",
    sends: { label: "tomorrow 8:00am", sender: "Jonas M.", held: false },
    body: "Two weeks in is exactly when the referral well runs dry. Curious whether you're planning to do outbound yourself or hand it off.",
    styleFlags: null,
    channel: "linkedin",
    evidence: [{ text: "Launched agency 14 days ago" }],
    rationale: "Fit 41 · Intent 27 · Reach 8",
    charLimit: 200,
    linkedinUrl: null,
  },
];

const REPLIES: TodayView["replies"]["rows"] = [
  {
    id: "r1",
    leadId: "l2",
    name: "Daniel Okafor",
    company: "Brightline",
    initials: "DO",
    excerpt: "Interesting — how does the approval step work day to day? We don't want another tool that…",
    note: "Draft reply ready · approval needed",
    noteIsDraft: true,
    klass: "Interested",
    received: "5h",
  },
  {
    id: "r2",
    leadId: "l6",
    name: "Sofia Lindqvist",
    company: "Marrow Studio",
    initials: "SL",
    excerpt: "Not right now, but ping me in Q4 when we've hired.",
    note: "classified: timing, not a no",
    noteIsDraft: false,
    klass: "Neutral",
    received: "1d",
  },
  {
    id: "r3",
    leadId: "l7",
    name: "Arjun Mehta",
    company: "Coastline Partners",
    initials: "AM",
    excerpt: "Can you send pricing for 3 senders?",
    note: "agent reached its conversation limit",
    noteIsDraft: false,
    klass: "Needs you",
    received: "2d",
  },
];

const ACTIVITY: TodayView["activity"]["rows"] = [
  {
    id: "a1",
    time: "7:58am",
    parts: [{ text: "Scored " }, { text: "42", mono: true }, { text: " new profiles → " }, { text: "8", mono: true }, { text: " above 70" }],
    actor: "Prospect agent",
  },
  { id: "a2", time: "7:31am", parts: [{ text: "Drafted " }, { text: "14", mono: true }, { text: " messages for approval" }], actor: "Outreach agent" },
  {
    id: "a3",
    time: "6:42am",
    parts: [{ text: "Warmup step raised to " }, { text: "10", mono: true }, { text: " invites/day (day " }, { text: "9", mono: true }, { text: ")" }],
    actor: "Jonas M.",
  },
  {
    id: "a4",
    time: "Yesterday 4:28pm",
    parts: [{ text: "Sent " }, { text: "18", mono: true }, { text: " invites and " }, { text: "9", mono: true }, { text: " messages — inside caps" }],
    actor: "Anna K.",
  },
  { id: "a5", time: "Yesterday 3:12pm", parts: [{ text: "Maya Chen", href: "/prospects/l1", strong: true }, { text: " accepted your invite" }], actor: "Anna K." },
  {
    id: "a6",
    time: "Yesterday 1:05pm",
    parts: [{ text: "Reply from " }, { text: "Daniel Okafor", href: "/prospects/l2", strong: true }, { text: " classified Interested — sequence stopped" }],
    actor: "Outreach agent",
  },
  { id: "a7", time: "Yesterday 11:40am", parts: [{ text: "You approved " }, { text: "12", mono: true }, { text: " drafts" }], actor: "You" },
];

const SENDERS: TodayView["senders"] = [
  {
    id: "s1",
    name: "Anna K.",
    status: "active",
    fraction: "23/45",
    warmup: false,
    tooltip: "14 of 20 invites · 9 of 25 messages today · 61 of 100 invites this week",
  },
  {
    id: "s2",
    name: "Jonas M.",
    status: "active",
    fraction: "8/35",
    warmup: true,
    tooltip: "5 of 10 invites · 3 of 25 messages today · 22 of 100 invites this week · day 9 of 28 · ramp 10/day",
  },
];

/** The steady state — the one the blueprint's §4.1 wireframe draws. */
export const STEADY: TodayView = {
  state: "steady",
  greeting: "Morning, Aiden.",
  sentence: "Overnight the engine drafted 14 messages and 3 people replied. Both senders are inside their limits.",
  primary: { label: "Open queue", count: 14, href: "/approvals" },
  banner: null,
  stats: [
    { label: "Sent · 7 days", value: "212", note: "‹31› today · ‹2› senders" },
    { label: "Replies · 7 days", value: "19", note: "‹9.0%› of sends" },
    { label: "Interested · 7 days", value: "6", note: "‹3› waiting on you" },
    { label: "Meetings · 7 days", value: "2", note: "next ‹Thu 10:30am›" },
  ],
  tiles: [
    {
      kind: "drafts",
      priority: 1,
      tone: "routine",
      glyph: "check-square",
      title: "Approve 14 drafts",
      meta: "top score ‹91› · first sends ‹2:10–4:30pm› via Anna K.",
      href: "/approvals",
      dismissible: false,
    },
    {
      kind: "replies",
      priority: 1,
      tone: "replies",
      glyph: "message-square",
      title: "3 replies waiting",
      meta: "‹2› interested · oldest ‹5h›",
      href: "/inbox?filter=waiting",
      dismissible: false,
    },
    {
      kind: "playbook_suggestion",
      priority: 3,
      tone: "routine",
      glyph: "sparkles",
      title: "Playbook suggestion",
      meta: "you rejected ‹3› agency owners under 10 people — exclude 1–10?",
      href: "/playbook?suggestion=p1",
      dismissible: true,
    },
  ],
  nextRunLabel: "3:00pm",
  queue: { rows: QUEUE, total: 14, approvedToday: 0 },
  replies: { rows: REPLIES, total: 3, answeredThisWeek: 16 },
  activity: { rows: ACTIVITY, engineStartedAgo: "3d" },
  senders: SENDERS,
  engine: {
    dot: "running",
    status: "Running",
    facts: ["next send ‹2:10pm› via Anna K.", "today ‹31› of ‹80›", "window Mon–Fri ‹8:00am–5:00pm› prospect time"],
    link: null,
  },
  updatedLabel: "8:04am",
  paused: false,
  defaultTab: "queue",
};

/** Nothing waiting: the page is over in one line. */
export const CAUGHT_UP: TodayView = {
  ...STEADY,
  state: "caught_up",
  sentence: "You're caught up. Next drafts are expected around 3:00pm; we'll email you when they land.",
  primary: null,
  tiles: [],
  queue: { rows: [], total: 0, approvedToday: 14 },
  replies: { rows: [], total: 0, answeredThisWeek: 19 },
  defaultTab: "activity",
};

/** One sender down: banner + repair tile + held rows + an attention engine line. */
export const SENDER_HELD: TodayView = {
  ...STEADY,
  state: "sender_held",
  sentence: "Jonas M. is disconnected, so 6 drafts are held. Everything else is running — 8 drafts are ready on Anna K.",
  primary: { label: "Reconnect Jonas M.", count: null, href: "/settings/senders#s2" },
  banner: {
    tone: "attention",
    message: "Jonas M. lost its LinkedIn connection at 6:42am. Nothing sends from it until you reconnect — drafts are held, not lost.",
    cta: { label: "Reconnect Jonas M.", href: "/settings/senders#s2" },
  },
  tiles: [
    {
      kind: "sender_disconnected",
      priority: 0,
      tone: "attention",
      glyph: "unplug",
      title: "Reconnect Jonas M.",
      meta: "dropped ‹6:42am› · ‹6› drafts held",
      href: "/settings/senders#s2",
      dismissible: false,
    },
    ...STEADY.tiles.slice(0, 2),
  ],
  queue: {
    rows: QUEUE.map((r) =>
      r.sends.sender === "Jonas M." ? { ...r, sends: { label: "held", sender: "Jonas M.", held: true } } : r
    ),
    total: 14,
    approvedToday: 0,
  },
  senders: [SENDERS[0]!, { ...SENDERS[1]!, status: "disconnected", warmup: false }],
  engine: {
    dot: "attention",
    status: "Jonas M. disconnected",
    facts: ["‹6› drafts held", "Anna K. sending normally"],
    link: { label: "Reconnect", href: "/settings/senders#s2" },
  },
};

/** The user paused the engine: approvals stay open, nothing sources or sends. */
export const PAUSED: TodayView = {
  ...STEADY,
  state: "paused",
  sentence: "The engine is paused. Approvals stay open; nothing is being sourced or sent until you resume it.",
  primary: { label: "Resume engine", count: null, href: "#resume", inline: "resume" },
  tiles: [
    {
      kind: "engine_paused",
      priority: 2,
      tone: "routine",
      glyph: "play",
      title: "Resume the engine",
      meta: "paused by you ‹4:12pm› · approvals still open",
      href: "#resume",
      dismissible: false,
      inline: "resume",
    },
    ...STEADY.tiles.slice(0, 2),
  ],
  paused: true,
  engine: { dot: "paused", status: "Paused by you ‹4:12pm›", facts: ["approvals open"], link: { label: "Resume", href: "#resume", inline: "resume" } },
};

/** The engine's first pass — the page fills itself. */
export const WORKING_EMPTY: TodayView = {
  ...STEADY,
  state: "working_empty",
  sentence: "The engine is on its first pass. First drafts are expected in about 26 minutes — this page fills itself.",
  primary: null,
  stats: [
    { label: "Sent · 7 days", value: "0", note: "none yet" },
    { label: "Replies · 7 days", value: "0", note: "none yet" },
    { label: "Interested · 7 days", value: "0", note: "none yet" },
    { label: "Meetings · 7 days", value: "0", note: "none yet" },
  ],
  tiles: [],
  queue: { rows: [], total: 0, approvedToday: 0 },
  replies: { rows: [], total: 0, answeredThisWeek: 0 },
  activity: { rows: [], engineStartedAgo: "12 min" },
  defaultTab: "activity",
};

/** Billing stopped the engine. */
export const STOPPED_BILLING: TodayView = {
  ...STEADY,
  state: "stopped_billing",
  sentence: "Sending is stopped until billing is sorted. Your queue and replies are safe.",
  primary: { label: "Update payment", count: null, href: "/settings/billing" },
  banner: {
    tone: "danger",
    message: "Your last payment failed. Sending pauses in 7 days unless the card is updated.",
    cta: { label: "Update payment", href: "/settings/billing" },
  },
  tiles: [
    {
      kind: "payment_failed",
      priority: 0,
      tone: "billing",
      glyph: "credit-card",
      title: "Update payment",
      meta: "failed ‹Aug 19› · sending pauses ‹Aug 26›",
      href: "/settings/billing",
      dismissible: false,
    },
    ...STEADY.tiles.slice(0, 2),
  ],
  engine: { dot: "stopped", status: "Stopped", facts: ["billing", "queue and replies kept"], link: { label: "Update payment", href: "/settings/billing" } },
};

export const PREVIEW_STATES = {
  steady: STEADY,
  caught_up: CAUGHT_UP,
  sender_held: SENDER_HELD,
  paused: PAUSED,
  working_empty: WORKING_EMPTY,
  stopped_billing: STOPPED_BILLING,
} as const;

export type PreviewStateKey = keyof typeof PREVIEW_STATES;
