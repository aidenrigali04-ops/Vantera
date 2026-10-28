import { z } from "zod";
import type { CopyLead } from "../copy/shared";
import type { StoredInsights } from "../prospect/schema";

export const STATE_VERSION = 1;

const trait = z.object({ value: z.number().min(0).max(1), confidence: z.number().min(0).max(1) }).nullable();
export type Trait = { value: number; confidence: number } | null;

const stageEnum = z.enum([
  "pre_contact", "invited", "connected", "opened", // we spoke, they haven't
  "engaged", // they replied, nothing substantive
  "exploring", // a problem/priority is on the table
  "qualified", // pain + fit + (some) authority
  "asked", // we proposed a next step, awaiting
  "booked", "declined", "dormant", "handed_off", "closed",
]);
export type Stage = z.infer<typeof stageEnum>;
export type Phase = "pre_reply" | "engaged" | "exploring" | "asked" | "after_no";
export type Archetype = `${"ic_mgr" | "dir_vp" | "cxo_founder"}:${"low" | "high" | "unknown"}:${"low" | "high" | "unknown"}`;

export type StoredTurn = {
  ref: string;
  role: "agent" | "lead" | "human";
  text: string;
  at: string;
  stage?: "invite" | "message";
  hook?: string | null;
};

export const conversationStateSchema = z.object({
  v: z.literal(1),
  stage: stageEnum,
  person: z.object({
    directness: trait,
    formality: trait,
    warmth: trait,
    skepticism: trait,
    verbosity: trait,
    seniority: z.enum(["ic", "manager", "director", "vp", "cxo", "founder", "unknown"]),
    role: z.enum(["buyer", "influencer", "seller_to_us", "gatekeeper", "recruiter", "unknown"]),
    /** how sure we are of `role` (0..1); a headline cue seeds 0.4, the reader raises it */
    roleConfidence: z.number().min(0).max(1).default(0),
    register: z.object({
      greeting: z.string().nullable(),
      signoff: z.string().nullable(),
      emoji: z.boolean(),
      avgSentenceWords: z.number().nullable(),
      language: z.string(),
    }),
    notes: z.array(z.string()).max(6),
  }),
  memory: z.object({
    hooksUsed: z.array(
      z.object({
        kind: z.enum(["trigger", "pain", "observation", "proof", "reframe"]),
        text: z.string(),
        messageRef: z.string(),
      }),
    ),
    questionsAsked: z.array(z.object({ text: z.string(), answered: z.boolean(), messageRef: z.string() })),
    claimsMade: z.array(z.string()),
    linksShared: z.object({ booking: z.number(), website: z.number(), content: z.number() }),
    problemsStated: z.array(z.string()),
    prioritiesStated: z.array(z.string()),
    objections: z.array(
      z.object({
        kind: z.enum(["dismissive", "situational", "existing_solution", "info_request", "what_is_this", "not_now", "wrong_person"]),
        text: z.string(),
        handled: z.boolean(),
      }),
    ),
    openLoops: z.array(z.string()),
    commitments: z.array(z.string()),
    explicitPositive: z.boolean(),
    explicitOptOut: z.boolean(),
    // terminal flags, set by the reader/pipeline (never by move names)
    booked: z.boolean(),
    declined: z.boolean(),
    handedOff: z.boolean(),
    closed: z.boolean(),
  }),
  qualification: z.object({
    painIdentified: z.boolean(),
    impactStated: z.boolean(),
    authority: z.enum(["decides", "influences", "none", "unknown"]),
    timing: z.enum(["now", "later", "never", "unknown"]),
  }),
  counters: z.object({
    agentTurns: z.number(),
    leadTurns: z.number(),
    questionsBudgetUsed: z.number(),
    asksMade: z.number(),
    followupsSinceLastReply: z.number(),
    /** agent turns sent since the latest lead turn (reducer-maintained; drives register mirroring) */
    agentTurnsSinceLastLead: z.number().default(0),
    labelsUsed: z.number(),
    connection: z.object({ invited: z.boolean(), connected: z.boolean() }),
  }),
  /** the move vocabulary is defined by the policy (Task 2); a string here */
  lastMove: z.object({ move: z.string(), at: z.string() }).nullable(),
  lastLeadMessageAt: z.string().nullable(),
  lastAgentMessageAt: z.string().nullable(),
});
export type ConversationState = z.infer<typeof conversationStateSchema>;

export function emptyState(): ConversationState {
  return {
    v: 1,
    stage: "pre_contact",
    person: {
      directness: null,
      formality: null,
      warmth: null,
      skepticism: null,
      verbosity: null,
      seniority: "unknown",
      role: "unknown",
      roleConfidence: 0,
      register: { greeting: null, signoff: null, emoji: false, avgSentenceWords: null, language: "en" },
      notes: [],
    },
    memory: {
      hooksUsed: [],
      questionsAsked: [],
      claimsMade: [],
      linksShared: { booking: 0, website: 0, content: 0 },
      problemsStated: [],
      prioritiesStated: [],
      objections: [],
      openLoops: [],
      commitments: [],
      explicitPositive: false,
      explicitOptOut: false,
      booked: false,
      declined: false,
      handedOff: false,
      closed: false,
    },
    qualification: { painIdentified: false, impactStated: false, authority: "unknown", timing: "unknown" },
    counters: {
      agentTurns: 0,
      leadTurns: 0,
      questionsBudgetUsed: 0,
      asksMade: 0,
      followupsSinceLastReply: 0,
      agentTurnsSinceLastLead: 0,
      labelsUsed: 0,
      connection: { invited: false, connected: false },
    },
    lastMove: null,
    lastLeadMessageAt: null,
    lastAgentMessageAt: null,
  };
}

function seniorityFromTitle(title: string): ConversationState["person"]["seniority"] {
  if (/\b(chief|cxo|ceo|cfo|cto|cro|coo|cmo)\b/i.test(title)) return "cxo";
  if (/\b(founder|co-founder|cofounder|owner)\b/i.test(title)) return "founder";
  if (/\b(vp|vice president|head of)\b/i.test(title)) return "vp";
  if (/\bdirector\b/i.test(title)) return "director";
  if (/\bmanager\b/i.test(title)) return "manager";
  return "ic";
}

/** Pre-contact seed (CopyLead has no headline field; `title` is the headline text): seniority from the title and a low-confidence role cue — nothing else. */
export function seedState(lead: CopyLead, _insights: StoredInsights | null): ConversationState {
  const s = emptyState();
  const title = (lead.title ?? "").trim();
  if (!title) return s;
  s.person.seniority = seniorityFromTitle(title);
  if (/recruit|talent acquisition/i.test(title)) {
    s.person.role = "recruiter";
    s.person.roleConfidence = 0.4;
    s.person.notes.push("headline reads like a recruiter");
  } else if (/helping|we help|agency|growth partner|business development|lead gen/i.test(title)) {
    s.person.role = "seller_to_us";
    s.person.roleConfidence = 0.4;
    s.person.notes.push("headline reads like a service provider");
  }
  return s;
}

/** Stage is a pure function of memory + counters, never set by an LLM or read from move names. */
export function deriveStage(state: ConversationState): Stage {
  const { memory, counters, qualification } = state;
  if (memory.closed) return "closed";
  if (memory.booked) return "booked";
  if (memory.explicitOptOut || memory.declined) return "declined";
  if (memory.handedOff) return "handed_off";
  if (counters.followupsSinceLastReply >= 3) return "dormant";
  const leadAfterAgent =
    !!state.lastLeadMessageAt && (!state.lastAgentMessageAt || state.lastLeadMessageAt > state.lastAgentMessageAt);
  if (counters.asksMade > 0 && !leadAfterAgent) return "asked";
  if (qualification.painIdentified && qualification.authority !== "none") return "qualified";
  if (memory.problemsStated.length > 0 || memory.prioritiesStated.length > 0) return "exploring";
  if (counters.leadTurns > 0) return "engaged";
  if (counters.agentTurns > 0) return "opened";
  if (counters.connection.connected) return "connected";
  if (counters.connection.invited) return "invited";
  return "pre_contact";
}

export function phaseOf(stage: Stage): Phase {
  switch (stage) {
    case "pre_contact":
    case "invited":
    case "connected":
    case "opened":
      return "pre_reply";
    case "engaged":
      return "engaged";
    case "exploring":
    case "qualified":
      return "exploring";
    case "asked":
    case "booked":
      return "asked";
    default:
      return "after_no";
  }
}

function bucket(t: Trait): "low" | "high" | "unknown" {
  if (!t || t.confidence < 0.5) return "unknown";
  return t.value >= 0.5 ? "high" : "low";
}

export function archetypeOf(person: ConversationState["person"]): Archetype {
  const tier =
    person.seniority === "director" || person.seniority === "vp"
      ? "dir_vp"
      : person.seniority === "cxo" || person.seniority === "founder"
        ? "cxo_founder"
        : "ic_mgr";
  return `${tier}:${bucket(person.skepticism)}:${bucket(person.directness)}`;
}

const MAX_RENDER = 2800;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const traitStr = (name: string, t: Trait) => (t ? `${name}=${t.value.toFixed(1)}(${t.confidence.toFixed(1)})` : null);

/** Compact text view of the state for prompts. Hard-capped at 2800 chars. */
export function renderState(state: ConversationState): string {
  const { person, memory, qualification, counters } = state;
  const traits = [
    traitStr("directness", person.directness),
    traitStr("formality", person.formality),
    traitStr("warmth", person.warmth),
    traitStr("skepticism", person.skepticism),
    traitStr("verbosity", person.verbosity),
  ].filter(Boolean);
  const lines: string[] = [
    `stage: ${state.stage} (${phaseOf(state.stage)}); archetype ${archetypeOf(person)}`,
    `person: ${person.seniority}, role ${person.role}, lang ${person.register.language}${person.register.emoji ? ", uses emoji" : ""}${traits.length ? `; ${traits.join(" ")}` : ""}`,
    `counters: agent ${counters.agentTurns}, lead ${counters.leadTurns}, questions ${counters.questionsBudgetUsed}, asks ${counters.asksMade}, unanswered followups ${counters.followupsSinceLastReply}`,
    `qualification: pain ${qualification.painIdentified}, impact ${qualification.impactStated}, authority ${qualification.authority}, timing ${qualification.timing}`,
    `signals: positive ${memory.explicitPositive}, opt-out ${memory.explicitOptOut}; links sent booking ${memory.linksShared.booking}, website ${memory.linksShared.website}, content ${memory.linksShared.content}`,
  ];
  if (state.lastMove) lines.push(`last move: ${state.lastMove.move}`);
  if (person.notes.length) lines.push(`notes: ${person.notes.map((n) => clip(n, 80)).join("; ")}`);
  if (memory.problemsStated.length) lines.push(`their problems: ${memory.problemsStated.slice(0, 3).map((p) => clip(p, 100)).join("; ")}`);
  if (memory.prioritiesStated.length) lines.push(`their priorities: ${memory.prioritiesStated.slice(0, 3).map((p) => clip(p, 100)).join("; ")}`);
  const open = memory.objections.filter((o) => !o.handled);
  if (open.length) lines.push(`open objections: ${open.slice(0, 3).map((o) => `${o.kind}: ${clip(o.text, 80)}`).join("; ")}`);
  if (memory.openLoops.length) lines.push(`we owe: ${memory.openLoops.slice(0, 3).map((o) => clip(o, 80)).join("; ")}`);
  if (memory.commitments.length) lines.push(`we promised: ${memory.commitments.slice(0, 3).map((o) => clip(o, 80)).join("; ")}`);
  if (memory.questionsAsked.length)
    lines.push(`questions asked: ${memory.questionsAsked.slice(-5).map((q) => `${q.answered ? "[answered]" : "[open]"} ${clip(q.text, 70)}`).join(" | ")}`);
  if (memory.hooksUsed.length)
    lines.push(`hooks used: ${memory.hooksUsed.slice(-10).map((h) => `${h.kind}: ${clip(h.text, 60)}`).join(" | ")}`);
  if (memory.claimsMade.length) lines.push(`claims made: ${memory.claimsMade.slice(-4).map((c) => clip(c, 80)).join("; ")}`);
  return clip(lines.join("\n"), MAX_RENDER);
}
