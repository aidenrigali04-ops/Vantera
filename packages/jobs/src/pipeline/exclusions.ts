import { applyExclusions, type RulesGateResult, type TargetingRules } from "@vantera/agent-brains";
import type { ProspectCandidate } from "@vantera/prospect-data";

/** ML-5: a rules-gate pass the user's exclusions veto becomes a fail with the reason recorded. */
export function gateWithExclusions(gate: RulesGateResult, candidate: ProspectCandidate, rules: TargetingRules): RulesGateResult {
  if (!gate.passed) return gate;
  const excluded = applyExclusions(candidate, rules);
  return excluded ? { passed: false, reasons: [excluded] } : gate;
}
