import { SEQUENCE_DEFAULTS } from "@vantera/jobs/pipeline/sequence-config";
import type { SequenceConfig, SequenceStage } from "@vantera/jobs/pipeline/types";

const STAGES: SequenceStage[] = ["linkedin", "email", "imessage", "call"];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const num = (fd: FormData, k: string, dflt: number) => {
  const raw = fd.get(k);
  if (raw == null || raw === "") return dflt; // Number(null) is 0 — guard missing fields
  const v = Number(raw);
  return Number.isFinite(v) ? v : dflt;
};

/** Pure parse of the sequence-builder form → a SequenceConfig (clamped to safe ranges). */
export function parseSequenceForm(fd: FormData): SequenceConfig {
  const stages = {} as SequenceConfig["stages"];
  for (const s of STAGES) {
    const d = SEQUENCE_DEFAULTS.stages[s];
    stages[s] = {
      enabled: fd.get(`${s}.enabled`) === "on",
      touches: clamp(num(fd, `${s}.touches`, d.touches), 0, 5),
      touchGapDays: clamp(num(fd, `${s}.touchGapDays`, d.touchGapDays), 0, 14),
      waitDays: clamp(num(fd, `${s}.waitDays`, d.waitDays), 0, 14),
      ...(s === "call" ? { maxAttempts: clamp(num(fd, "call.maxAttempts", 2), 1, 3) } : {}),
    };
  }
  return { order: SEQUENCE_DEFAULTS.order, stages };
}
