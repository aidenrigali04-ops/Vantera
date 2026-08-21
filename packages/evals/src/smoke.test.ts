import { describe, expect, it } from "vitest";
import {
  findActionClaims,
  findUnapprovedLinks,
  normalizeDashes,
  validateConversationMessage,
  allowedConversationLinks,
} from "@vantera/agent-brains";
import { getModel, registerPrompt } from "@vantera/ai";

// Proves the evals harness wires up to the package public API only (never deep `src/` paths),
// and that widening the agent-brains barrel (rule 13, WS-2) didn't break anything downstream.

describe("evals wiring smoke test", () => {
  it("imports the newly-barreled graders from @vantera/agent-brains as functions", () => {
    expect(typeof findActionClaims).toBe("function");
    expect(typeof findUnapprovedLinks).toBe("function");
    expect(typeof normalizeDashes).toBe("function");
    expect(typeof validateConversationMessage).toBe("function");
    expect(typeof allowedConversationLinks).toBe("function");
  });

  it("imports getModel and registerPrompt from @vantera/ai", () => {
    expect(typeof getModel).toBe("function");
    expect(typeof registerPrompt).toBe("function");
  });
});
