import { genomeSignature, type StrategyGenome, type StrategySource, type StampArm } from "@vantera/agent-brains";

/**
 * Record which strategy produced a lead at entry. This writes a row and nothing else:
 * it does not draft, schedule, suppress, or send.
 */
export type StrategyStampDeps = {
  upsertStrategy(accountId: string, genome: StrategyGenome, source: StrategySource): Promise<string>;
  hasStamp(accountId: string, leadId: string): Promise<boolean>;
  stampLead(
    accountId: string,
    leadId: string,
    strategyId: string,
    opts?: { experimentId?: string | null; arm?: StampArm }
  ): Promise<void>;
};

export async function stampEnteredLead(
  deps: StrategyStampDeps,
  input: {
    accountId: string;
    leadId: string;
    genome?: StrategyGenome;
    source?: StrategySource;
    experimentId?: string | null;
    arm?: StampArm;
  }
): Promise<{ strategyId: string; signature: string }> {
  const genome = input.genome ?? {};
  const source: StrategySource = input.source ?? (Object.keys(genome).length > 0 ? "manual" : "default");
  const signature = genomeSignature(genome);
  const strategyId = await deps.upsertStrategy(input.accountId, genome, source);
  if (await deps.hasStamp(input.accountId, input.leadId)) return { strategyId, signature };
  await deps.stampLead(input.accountId, input.leadId, strategyId, {
    experimentId: input.experimentId ?? null,
    arm: input.arm ?? null,
  });
  return { strategyId, signature };
}
