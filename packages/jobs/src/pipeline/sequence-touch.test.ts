import { describe, expect, it, vi } from "vitest";
import { RESPOND_SYSTEM, leadBlock, type ConversationMessageInput, type JudgeFn } from "@vantera/agent-brains";
import { getModelId } from "@vantera/ai";
import { MIN_TOUCH_GAP_HOURS, runSequenceTouch } from "./sequence-touch";
import { MAX_BEST_OF_N } from "./copy-draft";
import type { NewScheduledSend, ResponderBundle, SequenceTouchDeps, SequenceTouchDispatch } from "./types";

const NOW = new Date("2026-06-15T00:00:00Z");

const lead = {
  id: "l1",
  firstName: "Sam",
  lastName: "Lee",
  title: "VP",
  companyName: "Acme",
  industry: "saas",
  email: "sam@acme.com",
  linkedinUrl: "https://linkedin.com/in/sam",
  phone: "+15555550100",
  aiInsights: null,
  scoredAt: null as Date | null,
};

const bundle = (over: Partial<ResponderBundle> = {}): ResponderBundle => ({
  campaignId: "c1",
  sendMode: "automatic",
  lead: { firstName: "Sam", lastName: "Lee", title: "VP", companyName: "Acme", industry: "saas" },
  insights: {
    pain_points: ["pipeline coverage"],
    triggers: ["hiring SDRs"],
    motivations: ["growth"],
    value_angle: "fills funnel without headcount",
    aha_moment: "meetings in week one",
    summary: "fit",
  },
  context: { cta: "Book a 15-min call" },
  // a prior agent message in the thread — the follow-up must build on it, not restart
  thread: [{ role: "agent", text: "Thanks for connecting, Sam." }],
  agentTurns: 1,
  newestUnsentMessageCreatedAt: null,
  lastAgentMessageAt: null,
  humanHandled: false,
  attribution: { experimentId: null, variant: null, strategy: {}, playbookVersion: null },
  ...over,
});

function deps(
  over: Partial<SequenceTouchDeps["store"]> = {},
  refreshResult: "ok" | "dropped" = "ok",
  refreshedLeadIds: string[] = [],
  draftFollowupFn: SequenceTouchDeps["draftFollowupFn"] = vi.fn(async () => ({
    message: "Building on our chat — teams your size see meetings in week one. Worth a quick look?",
    violations: [],
  }))
): SequenceTouchDeps & { stoppedRunIds: string[]; draftFollowupFn: SequenceTouchDeps["draftFollowupFn"] } {
  const stoppedRunIds: string[] = [];
  return {
    stoppedRunIds,
    store: {
      getDraftableLead: async () => lead,
      getResponderBundle: async () => bundle(),
      isSuppressed: async () => false,
      insertScheduledSend: vi.fn(async () => {}),
      stopSequenceRun: vi.fn(async (runId: string) => { stoppedRunIds.push(runId); }),
      insertLeadNotification: vi.fn(async () => {}),
      ...over,
    },
    draftFollowupFn,
    now: () => NOW,
    refreshLead: async (_accountId, leadId) => {
      refreshedLeadIds.push(leadId);
      return refreshResult;
    },
  };
}

const dispatch: SequenceTouchDispatch = {
  runId: "r1",
  accountId: "a1",
  campaignId: "c1",
  leadId: "l1",
  stage: "linkedin",
  touchNo: 1,
};

describe("runSequenceTouch", () => {
  it("drafts a conversation-aware follow-up (body = the brain's message, not the connection note)", async () => {
    const d = deps();
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("drafted");
    expect(d.store.insertScheduledSend).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "linkedin",
        linkedinStage: "message",
        status: "approved", // automatic mode + clean draft
        body: "Building on our chat — teams your size see meetings in week one. Worth a quick look?",
      })
    );
  });

  it("feeds the running thread to the brain and does NOT pass an incoming message (proactive follow-up)", async () => {
    let captured: Parameters<SequenceTouchDeps["draftFollowupFn"]>[0] | undefined;
    const draftFn: SequenceTouchDeps["draftFollowupFn"] = vi.fn(async (input) => {
      captured = input;
      return { message: "next nudge", violations: [] };
    });
    const d = deps({}, "ok", [], draftFn);
    await runSequenceTouch(dispatch, d);
    expect(captured?.thread).toEqual([{ role: "agent", text: "Thanks for connecting, Sam." }]);
    expect(captured?.incoming).toBeUndefined();
  });

  it("stamps the proactive follow-up with a sequence_followup recipe carrying the lead's arm (Stage 1)", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({
      getResponderBundle: async () =>
        bundle({
          attribution: { experimentId: "exp-3", variant: "challenger", strategy: {}, playbookVersion: null },
        }),
      insertScheduledSend: insert,
    });
    await runSequenceTouch(dispatch, d);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe: {
          v: 2,
          brain: "sequence_followup",
          strategy: {},
          experimentId: "exp-3",
          variant: "challenger",
          playbookVersion: null,
          exemplars: 0,
          promptHash: RESPOND_SYSTEM.hash,
          modelId: getModelId(),
        },
      })
    );
  });

  it("stamps the proactive follow-up with the resolved strategy + playbook version (WS-3.1)", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({
      getResponderBundle: async () =>
        bundle({
          attribution: {
            experimentId: "exp-3",
            variant: "challenger",
            strategy: { askStyle: "specific" },
            playbookVersion: 3,
          },
        }),
      insertScheduledSend: insert,
    });
    await runSequenceTouch(dispatch, d);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        recipe: expect.objectContaining({
          strategy: { askStyle: "specific" },
          playbookVersion: 3,
        }),
      })
    );
  });

  it("queues for review when the agent is in review mode", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ getResponderBundle: async () => bundle({ sendMode: "review" }), insertScheduledSend: insert });
    await runSequenceTouch(dispatch, d);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_review" }));
  });

  it("stands down (never drafts) if a human took the thread over after this touch was dispatched", async () => {
    // Race: the orchestrator dispatched this touch while the run was active, then the user sent a
    // manual reply (paused_reply) before the task ran. The re-fetched bundle now reports
    // humanHandled — the proactive nudge must not fire on top of the human's message.
    const insert = vi.fn(async () => {});
    const d = deps({
      getResponderBundle: async () => bundle({ humanHandled: true }),
      insertScheduledSend: insert,
    });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("skipped");
    expect(insert).not.toHaveBeenCalled();
  });

  it("forces review on a style-flagged draft even in automatic mode", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "salesy", violations: [{ rule: "buzzword", detail: "game-changer" }] }));
    const d = deps({ insertScheduledSend: insert }, "ok", [], draftFn);
    await runSequenceTouch(dispatch, d);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_review", styleFlags: expect.any(String) })
    );
  });

  it("automatic mode: a flagged draft gets one fix pass, and a clean fix auto-sends the fixed body", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "salesy", violations: [{ rule: "buzzword", detail: "game-changer" }] }));
    const fixFn = vi.fn(async () => ({ message: "clean rewrite that builds on the thread", violations: [] }));
    const d = { ...deps({ insertScheduledSend: insert }, "ok", [], draftFn), fixFollowupFn: fixFn };
    await runSequenceTouch(dispatch, d);
    expect(fixFn).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "approved", body: "clean rewrite that builds on the thread", styleFlags: null })
    );
  });

  it("automatic mode: a still-flagged fix waits in review with its flags (never silent-sends)", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "salesy", violations: [{ rule: "buzzword", detail: "game-changer" }] }));
    const fixFn = vi.fn(async () => ({ message: "still salesy", violations: [{ rule: "buzzword", detail: "seamless" }] }));
    const d = { ...deps({ insertScheduledSend: insert }, "ok", [], draftFn), fixFollowupFn: fixFn };
    await runSequenceTouch(dispatch, d);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending_review", body: "still salesy", styleFlags: expect.any(String) })
    );
  });

  it("review mode: the fix pass is not spent — flags go straight to the queue's Fix button", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "salesy", violations: [{ rule: "buzzword", detail: "game-changer" }] }));
    const fixFn = vi.fn(async () => ({ message: "unused", violations: [] }));
    const d = {
      ...deps({ getResponderBundle: async () => bundle({ sendMode: "review" }), insertScheduledSend: insert }, "ok", [], draftFn),
      fixFollowupFn: fixFn,
    };
    await runSequenceTouch(dispatch, d);
    expect(fixFn).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: "pending_review" }));
  });

  it("never stacks: skips the touch while ANY message for the lead is still queued/in-flight", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "unused", violations: [] }));
    const d = deps(
      {
        getResponderBundle: async () =>
          bundle({ newestUnsentMessageCreatedAt: new Date("2026-06-14T00:00:00Z") }),
        insertScheduledSend: insert,
      },
      "ok",
      [],
      draftFn
    );
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("skipped");
    expect(draftFn).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("delivery-time floor: skips a touch drafted within MIN_TOUCH_GAP_HOURS of the last delivered message", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "unused", violations: [] }));
    const recent = new Date(NOW.getTime() - (MIN_TOUCH_GAP_HOURS - 1) * 3_600_000);
    const d = deps(
      { getResponderBundle: async () => bundle({ lastAgentMessageAt: recent }), insertScheduledSend: insert },
      "ok",
      [],
      draftFn
    );
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("skipped");
    expect(draftFn).not.toHaveBeenCalled();
  });

  it("drafts normally once the delivered gap has elapsed", async () => {
    const insert = vi.fn(async () => {});
    const old = new Date(NOW.getTime() - (MIN_TOUCH_GAP_HOURS + 1) * 3_600_000);
    const d = deps({ getResponderBundle: async () => bundle({ lastAgentMessageAt: old }), insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("drafted");
    expect(insert).toHaveBeenCalled();
  });

  it("skips when there is no conversation context (no live Outreach agent / no insights)", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ getResponderBundle: async () => null, insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("skipped");
    expect(insert).not.toHaveBeenCalled();
  });

  it("never drafts when the LinkedIn profile is suppressed", async () => {
    const insert = vi.fn(async () => {});
    const d = deps({ isSuppressed: async () => true, insertScheduledSend: insert });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("suppressed");
    expect(insert).not.toHaveBeenCalled();
  });

  it("skips when the lead has no LinkedIn URL", async () => {
    const d = deps({ getDraftableLead: async () => ({ ...lead, linkedinUrl: null }) });
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("skipped");
  });
});

describe("runSequenceTouch — refresh-on-release", () => {
  const agedScoredAt = new Date("2026-05-01T00:00:00Z"); // ~45 days before NOW
  const freshScoredAt = new Date("2026-06-13T00:00:00Z"); // ~2 days before NOW

  it("calls refreshLead for an aged lead and drafts when refresh returns ok — does not stop the run", async () => {
    const insert = vi.fn(async () => {});
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: agedScoredAt }), insertScheduledSend: insert },
      "ok",
      refreshedLeadIds
    );
    const out = await runSequenceTouch(dispatch, d);
    expect(refreshedLeadIds).toContain("l1");
    expect(out).toBe("drafted");
    expect(d.stoppedRunIds).toHaveLength(0);
  });

  it("returns 'dropped' for an aged lead when refresh returns dropped — stops the run, no draft", async () => {
    const insert = vi.fn(async () => {});
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: agedScoredAt }), insertScheduledSend: insert },
      "dropped",
      refreshedLeadIds
    );
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("dropped");
    expect(insert).not.toHaveBeenCalled();
    expect(d.stoppedRunIds).toContain(dispatch.runId);
  });

  it("does NOT call refreshLead for a fresh lead", async () => {
    const refreshedLeadIds: string[] = [];
    const d = deps(
      { getDraftableLead: async () => ({ ...lead, scoredAt: freshScoredAt }) },
      "ok",
      refreshedLeadIds
    );
    await runSequenceTouch(dispatch, d);
    expect(refreshedLeadIds).toHaveLength(0);
  });
});

// ── Phase 2C fast-follow: best-of-N judge-ranked follow-up selection ─────────
describe("runSequenceTouch — best-of-N (off by default)", () => {
  it("no bestOfN config, no judgeFn: byte-identical to today — one draft call, no bestOfN key on the recipe", async () => {
    const insert = vi.fn<(send: NewScheduledSend) => Promise<void>>(async () => {});
    const draftFn = vi.fn(async () => ({ message: "single draft", violations: [] }));
    const d = deps({ insertScheduledSend: insert }, "ok", [], draftFn);

    await runSequenceTouch(dispatch, d);

    expect(draftFn).toHaveBeenCalledTimes(1);
    const send = insert.mock.calls[0]![0] as NewScheduledSend;
    expect(send.body).toBe("single draft");
    expect(send.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=5 configured but judgeFn absent: forced to n=1 — one draft call, no bestOfN stamp", async () => {
    const insert = vi.fn<(send: NewScheduledSend) => Promise<void>>(async () => {});
    const draftFn = vi.fn(async () => ({ message: "single draft", violations: [] }));
    const d = { ...deps({ insertScheduledSend: insert }, "ok", [], draftFn), bestOfN: 5 };

    await runSequenceTouch(dispatch, d);

    expect(draftFn).toHaveBeenCalledTimes(1);
    const send = insert.mock.calls[0]![0] as NewScheduledSend;
    expect(send.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=1 with a judgeFn wired: still exactly one draft call and zero judge calls", async () => {
    const insert = vi.fn<(send: NewScheduledSend) => Promise<void>>(async () => {});
    const draftFn = vi.fn(async () => ({ message: "single draft", violations: [] }));
    const judgeFn = vi.fn<JudgeFn>();
    const d = { ...deps({ insertScheduledSend: insert }, "ok", [], draftFn), bestOfN: 1, judgeFn };

    await runSequenceTouch(dispatch, d);

    expect(draftFn).toHaveBeenCalledTimes(1);
    expect(judgeFn).not.toHaveBeenCalled();
    const send = insert.mock.calls[0]![0] as NewScheduledSend;
    expect(send.recipe).not.toHaveProperty("bestOfN");
  });

  it("bestOfN=3 + a judge: drafts 3 candidates, judges each on the SAME grounding/cta the humanizer uses, and stamps + queues the highest-scored one", async () => {
    const insert = vi.fn<(send: NewScheduledSend) => Promise<void>>(async () => {});
    let call = 0;
    let capturedInput: ConversationMessageInput | undefined;
    const draftFn: SequenceTouchDeps["draftFollowupFn"] = vi.fn(async (input) => {
      capturedInput = input;
      call += 1;
      return { message: `nudge-${call}`, violations: [] };
    });
    const scoreByMessage: Record<string, number> = { "nudge-1": 2, "nudge-2": 4, "nudge-3": 3 };
    const seenContexts: { grounding: string; cta?: string }[] = [];
    const judgeFn: JudgeFn = vi.fn(async (draft, ctx) => {
      seenContexts.push(ctx);
      return { overall: scoreByMessage[draft.text]! };
    });
    const d = { ...deps({ insertScheduledSend: insert }, "ok", [], draftFn), bestOfN: 3, judgeFn };

    await runSequenceTouch(dispatch, d);

    expect(draftFn).toHaveBeenCalledTimes(3);
    expect(judgeFn).toHaveBeenCalledTimes(3);
    const send = insert.mock.calls[0]![0] as NewScheduledSend;
    // nudge-2 scored highest (4) — it's the one queued.
    expect(send.body).toBe("nudge-2");
    expect(send.recipe).toMatchObject({ bestOfN: 3 });
    // the judge saw the exact same grounding block the humanizer/respond brain builds from this input.
    expect(capturedInput).toBeDefined();
    const expectedGrounding = leadBlock(capturedInput!);
    for (const ctx of seenContexts) {
      expect(ctx.grounding).toBe(expectedGrounding);
      expect(ctx.cta).toBe("Book a 15-min call");
    }
  });

  it("caps the effective n at MAX_BEST_OF_N regardless of a larger configured value", async () => {
    const insert = vi.fn<(send: NewScheduledSend) => Promise<void>>(async () => {});
    const draftFn = vi.fn(async () => ({ message: "nudge", violations: [] }));
    const judgeFn: JudgeFn = vi.fn(async () => ({ overall: 3 }));
    const d = { ...deps({ insertScheduledSend: insert }, "ok", [], draftFn), bestOfN: 999, judgeFn };

    await runSequenceTouch(dispatch, d);

    expect(draftFn).toHaveBeenCalledTimes(MAX_BEST_OF_N);
    expect(judgeFn).toHaveBeenCalledTimes(MAX_BEST_OF_N);
    const send = insert.mock.calls[0]![0] as NewScheduledSend;
    expect(send.recipe).toMatchObject({ bestOfN: MAX_BEST_OF_N });
  });

  it("suppression still runs BEFORE any draft, even with best-of-N configured — the brain is never called", async () => {
    const insert = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "nudge", violations: [] }));
    const judgeFn: JudgeFn = vi.fn(async () => ({ overall: 5 }));
    const d = {
      ...deps({ isSuppressed: async () => true, insertScheduledSend: insert }, "ok", [], draftFn),
      bestOfN: 3,
      judgeFn,
    };

    const out = await runSequenceTouch(dispatch, d);

    expect(out).toBe("suppressed");
    expect(draftFn).not.toHaveBeenCalled();
    expect(judgeFn).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("a judge-preferred candidate that's lint-dirty still gets ONE fix pass and routes to review if still dirty — the humanizer stays the hard floor", async () => {
    const insert = vi.fn<(send: NewScheduledSend) => Promise<void>>(async () => {});
    let call = 0;
    const draftFn: SequenceTouchDeps["draftFollowupFn"] = vi.fn(async () => {
      call += 1;
      return call === 2
        ? { message: "dirty nudge", violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }] }
        : { message: `clean nudge ${call}`, violations: [] };
    });
    const judgeFn: JudgeFn = vi.fn(async (draft) => ({ overall: draft.text === "dirty nudge" ? 5 : 1 }));
    const fixFn = vi.fn(async () => ({
      message: "still dirty",
      violations: [{ rule: "banned-phrase", detail: 'remove "seamless"' }],
    }));
    const d = {
      ...deps({ insertScheduledSend: insert }, "ok", [], draftFn),
      bestOfN: 3,
      judgeFn,
      fixFollowupFn: fixFn,
    };

    await runSequenceTouch(dispatch, d);

    // the fix pass ran exactly once, on the CHOSEN (dirty) candidate — never on the clean ones.
    expect(fixFn).toHaveBeenCalledOnce();
    expect(fixFn).toHaveBeenCalledWith(expect.objectContaining({ message: "dirty nudge" }), expect.anything());
    const send = insert.mock.calls[0]![0] as NewScheduledSend;
    // still flagged after the fix ⇒ never silently approved, exactly like today's single-draft path.
    expect(send.status).toBe("pending_review");
    expect(send.body).toBe("still dirty");
    expect(send.styleFlags).toContain("banned-phrase");
  });

  it("a judge-preferred candidate that's lint-dirty auto-approves once the fix pass cleans it (automatic mode)", async () => {
    const insert = vi.fn<(send: NewScheduledSend) => Promise<void>>(async () => {});
    let call = 0;
    const draftFn: SequenceTouchDeps["draftFollowupFn"] = vi.fn(async () => {
      call += 1;
      return call === 2
        ? { message: "dirty nudge", violations: [{ rule: "banned-phrase", detail: 'remove "game-changer"' }] }
        : { message: `clean nudge ${call}`, violations: [] };
    });
    const judgeFn: JudgeFn = vi.fn(async (draft) => ({ overall: draft.text === "dirty nudge" ? 5 : 1 }));
    const fixFn = vi.fn(async () => ({ message: "fixed nudge", violations: [] }));
    const d = {
      ...deps({ insertScheduledSend: insert }, "ok", [], draftFn),
      bestOfN: 3,
      judgeFn,
      fixFollowupFn: fixFn,
    };

    await runSequenceTouch(dispatch, d);

    expect(fixFn).toHaveBeenCalledOnce();
    const send = insert.mock.calls[0]![0] as NewScheduledSend;
    expect(send.status).toBe("approved");
    expect(send.body).toBe("fixed nudge");
    expect(send.styleFlags).toBeNull();
  });
});

describe("runSequenceTouch — converse-to-close turn cap (0044)", () => {
  it("past the cap: stops the run, notifies needs_human, drafts nothing", async () => {
    const insert = vi.fn(async () => {});
    const notify = vi.fn(async () => {});
    const draftFn = vi.fn(async () => ({ message: "unused", violations: [] }));
    const d = deps(
      {
        getResponderBundle: async () => bundle({ agentTurns: 6 }),
        insertScheduledSend: insert,
        insertLeadNotification: notify,
      },
      "ok",
      [],
      draftFn
    );
    const out = await runSequenceTouch(dispatch, d);
    expect(out).toBe("handed_off");
    expect(d.stoppedRunIds).toContain(dispatch.runId);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "needs_human", leadId: "l1" }));
    expect(draftFn).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });
});
