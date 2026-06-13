# AI Caller Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a third SDR agent kind (`caller`) that places AI voice calls to qualified leads to book meetings, with per-lead call-brief review and full suppression/compliance parity.

**Architecture:** Follows the locked six-piece SDR skeleton (rule 13). A new `voice-infra` package wraps Retell behind a swappable interface; a `caller/` brain drafts call briefs and classifies outcomes; pipeline cores draft briefs into `scheduled_sends` (`channel='call'`) and dispatch dial attempts into a new `calls` table at the send boundary; a wizard deploys the agent. Suppression (now including phone) is enforced before drafting and before dialing.

**Tech Stack:** TypeScript, pnpm/turbo monorepo, Vitest, Drizzle + Supabase Postgres (RLS), Trigger.dev v4, Next.js App Router, `@vantera/ai` (AI SDK, single entry), Retell REST.

**Reference spec:** `docs/superpowers/specs/2026-06-13-caller-agent-design.md`

**Conventions to honor throughout:**
- Tests are colocated `*.test.ts` next to the unit. Run a single package's tests with `pnpm --filter <pkg> test`.
- Brain modules import no Trigger/drizzle/DB (`packages/agent-brains/src/purity.test.ts` enforces).
- Only `packages/ai` imports `@ai-sdk/*` (`packages/ai/src/single-entry.test.ts`). The voice provider is a plain REST client — not an AI-SDK provider — so it is exempt.
- Every `trigger/<name>.ts` (except healthcheck) imports its core from `../pipeline/` (`packages/jobs/src/structure.test.ts`).
- Commit after every passing step.

---

## Task 1: `voice-infra` package scaffold + types

**Files:**
- Create: `packages/voice-infra/package.json`
- Create: `packages/voice-infra/tsconfig.json`
- Create: `packages/voice-infra/src/types.ts`
- Create: `packages/voice-infra/src/index.ts`

- [ ] **Step 1: Create `package.json`** (mirror `packages/linkedin-infra/package.json`)

```jsonc
{
  "name": "@vantera/voice-infra",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`** (copy `packages/linkedin-infra/tsconfig.json` verbatim).

- [ ] **Step 3: Write `src/types.ts`**

```ts
/** A drafted call brief the voice agent reads from when it dials. */
export interface CallBriefPayload {
  openingLine: string;
  talkingPoints: string[];
  objectionHandling: string[];
  goalStatement: string;
  bookingLink: string;
}

export interface PlaceCallRequest {
  fromNumber: string;
  toNumber: string;
  voiceId: string;
  language: string;
  personaName: string;
  brief: CallBriefPayload;
  /** when true the opening must announce the call is recorded (two-party consent) */
  announceRecording: boolean;
  /** rides through the provider as metadata so webhooks attribute back to the call row */
  callRef: string;
}

export interface CallHandle {
  providerCallId: string;
  startedAt: string;
}

export type VoiceEvent =
  | { type: "call_started"; providerCallId: string; callRef: string | null }
  | {
      type: "call_ended";
      providerCallId: string;
      callRef: string | null;
      rawDisposition: string;
      durationSec: number;
      recordingUrl: string | null;
      transcript: string | null;
    };

/**
 * Provider-agnostic outbound-voice interface (rule 03–05). Retell is an
 * implementation detail behind it. Calling windows, attempt caps, and pacing
 * live in the pipeline/scheduler, NOT here.
 */
export interface VoiceInfra {
  placeCall(req: PlaceCallRequest): Promise<CallHandle>;
  /**
   * Reject forged payloads BEFORE parsing. Real adapters must use a timing-safe
   * comparison (crypto.timingSafeEqual); the in-memory fake uses plain equality.
   */
  verifyWebhook(headers: Record<string, string>, rawBody: string): boolean;
  parseEventWebhook(payload: unknown): VoiceEvent | null;
}
```

- [ ] **Step 4: Write `src/index.ts`** (adapter exports added in later tasks)

```ts
export * from "./types";
```

- [ ] **Step 5: Verify it typechecks**

Run: `pnpm --filter @vantera/voice-infra typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/voice-infra
git commit -m "feat(voice-infra): package scaffold + provider-agnostic interface"
```

---

## Task 2: `voice-infra` in-memory fake

**Files:**
- Create: `packages/voice-infra/src/in-memory.ts`
- Test: `packages/voice-infra/src/in-memory.test.ts`
- Modify: `packages/voice-infra/src/index.ts`

- [ ] **Step 1: Write the failing test** in `in-memory.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { InMemoryVoiceInfra } from "./in-memory";
import type { PlaceCallRequest } from "./types";

const req: PlaceCallRequest = {
  fromNumber: "+15550000000",
  toNumber: "+15551112222",
  voiceId: "v1",
  language: "en-US",
  personaName: "Alex",
  brief: { openingLine: "hi", talkingPoints: [], objectionHandling: [], goalStatement: "book", bookingLink: "https://cal.com/x" },
  announceRecording: true,
  callRef: "call_1",
};

describe("InMemoryVoiceInfra", () => {
  it("records placed calls and returns a handle", async () => {
    const infra = new InMemoryVoiceInfra();
    const handle = await infra.placeCall(req);
    expect(handle.providerCallId).toMatch(/^call_/);
    expect(infra.placedCalls).toHaveLength(1);
    expect(infra.placedCalls[0].toNumber).toBe("+15551112222");
  });

  it("verifies the webhook secret", () => {
    const infra = new InMemoryVoiceInfra("s3cret");
    expect(infra.verifyWebhook({ "x-webhook-secret": "s3cret" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "nope" }, "{}")).toBe(false);
  });

  it("parses a call_ended event", () => {
    const infra = new InMemoryVoiceInfra();
    const ev = infra.parseEventWebhook({
      event_type: "call_ended",
      call_id: "pc_9",
      call_ref: "call_1",
      disposition: "booked",
      duration_sec: 92,
      recording_url: "https://rec/9",
      transcript: "hello...",
    });
    expect(ev).toEqual({
      type: "call_ended",
      providerCallId: "pc_9",
      callRef: "call_1",
      rawDisposition: "booked",
      durationSec: 92,
      recordingUrl: "https://rec/9",
      transcript: "hello...",
    });
  });

  it("returns null for an unknown event", () => {
    expect(new InMemoryVoiceInfra().parseEventWebhook({ event_type: "weird" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/voice-infra test`
Expected: FAIL — `InMemoryVoiceInfra` not found.

- [ ] **Step 3: Write `src/in-memory.ts`**

```ts
import type { CallHandle, PlaceCallRequest, VoiceEvent, VoiceInfra } from "./types";

/** Test/dev double. Also the reference behavior for real adapters. */
export class InMemoryVoiceInfra implements VoiceInfra {
  readonly placedCalls: PlaceCallRequest[] = [];
  private counter = 0;

  constructor(private readonly webhookSecret = "in-memory-secret") {}

  async placeCall(req: PlaceCallRequest): Promise<CallHandle> {
    this.placedCalls.push(req);
    return { providerCallId: `call_${++this.counter}`, startedAt: new Date().toISOString() };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    return headers["x-webhook-secret"] === this.webhookSecret;
  }

  parseEventWebhook(payload: unknown): VoiceEvent | null {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.call_id !== "string") return null;
    const callRef = typeof p.call_ref === "string" ? p.call_ref : null;
    switch (p.event_type) {
      case "call_started":
        return { type: "call_started", providerCallId: p.call_id, callRef };
      case "call_ended":
        if (typeof p.disposition !== "string" || typeof p.duration_sec !== "number") return null;
        return {
          type: "call_ended",
          providerCallId: p.call_id,
          callRef,
          rawDisposition: p.disposition,
          durationSec: p.duration_sec,
          recordingUrl: typeof p.recording_url === "string" ? p.recording_url : null,
          transcript: typeof p.transcript === "string" ? p.transcript : null,
        };
      default:
        return null;
    }
  }
}
```

- [ ] **Step 4: Add the export** to `src/index.ts`

```ts
export * from "./types";
export { InMemoryVoiceInfra } from "./in-memory";
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `pnpm --filter @vantera/voice-infra test`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/voice-infra/src
git commit -m "feat(voice-infra): in-memory fake + reference event parsing"
```

---

## Task 3: `voice-infra` Retell adapter

**Files:**
- Create: `packages/voice-infra/src/retell.ts`
- Test: `packages/voice-infra/src/retell.test.ts`
- Modify: `packages/voice-infra/src/index.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing test** in `retell.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { RetellVoiceInfra } from "./retell";
import type { PlaceCallRequest } from "./types";

const req: PlaceCallRequest = {
  fromNumber: "+15550000000",
  toNumber: "+15551112222",
  voiceId: "v1",
  language: "en-US",
  personaName: "Alex",
  brief: { openingLine: "hi", talkingPoints: ["a"], objectionHandling: [], goalStatement: "book", bookingLink: "https://cal.com/x" },
  announceRecording: true,
  callRef: "call_1",
};

describe("RetellVoiceInfra", () => {
  it("POSTs to the create-call endpoint and maps the response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ call_id: "pc_42" }), { status: 201 })
    );
    const infra = new RetellVoiceInfra({ apiKey: "k", webhookSecret: "s", fetchImpl: fetchMock });
    const handle = await infra.placeCall(req);
    expect(handle.providerCallId).toBe("pc_42");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/v2/create-phone-call");
    expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer k" });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.to_number).toBe("+15551112222");
    expect(body.metadata.call_ref).toBe("call_1");
  });

  it("throws on a non-2xx response", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 500 }));
    const infra = new RetellVoiceInfra({ apiKey: "k", webhookSecret: "s", fetchImpl: fetchMock });
    await expect(infra.placeCall(req)).rejects.toThrow(/voice provider/i);
  });

  it("verifyWebhook uses a length-safe compare", () => {
    const infra = new RetellVoiceInfra({ apiKey: "k", webhookSecret: "abc", fetchImpl: vi.fn() });
    expect(infra.verifyWebhook({ "x-webhook-secret": "abc" }, "{}")).toBe(true);
    expect(infra.verifyWebhook({ "x-webhook-secret": "ab" }, "{}")).toBe(false);
    expect(infra.verifyWebhook({}, "{}")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/voice-infra test retell`
Expected: FAIL — `RetellVoiceInfra` not found.

- [ ] **Step 3: Write `src/retell.ts`**

```ts
import { timingSafeEqual } from "node:crypto";
import { InMemoryVoiceInfra } from "./in-memory";
import type { CallHandle, PlaceCallRequest, VoiceEvent, VoiceInfra } from "./types";

const RETELL_BASE = "https://api.retellai.com";

export interface RetellConfig {
  apiKey: string;
  webhookSecret: string;
  fromNumber?: string;
  fetchImpl?: typeof fetch;
}

/** Composes the agent prompt the provider speaks from the structured brief. */
function briefToPrompt(req: PlaceCallRequest): string {
  const lines = [
    `You are ${req.personaName}, a friendly B2B sales rep. Speak naturally, never robotic.`,
    req.announceRecording ? `First, briefly say the call may be recorded.` : null,
    `Open with: "${req.brief.openingLine}"`,
    req.brief.talkingPoints.length ? `Talking points: ${req.brief.talkingPoints.join("; ")}` : null,
    req.brief.objectionHandling.length ? `If objections: ${req.brief.objectionHandling.join("; ")}` : null,
    `Goal: ${req.brief.goalStatement}. To book, offer this link: ${req.brief.bookingLink}.`,
  ];
  return lines.filter((l): l is string => l !== null).join("\n");
}

export class RetellVoiceInfra implements VoiceInfra {
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly cfg: RetellConfig) {
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async placeCall(req: PlaceCallRequest): Promise<CallHandle> {
    const res = await this.fetchImpl(`${RETELL_BASE}/v2/create-phone-call`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from_number: req.fromNumber,
        to_number: req.toNumber,
        metadata: { call_ref: req.callRef },
        retell_llm_dynamic_variables: { prompt: briefToPrompt(req), voice_id: req.voiceId, language: req.language },
      }),
    });
    if (!res.ok) throw new Error(`voice provider create-call failed: ${res.status}`);
    const json = (await res.json()) as { call_id: string };
    return { providerCallId: json.call_id, startedAt: new Date().toISOString() };
  }

  verifyWebhook(headers: Record<string, string>, _rawBody: string): boolean {
    const got = headers["x-webhook-secret"];
    if (typeof got !== "string") return false;
    const a = Buffer.from(got);
    const b = Buffer.from(this.cfg.webhookSecret);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  // event shape matches the in-memory reference; one parser, shared.
  parseEventWebhook(payload: unknown): VoiceEvent | null {
    return new InMemoryVoiceInfra().parseEventWebhook(payload);
  }
}

export function createVoiceInfraFromEnv(): VoiceInfra {
  const apiKey = process.env.VOICE_API_KEY;
  const webhookSecret = process.env.VOICE_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) throw new Error("VOICE_API_KEY and VOICE_WEBHOOK_SECRET are required");
  return new RetellVoiceInfra({ apiKey, webhookSecret, fromNumber: process.env.VOICE_FROM_NUMBER });
}
```

- [ ] **Step 4: Export the adapter** in `src/index.ts`

```ts
export * from "./types";
export { InMemoryVoiceInfra } from "./in-memory";
export { RetellVoiceInfra, createVoiceInfraFromEnv } from "./retell";
```

- [ ] **Step 5: Add env keys** to `.env.example` under the infra section (white-label naming, no "Retell")

```
# Outbound voice (caller agent). Vendor key + inbound webhook secret + shared caller ID.
VOICE_API_KEY=
VOICE_WEBHOOK_SECRET=
VOICE_FROM_NUMBER=
```

- [ ] **Step 6: Run tests, verify they pass**

Run: `pnpm --filter @vantera/voice-infra test`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add packages/voice-infra/src .env.example
git commit -m "feat(voice-infra): Retell adapter + env wiring"
```

---

## Task 4: Caller brain — zod schemas

**Files:**
- Create: `packages/agent-brains/src/caller/schema.ts`
- Test: `packages/agent-brains/src/caller/schema.test.ts`

- [ ] **Step 1: Write the failing test** in `schema.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { callBriefSchema, callOutcomeSchema } from "./schema";

describe("caller schemas", () => {
  it("accepts a well-formed brief", () => {
    const r = callBriefSchema.safeParse({
      opening_line: "Hi, this is Alex from Acme.",
      talking_points: ["churn is high"],
      objection_handling: ["if busy, offer a callback"],
      goal_statement: "book a 15-min intro",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an empty opening line", () => {
    const r = callBriefSchema.safeParse({ opening_line: "", talking_points: [], objection_handling: [], goal_statement: "x" });
    expect(r.success).toBe(false);
  });

  it("constrains outcome to the canonical enum", () => {
    expect(callOutcomeSchema.safeParse({ outcome: "booked" }).success).toBe(true);
    expect(callOutcomeSchema.safeParse({ outcome: "maybe" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/agent-brains test caller/schema`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/caller/schema.ts`**

```ts
import { z } from "zod";

export const callBriefSchema = z.object({
  opening_line: z.string().min(1).max(300),
  talking_points: z.array(z.string()).max(5),
  objection_handling: z.array(z.string()).max(5),
  goal_statement: z.string().min(1).max(200),
});

export type CallBriefOutput = z.infer<typeof callBriefSchema>;

export const CALL_OUTCOMES = [
  "booked",
  "callback",
  "not_interested",
  "no_answer",
  "voicemail",
  "do_not_call",
] as const;

export const callOutcomeSchema = z.object({ outcome: z.enum(CALL_OUTCOMES) });

export type CallOutcome = (typeof CALL_OUTCOMES)[number];
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @vantera/agent-brains test caller/schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/caller/schema.ts packages/agent-brains/src/caller/schema.test.ts
git commit -m "feat(caller-brain): brief + outcome zod schemas"
```

---

## Task 5: Caller brain — `draftCallBrief`

**Files:**
- Create: `packages/agent-brains/src/caller/brief.ts`
- Test: `packages/agent-brains/src/caller/brief.test.ts`

Reuses `leadBlock`/`DraftInput` from `../copy/shared` for the per-lead context block.

- [ ] **Step 1: Write the failing test** in `brief.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { draftCallBrief } from "./brief";
import type { DraftInput } from "../copy/shared";

const input: DraftInput = {
  lead: { firstName: "Sam", lastName: "Lee", title: "VP Ops", companyName: "Acme", industry: "Logistics" },
  insights: { pain_points: ["manual routing"], triggers: ["new funding"], motivations: ["scale"], value_angle: "cut routing time", aha_moment: "auto-routing", summary: "ops leader" },
  context: { cta: "book a 15-min intro", valueProp: "routing software", accountIndustry: "SaaS" },
};

function fakeModel(obj: unknown) {
  return { obj } as never; // generateObject is stubbed via the model param injection below
}

describe("draftCallBrief", () => {
  it("returns a structured brief with the booking link and no recording note for one-party", async () => {
    const generate = vi.fn(async () => ({
      opening_line: "Hi Sam, this is Alex from Acme.",
      talking_points: ["manual routing is costing you"],
      objection_handling: ["if busy, offer a callback"],
      goal_statement: "book a 15-min intro",
    }));
    const brief = await draftCallBrief(
      { input, bookingLink: "https://cal.com/x", recordingConsentMode: "one_party", personaName: "Alex" },
      fakeModel(null),
      generate
    );
    expect(brief.bookingLink).toBe("https://cal.com/x");
    expect(brief.openingLine).toContain("Alex");
    expect(brief.openingLine).not.toMatch(/recorded/i);
  });

  it("prepends a recorded-line disclosure for two-party consent", async () => {
    const generate = vi.fn(async () => ({
      opening_line: "Hi Sam, this is Alex from Acme.",
      talking_points: [],
      objection_handling: [],
      goal_statement: "book a 15-min intro",
    }));
    const brief = await draftCallBrief(
      { input, bookingLink: "https://cal.com/x", recordingConsentMode: "two_party", personaName: "Alex" },
      fakeModel(null),
      generate
    );
    expect(brief.openingLine).toMatch(/recorded/i);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/agent-brains test caller/brief`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/caller/brief.ts`**

```ts
import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@vantera/ai";
import { leadBlock, type DraftInput } from "../copy/shared";
import { callBriefSchema } from "./schema";

export interface CallBrief {
  openingLine: string;
  talkingPoints: string[];
  objectionHandling: string[];
  goalStatement: string;
  bookingLink: string;
}

export interface CallBriefRequest {
  input: DraftInput;
  bookingLink: string;
  recordingConsentMode: "one_party" | "two_party";
  personaName: string;
}

const RECORDING_DISCLOSURE = "Quick heads up — this call may be recorded. ";

const CALLER_SYSTEM = `You write a SHORT call brief a human-sounding B2B rep will speak from on a cold call. The goal is a booked meeting, never a hard pitch.

opening_line — under 300 chars: greet by first name, say who's calling, one warm reason for the call tied to their trigger or pain. No script-speak, no "I'm reaching out because", no buzzwords.
talking_points — up to 3 short cues tying their pain/trigger to the value angle as a concrete outcome.
objection_handling — up to 3 brief, calm responses (busy → offer a callback; not now → soft interest ask).
goal_statement — one line restating the CTA goal.
Plain, conversational, peer-to-peer. No formal sign-offs.`;

const CALLER_BRIEF_PROMPT = "model writes the call brief from the lead block";

export async function draftCallBrief(
  req: CallBriefRequest,
  model: LanguageModel = getModel(),
  generate: typeof generateObject = generateObject
): Promise<CallBrief> {
  const { object } = await generate({
    model,
    schema: callBriefSchema,
    system: CALLER_SYSTEM,
    prompt: `${CALLER_BRIEF_PROMPT}. Rep persona name: ${req.personaName}.\n\n${leadBlock(req.input)}`,
  });
  const openingLine =
    req.recordingConsentMode === "two_party"
      ? `${RECORDING_DISCLOSURE}${object.opening_line}`
      : object.opening_line;
  return {
    openingLine,
    talkingPoints: object.talking_points,
    objectionHandling: object.objection_handling,
    goalStatement: object.goal_statement,
    bookingLink: req.bookingLink,
  };
}
```

> Note: `generate` is injected so tests pass a stub without an `@ai-sdk` call. In tests the `model` param is unused by the stub. This keeps the brain pure and `@ai-sdk`-free at test time while still using `generateObject` in production.

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @vantera/agent-brains test caller/brief`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/caller/brief.ts packages/agent-brains/src/caller/brief.test.ts
git commit -m "feat(caller-brain): draftCallBrief with recorded-line disclosure"
```

---

## Task 6: Caller brain — `classifyOutcome`

**Files:**
- Create: `packages/agent-brains/src/caller/classify.ts`
- Test: `packages/agent-brains/src/caller/classify.test.ts`

- [ ] **Step 1: Write the failing test** in `classify.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { classifyOutcome, mapProviderDisposition } from "./classify";

describe("mapProviderDisposition", () => {
  it("maps obvious provider dispositions without an LLM call", () => {
    expect(mapProviderDisposition("no_answer")).toBe("no_answer");
    expect(mapProviderDisposition("voicemail")).toBe("voicemail");
    expect(mapProviderDisposition("unknown_thing")).toBeNull();
  });
});

describe("classifyOutcome", () => {
  it("returns the canonical outcome from the transcript", async () => {
    const generate = vi.fn(async () => ({ outcome: "booked" }));
    const out = await classifyOutcome("rep: ... prospect: yes book it", null as never, generate);
    expect(out).toBe("booked");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/agent-brains test caller/classify`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/caller/classify.ts`**

```ts
import { generateObject, type LanguageModel } from "ai";
import { getModel } from "@vantera/ai";
import { callOutcomeSchema, type CallOutcome } from "./schema";

/** Fast path: provider already tells us no-answer/voicemail; skip the LLM. */
export function mapProviderDisposition(raw: string): CallOutcome | null {
  if (raw === "no_answer" || raw === "voicemail") return raw;
  return null;
}

const CLASSIFY_SYSTEM = `Classify the result of a cold sales call from its transcript into exactly one outcome:
booked (a meeting was agreed), callback (asked to be called later), not_interested (declined),
do_not_call (asked never to be contacted), voicemail (left a message), no_answer (no live person).
Choose the single best fit.`;

export async function classifyOutcome(
  transcript: string,
  model: LanguageModel = getModel(),
  generate: typeof generateObject = generateObject
): Promise<CallOutcome> {
  const { object } = await generate({
    model,
    schema: callOutcomeSchema,
    system: CLASSIFY_SYSTEM,
    prompt: transcript,
  });
  return object.outcome;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @vantera/agent-brains test caller/classify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/agent-brains/src/caller/classify.ts packages/agent-brains/src/caller/classify.test.ts
git commit -m "feat(caller-brain): outcome classification with provider fast-path"
```

---

## Task 7: Export caller brain + verify purity

**Files:**
- Modify: `packages/agent-brains/src/index.ts`

- [ ] **Step 1: Add exports** to `index.ts` (append after the reply export)

```ts
export { callBriefSchema, callOutcomeSchema, CALL_OUTCOMES, type CallBriefOutput, type CallOutcome } from "./caller/schema";
export { draftCallBrief, type CallBrief, type CallBriefRequest } from "./caller/brief";
export { classifyOutcome, mapProviderDisposition } from "./caller/classify";
```

- [ ] **Step 2: Run the full agent-brains suite incl. the purity guardrail**

Run: `pnpm --filter @vantera/agent-brains test`
Expected: PASS — including `purity.test.ts` (no Trigger/drizzle/DB imports in the new modules).

- [ ] **Step 3: Commit**

```bash
git add packages/agent-brains/src/index.ts
git commit -m "feat(caller-brain): export caller modules"
```

---

## Task 8: DB migration `0013_caller_agent.sql`

**Files:**
- Create: `packages/db/migrations/0013_caller_agent.sql`
- Modify: `packages/db/src/schema.ts`

> Follow the `vantera-db-migrations` skill: RLS in the same migration; retention note on the new table; rls-auditor + `schema.test.ts` must pass.

- [ ] **Step 1: Write the migration** `0013_caller_agent.sql`

```sql
-- Migration #14: AI Caller agent (kind 'caller'). Third SDR agent on the six-piece
-- skeleton (rule 13). Adds phone to the suppression gate, a 'call' channel to the
-- review queue, and a calls table for dial execution + audit.
-- agents.config (caller): {cta, booking_link, voice:{voice_id,persona_name,language},
--   recording_consent_mode, calling_window:{days[],start_local,end_local}, max_attempts}

alter table public.agents drop constraint agents_kind_check;
alter table public.agents add constraint agents_kind_check
  check (kind in ('scout', 'copy', 'caller'));

-- phone joins email + linkedin as a suppression kind (E.164; satisfies value = lower(value))
alter table public.suppression_entries drop constraint suppression_entries_kind_check;
alter table public.suppression_entries add constraint suppression_entries_kind_check
  check (kind in ('email', 'linkedin', 'phone'));

-- 'call' joins the review queue; the structured brief rides in brief jsonb, human-readable in body
alter table public.scheduled_sends drop constraint scheduled_sends_channel_check;
alter table public.scheduled_sends add constraint scheduled_sends_channel_check
  check (channel in ('email', 'linkedin', 'call'));
alter table public.scheduled_sends add column brief jsonb;

-- voice joins email/linkedin as a webhook source (idempotency parity, 0009)
alter table public.webhook_events drop constraint webhook_events_source_check;
alter table public.webhook_events add constraint webhook_events_source_check
  check (source in ('email', 'linkedin', 'voice'));

-- retention(calls): one row per dial attempt; cascades with the lead. Terminal rows
-- purged by the 180-day scheduled_sends sweep companion (rule 11).
create table public.calls (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  lead_id uuid not null,
  agent_id uuid not null,
  campaign_id uuid not null,
  scheduled_send_id uuid not null,
  provider_call_id text,
  attempt_no smallint not null default 1,
  status text not null check (status in
    ('queued', 'dialing', 'in_progress', 'completed', 'no_answer', 'voicemail', 'failed')) default 'queued',
  outcome text check (outcome in
    ('booked', 'callback', 'not_interested', 'no_answer', 'voicemail', 'do_not_call')),
  duration_sec int,
  recording_url text,
  transcript text,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calls_lead_fk foreign key (lead_id, account_id)
    references public.leads (id, account_id) on delete cascade,
  constraint calls_agent_fk foreign key (agent_id, account_id)
    references public.agents (id, account_id) on delete cascade,
  constraint calls_campaign_fk foreign key (campaign_id, account_id)
    references public.campaigns (id, account_id) on delete cascade
);

create unique index calls_provider_call_idx on public.calls (provider_call_id) where provider_call_id is not null;
create index calls_account_status_idx on public.calls (account_id, status);
create index calls_lead_idx on public.calls (lead_id);
create index calls_send_idx on public.calls (scheduled_send_id);

alter table public.calls enable row level security;

create policy calls_select on public.calls
  for select to authenticated using (public.is_account_member(account_id));
-- writes arrive via the service-role pipeline only (no client write policy)

create trigger calls_set_updated_at
  before update on public.calls
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Mirror the changes in `schema.ts`** — add the `calls` table definition, extend the `kind`/`channel`/`source` enums, and add `brief` to `scheduledSends`. (Match the existing drizzle style in the file; the `calls` columns map 1:1 to the SQL above. `select`-only RLS table, same as `enrichmentResults`.)

- [ ] **Step 3: Run the schema guardrail tests**

Run: `pnpm --filter @vantera/db test`
Expected: PASS — RLS-from-day-one + retention-note checks pass for `calls`.

- [ ] **Step 4: Apply the migration locally** (per the migration skill's workflow), then commit.

```bash
git add packages/db/migrations/0013_caller_agent.sql packages/db/src/schema.ts
git commit -m "feat(db): caller agent migration — phone suppression, call channel, calls table"
```

---

## Task 9: Pipeline types for caller

**Files:**
- Modify: `packages/jobs/src/pipeline/types.ts`

- [ ] **Step 1: Extend `NewScheduledSend`** — widen `channel` and add the brief:

```ts
export interface NewScheduledSend {
  accountId: string;
  campaignId: string;
  leadId: string;
  channel: "email" | "linkedin" | "call";
  subject: string | null;
  body: string;
  status: "pending_review" | "approved";
  linkedinStage: "invite" | "message" | null;
  styleFlags: string | null;
  /** structured call brief (channel 'call' only); null otherwise */
  brief?: import("@vantera/agent-brains").CallBrief | null;
}
```

- [ ] **Step 2: Add caller config + context + deps interfaces** (append to the file):

```ts
import type { CallBrief, CallOutcome } from "@vantera/agent-brains";
import type { VoiceInfra } from "@vantera/voice-infra";

export interface CallerConfig {
  cta: string;
  bookingLink: string;
  voice: { voiceId: string; personaName: string; language: string };
  recordingConsentMode: "one_party" | "two_party";
  callingWindow: { days: string[]; startLocal: string; endLocal: string };
  maxAttempts: number;
}

export const CALLER_DEFAULTS = {
  maxAttempts: 3,
  callingWindow: { days: ["mon", "tue", "wed", "thu", "fri"], startLocal: "09:00", endLocal: "17:00" },
} as const;

export interface CallerContext {
  agent: { id: string; accountId: string; status: string; campaignId: string | null; config: CallerConfig };
  assets: { kind: string; url: string | null; filename: string | null }[];
  account: { industry: string | null; websiteScan: { summary?: string } | null };
}

export interface CallableLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  industry: string | null;
  phone: string | null;
  phoneStatus: "unvalidated" | "valid" | "invalid";
  aiInsights: import("@vantera/agent-brains").StoredInsights | null;
}

export interface CallBriefDraftPayload {
  callerAgentId: string;
  accountId: string;
  leadIds: string[];
}

export interface CallBriefStore {
  getCallerContext(callerAgentId: string): Promise<CallerContext | null>;
  getCallableLeads(accountId: string, leadIds: string[]): Promise<CallableLead[]>;
  /** rule-11 gate: phone normalized to E.164 lower-case before lookup */
  isSuppressed(accountId: string, kind: "phone", value: string): Promise<boolean>;
  ensureCampaignLead(campaignId: string, leadId: string, accountId: string): Promise<void>;
  setCampaignLeadStatus(campaignId: string, leadId: string, status: "queued" | "suppressed" | "skipped"): Promise<void>;
  insertScheduledSend(send: NewScheduledSend): Promise<void>;
  setLeadStatus(leadId: string, status: "in_campaign"): Promise<void>;
}

export interface CallBriefDeps {
  store: CallBriefStore;
  draftBriefFn: (req: import("@vantera/agent-brains").CallBriefRequest) => Promise<CallBrief>;
}

export interface CallBriefSummary {
  status: "completed" | "skipped";
  drafted: number;
  suppressed: number;
  skipped: number;
}

// --- dispatch (send boundary) ---
export interface DispatchableCall {
  id: string;
  accountId: string;
  campaignId: string;
  agentId: string;
  leadId: string;
  brief: CallBrief;
  phone: string;
  config: CallerConfig;
  attemptsSoFar: number;
  leadTimezone: string | null;
}

export interface CallDispatchStore {
  getApprovedCalls(): Promise<DispatchableCall[]>;
  isKillSwitchOn(): Promise<boolean>;
  isSuppressed(accountId: string, kind: "phone", value: string): Promise<boolean>;
  claimSending(sendId: string): Promise<boolean>;
  revertToApproved(sendId: string): Promise<void>;
  markSuppressed(sendId: string): Promise<void>;
  insertCall(c: {
    accountId: string; leadId: string; agentId: string; campaignId: string;
    scheduledSendId: string; providerCallId: string; attemptNo: number;
  }): Promise<void>;
  markSendSent(sendId: string): Promise<void>;
}

export interface CallDispatchDeps {
  store: CallDispatchStore;
  voiceInfra: VoiceInfra;
  fromNumber: string;
  now?: () => Date;
}

export type CallDispatchOutcome = "dialing" | "suppressed" | "outside_window" | "skipped" | "halted";

export interface VoiceInboundDeps {
  store: VoiceInboundStore;
  voiceInfra: Pick<VoiceInfra, "parseEventWebhook">;
  classifyFn: (transcript: string) => Promise<CallOutcome>;
  now?: () => Date;
}

export interface VoiceInboundStore {
  recordWebhookEvent(source: "voice", providerEventId: string, payload: unknown): Promise<boolean>;
  findCallByProviderId(providerCallId: string): Promise<{ id: string; accountId: string; leadId: string; phone: string | null } | null>;
  updateCallEnded(callId: string, e: { status: string; outcome: CallOutcome; durationSec: number; recordingUrl: string | null; transcript: string | null }): Promise<void>;
  updateCallStarted(callId: string): Promise<void>;
  addSuppression(accountId: string, kind: "phone", value: string, source: "not_interested", leadId?: string): Promise<void>;
}

export interface VoiceInboundSummary {
  handled: boolean;
  action: string;
}
```

- [ ] **Step 2b: Verify the package typechecks**

Run: `pnpm --filter @vantera/jobs typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/jobs/src/pipeline/types.ts
git commit -m "feat(jobs): caller pipeline interfaces (brief, dispatch, inbound)"
```

---

## Task 10: Pipeline core — `call-brief.ts`

**Files:**
- Create: `packages/jobs/src/pipeline/call-brief.ts`
- Test: `packages/jobs/src/pipeline/call-brief.test.ts`

- [ ] **Step 1: Write the failing test** in `call-brief.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { runCallBrief, normalizePhone } from "./call-brief";
import type { CallBriefDeps, CallableLead, CallerContext } from "./types";

const ctx: CallerContext = {
  agent: {
    id: "a1", accountId: "acc1", status: "live", campaignId: "camp1",
    config: {
      cta: "book a 15-min intro", bookingLink: "https://cal.com/x",
      voice: { voiceId: "v1", personaName: "Alex", language: "en-US" },
      recordingConsentMode: "two_party",
      callingWindow: { days: ["mon"], startLocal: "09:00", endLocal: "17:00" },
      maxAttempts: 3,
    },
  },
  assets: [],
  account: { industry: "SaaS", websiteScan: { summary: "routing software" } },
};

const lead: CallableLead = {
  id: "l1", firstName: "Sam", lastName: "Lee", title: "VP", companyName: "Acme",
  industry: "Logistics", phone: "+15551112222", phoneStatus: "valid",
  aiInsights: { pain_points: ["x"], triggers: [], motivations: [], value_angle: "v", aha_moment: "a", summary: "s" },
};

function deps(over: Partial<CallBriefDeps["store"]> = {}): CallBriefDeps {
  const inserted: unknown[] = [];
  const store = {
    getCallerContext: vi.fn(async () => ctx),
    getCallableLeads: vi.fn(async () => [lead]),
    isSuppressed: vi.fn(async () => false),
    ensureCampaignLead: vi.fn(async () => {}),
    setCampaignLeadStatus: vi.fn(async () => {}),
    insertScheduledSend: vi.fn(async (s) => { inserted.push(s); }),
    setLeadStatus: vi.fn(async () => {}),
    ...over,
  } as unknown as CallBriefDeps["store"];
  (store as unknown as { inserted: unknown[] }).inserted = inserted;
  return {
    store,
    draftBriefFn: vi.fn(async () => ({
      openingLine: "Hi Sam", talkingPoints: [], objectionHandling: [],
      goalStatement: "book", bookingLink: "https://cal.com/x",
    })),
  };
}

describe("normalizePhone", () => {
  it("lowercases and strips spaces (E.164 stays valid)", () => {
    expect(normalizePhone(" +1 555 111 2222 ")).toBe("+15551112222");
  });
});

describe("runCallBrief", () => {
  it("drafts a pending_review call send for a valid-phone lead", async () => {
    const d = deps();
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res).toMatchObject({ status: "completed", drafted: 1, suppressed: 0 });
    const inserted = (d.store as unknown as { inserted: { channel: string; status: string; brief: unknown }[] }).inserted;
    expect(inserted[0]).toMatchObject({ channel: "call", status: "pending_review" });
    expect(inserted[0].brief).toBeTruthy();
  });

  it("never drafts for a suppressed phone (rule 11)", async () => {
    const d = deps({ isSuppressed: vi.fn(async () => true) });
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res.drafted).toBe(0);
    expect(res.suppressed).toBe(1);
    expect(d.draftBriefFn).not.toHaveBeenCalled();
  });

  it("skips leads without a valid phone", async () => {
    const d = deps({ getCallableLeads: vi.fn(async () => [{ ...lead, phoneStatus: "unvalidated" as const }]) });
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res.drafted).toBe(0);
    expect(res.skipped).toBe(1);
  });

  it("skips when the agent is not live", async () => {
    const d = deps({ getCallerContext: vi.fn(async () => ({ ...ctx, agent: { ...ctx.agent, status: "paused" } })) });
    const res = await runCallBrief({ callerAgentId: "a1", accountId: "acc1", leadIds: ["l1"] }, d);
    expect(res.status).toBe("skipped");
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/jobs test call-brief`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/pipeline/call-brief.ts`**

```ts
import type { CallableLead, CallBriefDeps, CallBriefDraftPayload, CallBriefSummary, CallerContext } from "./types";
import type { CallBriefRequest, DraftInput } from "@vantera/agent-brains";

/** E.164 suppression value: trim, strip spaces, lowercase (digits/+ unaffected; rule 11 value=lower(value)). */
export function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim().toLowerCase();
}

function toRequest(lead: CallableLead, ctx: CallerContext): CallBriefRequest | null {
  if (!lead.aiInsights) return null;
  const input: DraftInput = {
    lead: { firstName: lead.firstName, lastName: lead.lastName, title: lead.title, companyName: lead.companyName, industry: lead.industry },
    insights: lead.aiInsights,
    context: {
      cta: ctx.agent.config.cta,
      contentLinks: ctx.assets.map((a) => a.url ?? a.filename).filter((v): v is string => Boolean(v)),
      accountIndustry: ctx.account.industry,
      valueProp: ctx.account.websiteScan?.summary ?? null,
    },
  };
  return {
    input,
    bookingLink: ctx.agent.config.bookingLink,
    recordingConsentMode: ctx.agent.config.recordingConsentMode,
    personaName: ctx.agent.config.voice.personaName,
  };
}

/**
 * Draft per-lead call briefs into the review queue (channel 'call', pending_review).
 * Suppression (phone) is checked BEFORE any brief is drafted (rule 11). Only leads
 * with a valid phone and AI insights are eligible.
 */
export async function runCallBrief(payload: CallBriefDraftPayload, deps: CallBriefDeps): Promise<CallBriefSummary> {
  const ctx = await deps.store.getCallerContext(payload.callerAgentId);
  if (!ctx || ctx.agent.status !== "live" || !ctx.agent.campaignId) {
    return { status: "skipped", drafted: 0, suppressed: 0, skipped: 0 };
  }
  const { accountId } = ctx.agent;
  const campaignId = ctx.agent.campaignId;
  const leads = await deps.store.getCallableLeads(accountId, payload.leadIds);

  let drafted = 0;
  let suppressed = 0;
  let skipped = 0;

  for (const lead of leads) {
    const req = toRequest(lead, ctx);
    if (!req || lead.phoneStatus !== "valid" || !lead.phone) {
      skipped += 1;
      continue;
    }
    if (await deps.store.isSuppressed(accountId, "phone", normalizePhone(lead.phone))) {
      await deps.store.ensureCampaignLead(campaignId, lead.id, accountId);
      await deps.store.setCampaignLeadStatus(campaignId, lead.id, "suppressed");
      suppressed += 1;
      continue;
    }
    const brief = await deps.draftBriefFn(req);
    await deps.store.ensureCampaignLead(campaignId, lead.id, accountId);
    await deps.store.insertScheduledSend({
      accountId, campaignId, leadId: lead.id, channel: "call",
      subject: null, body: brief.openingLine, status: "pending_review",
      linkedinStage: null, styleFlags: null, brief,
    });
    await deps.store.setCampaignLeadStatus(campaignId, lead.id, "queued");
    await deps.store.setLeadStatus(lead.id, "in_campaign");
    drafted += 1;
  }

  return { status: "completed", drafted, suppressed, skipped };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @vantera/jobs test call-brief`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/call-brief.ts packages/jobs/src/pipeline/call-brief.test.ts
git commit -m "feat(jobs): call-brief pipeline core — suppression-gated brief drafting"
```

---

## Task 11: Pipeline core — `call-dispatch.ts` (calling window + dial)

**Files:**
- Create: `packages/jobs/src/pipeline/call-dispatch.ts`
- Test: `packages/jobs/src/pipeline/call-dispatch.test.ts`

- [ ] **Step 1: Write the failing test** in `call-dispatch.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { runCallDispatch, isWithinCallingWindow } from "./call-dispatch";
import { InMemoryVoiceInfra } from "@vantera/voice-infra";
import type { CallDispatchDeps, DispatchableCall } from "./types";

const baseCall: DispatchableCall = {
  id: "s1", accountId: "acc1", campaignId: "camp1", agentId: "a1", leadId: "l1",
  brief: { openingLine: "hi", talkingPoints: [], objectionHandling: [], goalStatement: "book", bookingLink: "https://cal.com/x" },
  phone: "+15551112222",
  config: {
    cta: "book", bookingLink: "https://cal.com/x",
    voice: { voiceId: "v1", personaName: "Alex", language: "en-US" },
    recordingConsentMode: "two_party",
    callingWindow: { days: ["mon", "tue", "wed", "thu", "fri"], startLocal: "09:00", endLocal: "17:00" },
    maxAttempts: 3,
  },
  attemptsSoFar: 0,
  leadTimezone: "America/New_York",
};

describe("isWithinCallingWindow", () => {
  it("is true on a weekday at 10am local, false at 8pm", () => {
    const win = baseCall.config.callingWindow;
    // 2026-06-15 is a Monday. 14:00 UTC = 10:00 America/New_York (EDT)
    expect(isWithinCallingWindow(new Date("2026-06-15T14:00:00Z"), "America/New_York", win)).toBe(true);
    // 00:00 UTC Tuesday = 20:00 Monday EDT — outside 09:00–17:00
    expect(isWithinCallingWindow(new Date("2026-06-16T00:00:00Z"), "America/New_York", win)).toBe(false);
  });
});

function deps(infra = new InMemoryVoiceInfra(), over: Partial<CallDispatchDeps["store"]> = {}): CallDispatchDeps {
  const store = {
    getApprovedCalls: vi.fn(async () => [baseCall]),
    isKillSwitchOn: vi.fn(async () => false),
    isSuppressed: vi.fn(async () => false),
    claimSending: vi.fn(async () => true),
    revertToApproved: vi.fn(async () => {}),
    markSuppressed: vi.fn(async () => {}),
    insertCall: vi.fn(async () => {}),
    markSendSent: vi.fn(async () => {}),
    ...over,
  } as unknown as CallDispatchDeps["store"];
  return { store, voiceInfra: infra, fromNumber: "+15550000000", now: () => new Date("2026-06-15T14:00:00Z") };
}

describe("runCallDispatch", () => {
  it("dials an approved call inside the window and records the call row", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra);
    const res = await runCallDispatch(d);
    expect(res).toContainEqual({ sendId: "s1", outcome: "dialing" });
    expect(infra.placedCalls).toHaveLength(1);
    expect(d.store.insertCall).toHaveBeenCalled();
    expect(d.store.markSendSent).toHaveBeenCalledWith("s1");
  });

  it("re-checks suppression at the send boundary and never dials a suppressed phone", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra, { isSuppressed: vi.fn(async () => true) });
    const res = await runCallDispatch(d);
    expect(infra.placedCalls).toHaveLength(0);
    expect(d.store.markSuppressed).toHaveBeenCalledWith("s1");
    expect(res).toContainEqual({ sendId: "s1", outcome: "suppressed" });
  });

  it("defers calls outside the calling window without claiming them", async () => {
    const infra = new InMemoryVoiceInfra();
    const d = deps(infra);
    d.now = () => new Date("2026-06-16T00:00:00Z"); // 8pm Monday EDT
    const res = await runCallDispatch(d);
    expect(infra.placedCalls).toHaveLength(0);
    expect(d.store.claimSending).not.toHaveBeenCalled();
    expect(res).toContainEqual({ sendId: "s1", outcome: "outside_window" });
  });

  it("halts entirely when the kill switch is on", async () => {
    const d = deps(new InMemoryVoiceInfra(), { isKillSwitchOn: vi.fn(async () => true) });
    const res = await runCallDispatch(d);
    expect(res).toEqual([{ sendId: "*", outcome: "halted" }]);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/jobs test call-dispatch`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/pipeline/call-dispatch.ts`**

```ts
import type { CallDispatchDeps, CallDispatchOutcome, DispatchableCall } from "./types";
import { normalizePhone } from "./call-brief";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Evaluate the calling window in the PROSPECT's timezone (TCPA). Falls back to UTC if tz unknown. */
export function isWithinCallingWindow(
  now: Date,
  timezone: string | null,
  window: { days: string[]; startLocal: string; endLocal: string }
): boolean {
  const tz = timezone ?? "UTC";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  if (!window.days.includes(wd)) return false;
  const cur = hour * 60 + minute;
  const [sh, sm] = window.startLocal.split(":").map(Number);
  const [eh, em] = window.endLocal.split(":").map(Number);
  return cur >= sh * 60 + sm && cur < eh * 60 + em;
}

export interface CallDispatchResult {
  sendId: string;
  outcome: CallDispatchOutcome;
}

/**
 * Dispatch approved call briefs into live dial attempts.
 * Order of guards (rule 11 + TCPA): kill switch → calling window (prospect-local)
 * → attempt cap → claim → suppression re-check → place call → record.
 */
export async function runCallDispatch(deps: CallDispatchDeps): Promise<CallDispatchResult[]> {
  if (await deps.store.isKillSwitchOn()) return [{ sendId: "*", outcome: "halted" }];
  const now = deps.now?.() ?? new Date();
  const calls = await deps.store.getApprovedCalls();
  const results: CallDispatchResult[] = [];

  for (const call of calls) {
    const r = await dispatchOne(call, deps, now);
    results.push({ sendId: call.id, outcome: r });
  }
  return results;
}

async function dispatchOne(call: DispatchableCall, deps: CallDispatchDeps, now: Date): Promise<CallDispatchOutcome> {
  if (call.attemptsSoFar >= call.config.maxAttempts) return "skipped";
  if (!isWithinCallingWindow(now, call.leadTimezone, call.config.callingWindow)) return "outside_window";
  if (!(await deps.store.claimSending(call.id))) return "skipped";

  if (await deps.store.isSuppressed(call.accountId, "phone", normalizePhone(call.phone))) {
    await deps.store.markSuppressed(call.id);
    return "suppressed";
  }

  const handle = await deps.voiceInfra.placeCall({
    fromNumber: deps.fromNumber,
    toNumber: call.phone,
    voiceId: call.config.voice.voiceId,
    language: call.config.voice.language,
    personaName: call.config.voice.personaName,
    brief: call.brief,
    announceRecording: call.config.recordingConsentMode === "two_party",
    callRef: call.id,
  });
  await deps.store.insertCall({
    accountId: call.accountId, leadId: call.leadId, agentId: call.agentId,
    campaignId: call.campaignId, scheduledSendId: call.id,
    providerCallId: handle.providerCallId, attemptNo: call.attemptsSoFar + 1,
  });
  await deps.store.markSendSent(call.id);
  return "dialing";
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @vantera/jobs test call-dispatch`
Expected: PASS (5 tests, incl. window + suppression + kill-switch).

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/call-dispatch.ts packages/jobs/src/pipeline/call-dispatch.test.ts
git commit -m "feat(jobs): call-dispatch core — TCPA window + send-boundary suppression re-check"
```

---

## Task 12: Pipeline core — voice inbound (call results)

**Files:**
- Create: `packages/jobs/src/pipeline/voice-inbound.ts`
- Test: `packages/jobs/src/pipeline/voice-inbound.test.ts`

- [ ] **Step 1: Write the failing test** in `voice-inbound.test.ts`

```ts
import { describe, expect, it, vi } from "vitest";
import { runVoiceInbound } from "./voice-inbound";
import { InMemoryVoiceInfra } from "@vantera/voice-infra";
import type { VoiceInboundDeps } from "./types";

function deps(over: Partial<VoiceInboundDeps["store"]> = {}, classify = vi.fn(async () => "booked" as const)): VoiceInboundDeps {
  const store = {
    recordWebhookEvent: vi.fn(async () => true),
    findCallByProviderId: vi.fn(async () => ({ id: "c1", accountId: "acc1", leadId: "l1", phone: "+15551112222" })),
    updateCallEnded: vi.fn(async () => {}),
    updateCallStarted: vi.fn(async () => {}),
    addSuppression: vi.fn(async () => {}),
    ...over,
  } as unknown as VoiceInboundDeps["store"];
  return { store, voiceInfra: new InMemoryVoiceInfra(), classifyFn: classify };
}

const endedPayload = {
  event_type: "call_ended", call_id: "pc_9", call_ref: "c1",
  disposition: "completed", duration_sec: 88, recording_url: "https://rec/9", transcript: "yes book it",
};

describe("runVoiceInbound", () => {
  it("classifies an ended call and updates the call row", async () => {
    const d = deps();
    const res = await runVoiceInbound({ event_id: "e1", ...endedPayload }, d);
    expect(d.classifyFn).toHaveBeenCalledWith("yes book it");
    expect(d.store.updateCallEnded).toHaveBeenCalledWith("c1", expect.objectContaining({ outcome: "booked", durationSec: 88 }));
    expect(res.handled).toBe(true);
  });

  it("writes phone suppression on a not_interested outcome", async () => {
    const d = deps({}, vi.fn(async () => "not_interested" as const));
    await runVoiceInbound({ event_id: "e2", ...endedPayload }, d);
    expect(d.store.addSuppression).toHaveBeenCalledWith("acc1", "phone", "+15551112222", "not_interested", "l1");
  });

  it("writes phone suppression on a do_not_call outcome", async () => {
    const d = deps({}, vi.fn(async () => "do_not_call" as const));
    await runVoiceInbound({ event_id: "e3", ...endedPayload }, d);
    expect(d.store.addSuppression).toHaveBeenCalledWith("acc1", "phone", "+15551112222", "not_interested", "l1");
  });

  it("dedupes a repeat webhook (idempotency)", async () => {
    const d = deps({ recordWebhookEvent: vi.fn(async () => false) });
    const res = await runVoiceInbound({ event_id: "e1", ...endedPayload }, d);
    expect(res).toMatchObject({ handled: false, action: "duplicate" });
    expect(d.store.updateCallEnded).not.toHaveBeenCalled();
  });

  it("uses the provider fast-path for voicemail (no classify call)", async () => {
    const d = deps();
    await runVoiceInbound({ event_id: "e4", ...endedPayload, disposition: "voicemail" }, d);
    expect(d.classifyFn).not.toHaveBeenCalled();
    expect(d.store.updateCallEnded).toHaveBeenCalledWith("c1", expect.objectContaining({ outcome: "voicemail" }));
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `pnpm --filter @vantera/jobs test voice-inbound`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/pipeline/voice-inbound.ts`**

```ts
import { mapProviderDisposition } from "@vantera/agent-brains";
import type { VoiceInboundDeps, VoiceInboundSummary } from "./types";

/**
 * Process one inbound voice webhook. Dedupes via webhook_events, updates the call
 * row, classifies the outcome (provider fast-path first, else the transcript brain),
 * and writes phone suppression on not_interested/do_not_call (rule 11).
 * `payload.event_id` is the idempotency key.
 */
export async function runVoiceInbound(payload: unknown, deps: VoiceInboundDeps): Promise<VoiceInboundSummary> {
  const eventId = (payload as { event_id?: unknown }).event_id;
  if (typeof eventId !== "string") return { handled: false, action: "ignored" };

  const fresh = await deps.store.recordWebhookEvent("voice", eventId, payload);
  if (!fresh) return { handled: false, action: "duplicate" };

  const event = deps.voiceInfra.parseEventWebhook(payload);
  if (!event) return { handled: false, action: "ignored" };

  const providerId = event.providerCallId;
  const call = await deps.store.findCallByProviderId(providerId);
  if (!call) return { handled: false, action: "unmatched" };

  if (event.type === "call_started") {
    await deps.store.updateCallStarted(call.id);
    return { handled: true, action: "started" };
  }

  // call_ended
  const fast = mapProviderDisposition(event.rawDisposition);
  const outcome = fast ?? (event.transcript ? await deps.classifyFn(event.transcript) : "no_answer");
  await deps.store.updateCallEnded(call.id, {
    status: "completed",
    outcome,
    durationSec: event.durationSec,
    recordingUrl: event.recordingUrl,
    transcript: event.transcript,
  });
  if ((outcome === "not_interested" || outcome === "do_not_call") && call.phone) {
    await deps.store.addSuppression(call.accountId, "phone", call.phone, "not_interested", call.leadId);
  }
  return { handled: true, action: `ended:${outcome}` };
}
```

> Note on suppression source: `suppression_entries.source` enum does not include `do_not_call`; both interested-decline outcomes map to the existing `not_interested` source (the outcome is preserved on the `calls` row).

- [ ] **Step 4: Run tests, verify they pass**

Run: `pnpm --filter @vantera/jobs test voice-inbound`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/voice-inbound.ts packages/jobs/src/pipeline/voice-inbound.test.ts
git commit -m "feat(jobs): voice-inbound core — outcome classification + DNC suppression"
```

---

## Task 13: Drizzle store methods in `pg-store.ts`

**Files:**
- Modify: `packages/jobs/src/pipeline/pg-store.ts`

Implement the three new store interfaces (`CallBriefStore`, `CallDispatchStore`, `VoiceInboundStore`) against drizzle, following the existing `pg-store.ts` patterns (RLS bypassed via service role; composite-FK-safe inserts). Key implementation notes:

- [ ] **Step 1:** `getCallerContext(callerAgentId)` — select the `caller` agent + its campaign id + assets (`agent_assets`) + account industry/website_scan. Mirror `getCopyContext`. Map `config` jsonb into `CallerConfig` (snake→camel).
- [ ] **Step 2:** `getCallableLeads(accountId, leadIds)` — select leads by id where `account_id = accountId`, returning `phone`, `phone_status`, and `ai_insights`. Mirror `getDraftableLeads`.
- [ ] **Step 3:** `isSuppressed(accountId, "phone", value)` — reuse the existing suppression lookup with `kind = 'phone'` (the column already supports it after Task 8).
- [ ] **Step 4:** `insertScheduledSend` — extend the existing impl to write the new `brief` jsonb column when `channel = 'call'`.
- [ ] **Step 5:** `getApprovedCalls()` — join `scheduled_sends` (channel='call', status='approved') with `leads` (phone, timezone if present else null) and the owning `caller` agent's config; compute `attemptsSoFar` as `count(calls where scheduled_send_id = ...)`. Return `DispatchableCall[]`.
- [ ] **Step 6:** `claimSending`/`revertToApproved`/`markSuppressed`/`markSendSent` — reuse/extend the optimistic status transitions already used by `OutreachSendStore` (approved→sending→sent / →suppressed).
- [ ] **Step 7:** `insertCall(...)` — insert a `calls` row (`status='dialing'`, `started_at=now()`).
- [ ] **Step 8:** voice-inbound methods: `recordWebhookEvent('voice', id, payload)` (insert into `webhook_events`, return false on unique conflict), `findCallByProviderId`, `updateCallStarted`, `updateCallEnded`, and `addSuppression(..., 'phone', ...)` (reuse the existing suppression insert with `kind='phone'`).
- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @vantera/jobs typecheck`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add packages/jobs/src/pipeline/pg-store.ts
git commit -m "feat(jobs): drizzle store methods for caller brief/dispatch/inbound"
```

---

## Task 14: Thin trigger task wrappers

**Files:**
- Create: `packages/jobs/src/trigger/call-brief.ts`
- Create: `packages/jobs/src/trigger/call-dispatch.ts`
- Create: `packages/jobs/src/trigger/process-voice-webhook.ts`

Each wrapper only wires real deps + logs; logic stays in the core (enforced by `structure.test.ts`). Mirror `trigger/copy-draft.ts` and `trigger/outreach-send.ts`.

- [ ] **Step 1: Write `trigger/call-brief.ts`**

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { draftCallBrief } from "@vantera/agent-brains";
import { runCallBrief } from "../pipeline/call-brief";
import { makePgStore } from "../pipeline/pg-store";

export const callBriefTask = schemaTask({
  id: "call-brief",
  schema: z.object({ callerAgentId: z.string(), accountId: z.string(), leadIds: z.array(z.string()) }),
  run: async (payload) => {
    const store = makePgStore();
    return runCallBrief(payload, { store, draftBriefFn: (req) => draftCallBrief(req) });
  },
});
```

- [ ] **Step 2: Write `trigger/call-dispatch.ts`** (cron, mirrors send-dispatch cadence)

```ts
import { schedules } from "@trigger.dev/sdk";
import { createVoiceInfraFromEnv } from "@vantera/voice-infra";
import { runCallDispatch } from "../pipeline/call-dispatch";
import { makePgStore } from "../pipeline/pg-store";

export const callDispatchTask = schedules.task({
  id: "call-dispatch",
  cron: "*/15 * * * *",
  run: async () => {
    const store = makePgStore();
    return runCallDispatch({
      store,
      voiceInfra: createVoiceInfraFromEnv(),
      fromNumber: process.env.VOICE_FROM_NUMBER ?? "",
    });
  },
});
```

- [ ] **Step 3: Write `trigger/process-voice-webhook.ts`**

```ts
import { schemaTask } from "@trigger.dev/sdk";
import { z } from "zod";
import { classifyOutcome } from "@vantera/agent-brains";
import { createVoiceInfraFromEnv } from "@vantera/voice-infra";
import { runVoiceInbound } from "../pipeline/voice-inbound";
import { makePgStore } from "../pipeline/pg-store";

export const processVoiceWebhookTask = schemaTask({
  id: "process-voice-webhook",
  schema: z.object({ payload: z.unknown() }),
  run: async ({ payload }) => {
    const store = makePgStore();
    return runVoiceInbound(payload, {
      store,
      voiceInfra: createVoiceInfraFromEnv(),
      classifyFn: (t) => classifyOutcome(t),
    });
  },
});
```

- [ ] **Step 4: Run the structure guardrail**

Run: `pnpm --filter @vantera/jobs test structure`
Expected: PASS — each new trigger file imports its core from `../pipeline/`.

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/trigger/call-brief.ts packages/jobs/src/trigger/call-dispatch.ts packages/jobs/src/trigger/process-voice-webhook.ts
git commit -m "feat(jobs): thin trigger wrappers for caller brief/dispatch/webhook"
```

---

## Task 15: Chain caller from the Scout run; webhook route

**Files:**
- Modify: `packages/jobs/src/pipeline/scout.ts` + `types.ts` (add `triggerCallBrief` + `getLiveCallerAgent`)
- Modify: `packages/jobs/src/pipeline/pg-store.ts` (`getLiveCallerAgent`)
- Create: `apps/web/src/app/api/webhooks/voice/route.ts`

- [ ] **Step 1:** In `ScoutDeps`/`ScoutStore` add `getLiveCallerAgent(accountId)` and `triggerCallBrief(payload)`, mirroring the existing `getLiveCopyAgent`/`triggerCopyDraft`. After qualifying leads, if a live caller agent exists, chain the qualified `leadIds` to it (same place the copy chain fires). Add a test in `scout.test.ts` asserting the caller chain fires when a live caller exists. Keep the copy chain unchanged.

- [ ] **Step 2:** Implement `getLiveCallerAgent` in `pg-store.ts` (select agent where `kind='caller'` and `status='live'`).

- [ ] **Step 3: Write the webhook route** `apps/web/src/app/api/webhooks/voice/route.ts` (mirror the email/linkedin webhook routes — verify secret via `createVoiceInfraFromEnv().verifyWebhook`, then `tasks.trigger("process-voice-webhook", { payload })`, return 200 fast).

- [ ] **Step 4: Run jobs tests**

Run: `pnpm --filter @vantera/jobs test`
Expected: PASS (full suite, incl. scout chain).

- [ ] **Step 5: Commit**

```bash
git add packages/jobs/src/pipeline/scout.ts packages/jobs/src/pipeline/types.ts packages/jobs/src/pipeline/pg-store.ts apps/web/src/app/api/webhooks/voice/route.ts
git commit -m "feat(jobs): chain caller from scout run + inbound voice webhook route"
```

---

## Task 16: Wizard validation

**Files:**
- Modify: `apps/web/src/app/(app)/agents/validation.ts`
- Test: `apps/web/src/app/(app)/agents/validation.test.ts`

- [ ] **Step 1: Write failing tests** (append to `validation.test.ts`)

```ts
import { validateCallerConfig, clampCallingWindow, TCPA_EARLIEST, TCPA_LATEST } from "./validation";

describe("validateCallerConfig", () => {
  it("accepts a complete config", () => {
    expect(validateCallerConfig({
      cta: "book a demo", bookingLink: "https://cal.com/x",
      voice: { voiceId: "v1", personaName: "Alex", language: "en-US" },
      recordingConsentMode: "two_party",
      callingWindow: { days: ["mon"], startLocal: "09:00", endLocal: "17:00" }, maxAttempts: 3,
    }).ok).toBe(true);
  });

  it("rejects a non-URL booking link", () => {
    const r = validateCallerConfig({ cta: "x", bookingLink: "not-a-url", voice: { voiceId: "v", personaName: "A", language: "en-US" }, recordingConsentMode: "one_party", callingWindow: { days: ["mon"], startLocal: "09:00", endLocal: "17:00" }, maxAttempts: 1 });
    expect(r.ok).toBe(false);
  });

  it("clamps the calling window into TCPA bounds (08:00–21:00)", () => {
    expect(clampCallingWindow({ days: ["mon"], startLocal: "06:00", endLocal: "23:00" }))
      .toEqual({ days: ["mon"], startLocal: TCPA_EARLIEST, endLocal: TCPA_LATEST });
  });

  it("rejects an empty day list", () => {
    const r = validateCallerConfig({ cta: "x", bookingLink: "https://cal.com/x", voice: { voiceId: "v", personaName: "A", language: "en-US" }, recordingConsentMode: "one_party", callingWindow: { days: [], startLocal: "09:00", endLocal: "17:00" }, maxAttempts: 1 });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `pnpm --filter web test validation`
Expected: FAIL — `validateCallerConfig` not found.

- [ ] **Step 3: Implement** in `validation.ts`

```ts
export const TCPA_EARLIEST = "08:00";
export const TCPA_LATEST = "21:00";
const MAX_ATTEMPTS_CEILING = 5;

export interface CallerConfigInput {
  cta: string;
  bookingLink: string;
  voice: { voiceId: string; personaName: string; language: string };
  recordingConsentMode: "one_party" | "two_party";
  callingWindow: { days: string[]; startLocal: string; endLocal: string };
  maxAttempts: number;
}

export function clampCallingWindow(w: { days: string[]; startLocal: string; endLocal: string }) {
  const start = w.startLocal < TCPA_EARLIEST ? TCPA_EARLIEST : w.startLocal;
  const end = w.endLocal > TCPA_LATEST ? TCPA_LATEST : w.endLocal;
  return { days: w.days, startLocal: start, endLocal: end };
}

export function validateCallerConfig(c: CallerConfigInput): { ok: boolean; error?: string } {
  if (!c.cta.trim()) return { ok: false, error: "CTA is required" };
  try {
    const u = new URL(c.bookingLink);
    if (u.protocol !== "https:") return { ok: false, error: "Booking link must be https" };
  } catch {
    return { ok: false, error: "Booking link must be a valid URL" };
  }
  if (!c.voice.voiceId || !c.voice.personaName.trim()) return { ok: false, error: "Voice and persona name are required" };
  if (c.callingWindow.days.length === 0) return { ok: false, error: "Pick at least one calling day" };
  if (c.callingWindow.startLocal >= c.callingWindow.endLocal) return { ok: false, error: "Calling window start must precede end" };
  if (c.maxAttempts < 1 || c.maxAttempts > MAX_ATTEMPTS_CEILING) return { ok: false, error: `Max attempts must be 1–${MAX_ATTEMPTS_CEILING}` };
  return { ok: true };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `pnpm --filter web test validation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/agents/validation.ts" "apps/web/src/app/(app)/agents/validation.test.ts"
git commit -m "feat(web): caller config validation + TCPA window clamp"
```

---

## Task 17: Server action — deploy caller

**Files:**
- Modify: `apps/web/src/app/(app)/agents/actions.ts`

- [ ] **Step 1:** Add `deployCallerAgent(formData)` mirroring `deployCopyAgent`: resolve account from session (never accept accountId), require a live `scout` agent, `validateCallerConfig` + `clampCallingWindow`, upsert the `caller` agent row (`config` jsonb), auto-create the internal campaign (`send_mode: 'review'`), persist `agent_assets`, flip `status='live'`, set `deployed_at`. Reuse the copy agent's campaign-creation helper.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/agents/actions.ts"
git commit -m "feat(web): deployCallerAgent server action"
```

---

## Task 18: Wizard pages + card

**Files:**
- Create: `apps/web/src/app/(app)/agents/new/caller/page.tsx`
- Create: `apps/web/src/app/(app)/agents/caller-wizard.tsx`
- Create: `apps/web/src/app/(app)/agents/caller/edit/page.tsx`
- Modify: `apps/web/src/app/(app)/agents/agent-showcase-data.ts` (add the caller card)

- [ ] **Step 1:** Build `caller-wizard.tsx` as a client component composing `components/wizard/wizard-shell.tsx` with the steps from the spec: Name → ICP (read-only, fetched from the live Scout) → Goal & Booking (`cta` + `bookingLink`) → Voice & Identity (`personaName`, `voiceId` select, `language`) → Add Content (reuse the copy wizard's asset uploader, skippable) → Calling Window (day toggles + start/end pickers bounded to 08:00–21:00 + `maxAttempts` + `recordingConsentMode`) → Finish (deploy summary) → Deploy (calls `deployCallerAgent`). Never hand-roll the stepper.

- [ ] **Step 2:** `new/caller/page.tsx` (server) loads the live Scout's ICPs and renders `<CallerWizard>`. `caller/edit/page.tsx` loads the existing caller agent for editing. Mirror the scout/copy page pairs.

- [ ] **Step 3:** Add the caller agent card to `agent-showcase-data.ts` (name, blurb, icon) so it appears on `/agents`.

- [ ] **Step 4: Typecheck + build**

Run: `pnpm --filter web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/agents/new/caller" "apps/web/src/app/(app)/agents/caller-wizard.tsx" "apps/web/src/app/(app)/agents/caller/edit" "apps/web/src/app/(app)/agents/agent-showcase-data.ts"
git commit -m "feat(web): caller agent setup wizard + card"
```

---

## Task 19: Help article + rule/roadmap updates

**Files:**
- Create: `packages/help-content/content/agents-caller.md`
- Modify: `.claude/rules/08-campaign-pipeline.md`
- Modify: `docs/roadmap.md`

- [ ] **Step 1:** Write `agents-caller.md` — what the AI Caller does, the wizard steps, that every call waits for review, calling-hours/recording compliance, and outcomes. **No vendor names** (whitelabel-auditor).

- [ ] **Step 2:** Add a Caller Agent section to rule 08 (wizard steps + behavior contract: briefs draft as leads qualify, calls dispatch at the send boundary inside the calling window, outcomes classified, DNC → suppression).

- [ ] **Step 3:** Tick the caller agent item on `docs/roadmap.md`.

- [ ] **Step 4: Run the help-content guardrails**

Run: `pnpm --filter @vantera/help-content test`
Expected: PASS — `articles.test.ts` (no vendor names) passes.

- [ ] **Step 5: Commit**

```bash
git add packages/help-content/content/agents-caller.md .claude/rules/08-campaign-pipeline.md docs/roadmap.md
git commit -m "docs(caller): help article + rule 08 + roadmap"
```

---

## Task 20: Full verification sweep

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test` (or `pnpm turbo test`)
Expected: PASS across all packages — including the guardrails: brain purity, single-AI-entry, thin-trigger structure, schema RLS/retention, and the suppression DoD tests (`call-brief.test.ts` + `call-dispatch.test.ts` prove a phone-suppressed lead is never dialed).

- [ ] **Step 2: Typecheck the monorepo**

Run: `pnpm turbo typecheck`
Expected: no errors.

- [ ] **Step 3:** Hand off to the `ship-phase` skill for the definition-of-done sweep + branch finishing.

---

## Self-review notes (coverage check against the spec)

- §1 DB identity → Task 8 (kind/channel/source enums, `calls`, phone suppression, `brief` column).
- §2 Wizard → Tasks 16–18 (validation, action, pages, card).
- §3 Actions/validation → Tasks 16–17.
- §4 Brain → Tasks 4–7.
- §5 Pipeline → Tasks 9–15.
- §6 voice-infra → Tasks 1–3.
- §7 Compliance → suppression gate (Tasks 10, 11, 12), TCPA window (Task 11), recorded-line disclosure (Task 5), audit (`calls`, Task 8), DoD suppression tests (Tasks 10/11), deletion path note (existing cascade via composite FK on `calls`).
- §8 Help article → Task 19.
- Type consistency: `CallBrief` shape is shared from `@vantera/agent-brains` through `NewScheduledSend.brief` and `DispatchableCall.brief`; `CallOutcome` enum shared brain→inbound; `normalizePhone` defined once (Task 10) and reused in dispatch (Task 11).
