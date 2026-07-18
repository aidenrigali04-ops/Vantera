import { pathToFileURL } from "node:url";
import { KAPPA_TRUST_THRESHOLD } from "./judge/kappa";
import { scoreCalibration } from "./calibration-prep";

/**
 * The `evals:calibration-score` entry point (`tsx src/calibration-score.ts <path>`) — a thin CLI
 * wrapper over `scoreCalibration` (`./calibration-prep`), same split as `ci.ts` (pure logic in an
 * importable function, `process.exit`/argv only in this file's own guarded entry block).
 *
 * Usage: `pnpm --filter @vantera/evals evals:calibration-score fixtures/judge-calibration/packet.json`
 * after the owner has downloaded the `calibration-prep` workflow's `packet.json` artifact and
 * replaced some `humanOverall: null` values with real 1-5 scores.
 */
export async function main(argv: string[]): Promise<number> {
  const path = argv[2];
  if (!path) {
    console.log(
      "::error::evals:calibration-score requires a path argument, e.g. `pnpm --filter @vantera/evals evals:calibration-score fixtures/judge-calibration/packet.json`"
    );
    return 1;
  }

  try {
    const report = await scoreCalibration(path);
    console.log(
      `Calibration report: kappa=${report.kappa.toFixed(3)} trusted=${report.trusted} n=${report.n} (trust threshold=${KAPPA_TRUST_THRESHOLD})`
    );
    if (report.trusted) {
      console.log(
        "TRUSTED — safe to set EVALS_JUDGE_GATING=1 and replace JUDGE_OVERALL_GATE_FLOOR with a calibration-derived value (see docs/evals.md)."
      );
    } else {
      console.log(
        `kappa below ${KAPPA_TRUST_THRESHOLD} — the judge is not yet trustworthy. Iterate on JUDGE_PROMPT or label more entries; do NOT flip EVALS_JUDGE_GATING.`
      );
    }
    return 0;
  } catch (err) {
    console.log(`::error::evals:calibration-score failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv).then((code) => process.exit(code));
}
