/**
 * The subject run. Later phases plug the proposer and the experiment decision in here.
 * A proposal is reported, not launched: launching is a separate approval.
 * This does not draft, schedule, or send.
 */
export type OptimizerProposal = { summary: string };

export type OptimizerDeps = {
  refreshCalibration(accountId: string): Promise<void>;
  propose(accountId: string): Promise<OptimizerProposal | null>;
  releaseWorldCache(): void;
};

export async function runOptimizer(
  input: { accountId: string; agentId: string },
  deps: OptimizerDeps
): Promise<{ refreshed: true; waitingForApproval: boolean }> {
  await deps.refreshCalibration(input.accountId);
  const proposal = await deps.propose(input.accountId);
  deps.releaseWorldCache();
  return { refreshed: true, waitingForApproval: proposal != null };
}
