import { describe, expect, it } from "vitest";
import {
  archetypeOf,
  conversationStateSchema,
  deriveStage,
  emptyState,
  phaseOf,
  renderState,
  seedState,
  STATE_VERSION,
  type ConversationState,
} from "./state";

const lead = { firstName: "A", lastName: "B", title: "Head of Growth", companyName: "X", industry: null };

type Patch = {
  counters?: Partial<ConversationState["counters"]>;
  memory?: Partial<ConversationState["memory"]>;
  qualification?: Partial<ConversationState["qualification"]>;
  lastMove?: ConversationState["lastMove"];
};
function withPatch(s: ConversationState, p: Patch): ConversationState {
  return {
    ...s,
    counters: { ...s.counters, ...p.counters },
    memory: { ...s.memory, ...p.memory },
    qualification: { ...s.qualification, ...p.qualification },
    lastMove: p.lastMove === undefined ? s.lastMove : p.lastMove,
  };
}

describe("conversation state", () => {
  it("emptyState parses against the schema with stage pre_contact", () => {
    expect(STATE_VERSION).toBe(1);
    expect(conversationStateSchema.parse(emptyState()).stage).toBe("pre_contact");
  });

  it("seedState infers seniority from the title and nothing else", () => {
    const s = seedState({ firstName: "A", lastName: "B", title: "Chief Revenue Officer", companyName: "X", industry: null }, null);
    expect(s.person.seniority).toBe("cxo");
    expect(s.person.skepticism).toBeNull();
    expect(conversationStateSchema.parse(s)).toBeTruthy();
  });

  it.each([
    ["Co-Founder", "founder"],
    ["VP of Sales", "vp"],
    ["Head of Growth", "vp"],
    ["Sales Director", "director"],
    ["Marketing Manager", "manager"],
    ["Account Executive", "ic"],
    [null, "unknown"],
  ])("seniority from title %s → %s", (title, expected) => {
    expect(seedState({ ...lead, title }, null).person.seniority).toBe(expected);
  });

  it("seedState flags a likely reverse-seller from the headline at low confidence", () => {
    const s = seedState({ ...lead, title: "Helping founders grow | Business Development @ Agency" }, null);
    expect(s.person.role).toBe("seller_to_us");
    expect(s.person.notes).toContain("headline reads like a service provider");
  });

  it("seedState flags a recruiter", () => {
    expect(seedState({ ...lead, title: "Talent Acquisition Partner" }, null).person.role).toBe("recruiter");
  });

  it.each<[Patch, string]>([
    [{ counters: { agentTurns: 1, leadTurns: 0 } as never, memory: {} }, "opened"],
    [{ counters: { agentTurns: 1, leadTurns: 1 } as never, memory: {} }, "engaged"],
    [{ counters: { agentTurns: 1, leadTurns: 1 } as never, memory: { problemsStated: ["pipeline"] } }, "exploring"],
    [{ counters: { agentTurns: 2, leadTurns: 1, asksMade: 1 } as never, memory: { problemsStated: ["pipeline"] } }, "asked"],
    [{ memory: { explicitOptOut: true } }, "declined"],
    [{ counters: { connection: { invited: true, connected: false } } as never }, "invited"],
    [{ counters: { connection: { invited: true, connected: true } } as never }, "connected"],
    [{ counters: { agentTurns: 1, followupsSinceLastReply: 3 } as never }, "dormant"],
    [
      { counters: { agentTurns: 1, leadTurns: 1 } as never, memory: { problemsStated: ["x"] }, qualification: { painIdentified: true, authority: "decides" } },
      "qualified",
    ],
    [{ memory: { booked: true } }, "booked"],
    [{ memory: { declined: true } }, "declined"],
    [{ memory: { handedOff: true } }, "handed_off"],
    [{ memory: { closed: true } }, "closed"],
    [{ memory: { closed: true, booked: true, explicitOptOut: true, handedOff: true } }, "closed"],
    [{ memory: { booked: true, declined: true, handedOff: true } }, "booked"],
    [{ memory: { declined: true, handedOff: true } }, "declined"],
    [{ memory: { handedOff: true }, counters: { followupsSinceLastReply: 3 } as never }, "handed_off"],
  ])("deriveStage is a pure function of memory + counters: %j → %s", (patch, stage) => {
    expect(deriveStage(withPatch(emptyState(), patch))).toBe(stage);
  });

  it("phaseOf collapses 13 stages to 5 phases", () => {
    expect(phaseOf("connected")).toBe("pre_reply");
    expect(phaseOf("qualified")).toBe("exploring");
    expect(phaseOf("declined")).toBe("after_no");
    expect(phaseOf("engaged")).toBe("engaged");
    expect(phaseOf("booked")).toBe("asked");
  });

  it("archetypeOf buckets seniority × skepticism × directness, unknown when confidence < 0.5", () => {
    const person = emptyState().person;
    expect(
      archetypeOf({ ...person, seniority: "vp", skepticism: { value: 0.9, confidence: 0.8 }, directness: { value: 0.2, confidence: 0.3 } }),
    ).toBe("dir_vp:high:unknown");
    expect(archetypeOf({ ...person, seniority: "founder", skepticism: { value: 0.1, confidence: 0.9 }, directness: { value: 0.7, confidence: 0.5 } })).toBe(
      "cxo_founder:low:high",
    );
    expect(archetypeOf(person)).toBe("ic_mgr:unknown:unknown");
  });

  it("renderState stays under 2800 chars with 6 notes, 10 hooks and 5 questions", () => {
    const s = emptyState();
    const long = "x".repeat(300);
    s.person.notes = Array.from({ length: 6 }, () => long);
    s.memory.hooksUsed = Array.from({ length: 10 }, (_, i) => ({ kind: "pain" as const, text: long, messageRef: `m${i}` }));
    s.memory.questionsAsked = Array.from({ length: 5 }, (_, i) => ({ text: long, answered: false, messageRef: `q${i}` }));
    s.memory.problemsStated = [long, long, long];
    s.memory.claimsMade = [long, long];
    const out = renderState(s);
    expect(out.length).toBeLessThanOrEqual(2800);
    expect(out).toContain("stage");
  });

  it("renderState of an empty state is short and non-empty", () => {
    const out = renderState(emptyState());
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(800);
  });
});
