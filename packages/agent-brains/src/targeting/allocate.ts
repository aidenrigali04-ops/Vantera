import type { LeadOutcomeFlags } from "../optimize/outcomes";
import { sampleBeta } from "../optimize/bandit";

/**
 * Stage 2 discovery allocation: split a scout run's discovery quota across the account's ICPs by
 * Thompson sampling on DEEP conversion evidence (interested-or-booked among invited) — with a 40%
 * exploration floor split equally so no ICP is ever starved by early noise. Zero outcome data ⇒
 * byte-identical equal split. Allocation only: the total target is never raised. Pure; RNG injected.
 */
const EXPLORATION_SHARE = 0.4;

export function allocateDiscovery(
  target: number,
  icps: { id: string; flags: LeadOutcomeFlags[] }[],
  rand: () => number
): Map<string, number> {
  const out = new Map<string, number>();
  if (target <= 0 || icps.length === 0) return out;
  if (icps.length === 1) {
    out.set(icps[0]!.id, target);
    return out;
  }

  const hasData = icps.some((i) => i.flags.some((f) => f.invited));
  if (!hasData) {
    const per = Math.max(1, Math.floor(target / icps.length));
    for (const icp of icps) out.set(icp.id, per);
    return out;
  }

  // Exploration floor: 40% split equally, so every ICP always keeps sourcing.
  const floorEach = Math.max(1, Math.floor((target * EXPLORATION_SHARE) / icps.length));
  const remaining = Math.max(0, target - floorEach * icps.length);

  // Thompson draw per ICP on deep conversion among invited.
  const draws = icps.map((icp) => {
    const invited = icp.flags.filter((f) => f.invited);
    const deep = invited.filter((f) => f.interested || f.booked).length;
    return sampleBeta(1 + deep, 1 + Math.max(0, invited.length - deep), rand);
  });
  const total = draws.reduce((s, d) => s + d, 0) || 1;

  const quotas = icps.map((icp, i) => ({
    id: icp.id,
    quota: floorEach + Math.floor((remaining * draws[i]!) / total),
  }));
  // hand rounding leftovers to the highest draws so quotas sum exactly to target
  let assigned = quotas.reduce((s, q) => s + q.quota, 0);
  const order = draws.map((d, i) => ({ d, i })).sort((a, b) => b.d - a.d);
  let k = 0;
  while (assigned < target) {
    quotas[order[k % order.length]!.i]!.quota++;
    assigned++;
    k++;
  }
  for (const q of quotas) out.set(q.id, q.quota);
  return out;
}
