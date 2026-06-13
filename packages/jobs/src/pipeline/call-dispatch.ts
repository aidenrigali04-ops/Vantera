import type { CallDispatchDeps, CallDispatchOutcome, DispatchableCall } from "./types";
import { normalizePhone } from "./call-brief";

/** Evaluate the calling window in the PROSPECT's timezone (TCPA). Falls back to UTC if tz unknown. */
export function isWithinCallingWindow(
  now: Date,
  timezone: string | null,
  window: { days: string[]; startLocal: string; endLocal: string }
): boolean {
  const tz = timezone ?? "UTC";
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const parts = fmt.formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  if (!window.days.includes(wd)) return false;
  const cur = hour * 60 + minute;
  const startParts = window.startLocal.split(":").map(Number);
  const endParts = window.endLocal.split(":").map(Number);
  const startMin = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
  const endMin = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);
  return cur >= startMin && cur < endMin;
}

export interface CallDispatchResult {
  sendId: string;
  outcome: CallDispatchOutcome;
}

/**
 * Dispatch approved call briefs into live dial attempts.
 * Order of guards (rule 11 + TCPA): kill switch → attempt cap → calling window
 * (prospect-local) → claim → suppression re-check → place call → record.
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
