# Caller (Retell) Production Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make a missing caller number a graceful, surfaced skip and handle `placeCall` failures, so the only manual step to live calling is `VOICE_FROM_NUMBER` + `VOICE_API_KEY`.

**Architecture:** Two guards in `runCallDispatch`/`dispatchOne` + two new outcomes. No schema change. TDD.

**Spec:** `docs/superpowers/specs/2026-06-15-caller-hardening-design.md`. **Branch:** `phase-caller-harden` (off `main`).

---

## File Structure
- `packages/jobs/src/pipeline/types.ts` — extend `CallDispatchOutcome`.
- `packages/jobs/src/pipeline/call-dispatch.ts` (+ `.test.ts`) — missing-number guard + `placeCall` try/catch.
- `packages/jobs/src/trigger/call-dispatch.ts` — log `no_caller_number` loudly.
- `.env.example` — one-line `VOICE_FROM_NUMBER` note.

---

## Task 1: Extend CallDispatchOutcome
**File:** `packages/jobs/src/pipeline/types.ts:506`

- [ ] **Step 1:** change the type to:

```ts
export type CallDispatchOutcome = "dialing" | "suppressed" | "outside_window" | "skipped" | "halted" | "no_caller_number" | "failed";
```

- [ ] **Step 2:** `pnpm --filter @vantera/jobs type-check` → still clean. Commit: `feat(jobs): add no_caller_number + failed call outcomes`

---

## Task 2: Guards in call-dispatch
**Files:** `packages/jobs/src/pipeline/call-dispatch.ts`, `call-dispatch.test.ts`

- [ ] **Step 1: Write failing tests** in `call-dispatch.test.ts` (extend the existing fake-store harness in that file):

```ts
it("returns no_caller_number and claims nothing when fromNumber is blank", async () => {
  const store = makeStore({ approved: [makeCall({ id: "s1" })] }); // existing helper or inline fake
  const claim = vi.spyOn(store, "claimSending");
  const res = await runCallDispatch({ store, voiceInfra: fakeVoice(), fromNumber: "   " });
  expect(res).toEqual([{ sendId: "*", outcome: "no_caller_number" }]);
  expect(claim).not.toHaveBeenCalled();
});

it("reverts the send and returns failed when placeCall throws", async () => {
  const call = makeCall({ id: "s1", phone: "+15551230000" });
  const store = makeStore({ approved: [call] }); // claimSending→true, isSuppressed→false, within window
  const revert = vi.spyOn(store, "revertToApproved");
  const voice = fakeVoice();
  vi.spyOn(voice, "placeCall").mockRejectedValue(new Error("provider 500"));
  const res = await runCallDispatch({ store, voiceInfra: voice, fromNumber: "+15550000000", now: () => withinWindow() });
  expect(res[0]!.outcome).toBe("failed");
  expect(revert).toHaveBeenCalledWith("s1");
});
```

(Adapt `makeStore`/`makeCall`/`fakeVoice`/`withinWindow` to the helpers already in `call-dispatch.test.ts`; ensure the dispatchable call's `config.callingWindow` + `now` place it inside the window for test 2, and `attemptsSoFar < maxAttempts`.)

- [ ] **Step 2:** `pnpm --filter @vantera/jobs test call-dispatch` → FAIL.

- [ ] **Step 3: Implement.** In `runCallDispatch`, add the guard right after the kill-switch line:

```ts
  if (await deps.store.isKillSwitchOn()) return [{ sendId: "*", outcome: "halted" }];
  if (!deps.fromNumber.trim()) return [{ sendId: "*", outcome: "no_caller_number" }];
```

In `dispatchOne`, wrap the place→insert→mark block:

```ts
  try {
    const handle = await deps.voiceInfra.placeCall({ /* …unchanged args… */ });
    await deps.store.insertCall({ /* …unchanged… */ });
    await deps.store.markSendSent(call.id);
    return "dialing";
  } catch {
    await deps.store.revertToApproved(call.id);
    return "failed";
  }
```

(Keep all existing guards above the try unchanged: attempt cap, calling window, claim, suppression.)

- [ ] **Step 4:** `pnpm --filter @vantera/jobs test call-dispatch` → PASS; full `pnpm --filter @vantera/jobs test` stays green. Commit: `feat(jobs): graceful missing-number skip + placeCall failure handling`

---

## Task 3: Surface no_caller_number in the trigger
**File:** `packages/jobs/src/trigger/call-dispatch.ts`

- [ ] **Step 1:** after `results` is computed, before the existing info log:

```ts
    if (results.length === 1 && results[0]?.outcome === "no_caller_number") {
      logger.error("call-dispatch: VOICE_FROM_NUMBER is not set — no calls placed", {});
    }
    logger.info("call dispatch tick", { total: results.length });
```

- [ ] **Step 2:** `pnpm --filter @vantera/jobs type-check` → clean; `structure.test.ts` stays green (wrapper still imports its core). Commit: `feat(jobs): log missing VOICE_FROM_NUMBER in call-dispatch`

---

## Task 4: Env note + full gate
**File:** `.env.example`

- [ ] **Step 1:** add a trailing comment on the `VOICE_FROM_NUMBER` line, e.g. `# VOICE_FROM_NUMBER is the only manual step to enable the caller (a Retell-provisioned number).`
- [ ] **Step 2:** `pnpm lint && pnpm type-check && pnpm test && pnpm build` → green.
- [ ] **Step 3:** `whitelabel-auditor` (no "Retell" on user surfaces); confirm suppression tests green. Commit `docs: note VOICE_FROM_NUMBER as the caller's only manual step`, push branch, report PR.

## Activation checklist (needs creds; not code)
1. Provision a Retell phone number; set `VOICE_FROM_NUMBER` (+ `VOICE_API_KEY`, optional `VOICE_AGENT_ID`) in Vercel + Trigger.
2. Register the Retell call webhook at `/api/webhooks/voice`.
3. `trigger deploy`. 4. Live smoke per the spec.

## Self-Review
Spec coverage: missing-number guard (T2) ✓; placeCall failure (T2) ✓; outcomes (T1) ✓; surfacing (T3) ✓; env note + smoke (T4 + spec) ✓. Recording default + min-gap intentionally excluded per owner decision. No placeholders except test-helper names the implementer maps to the real `call-dispatch.test.ts` harness.
