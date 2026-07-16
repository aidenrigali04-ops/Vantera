import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trigger.dev cloud allows 10 declarative schedules on this plan. The 11th schedules.task()
 * broke EVERY prod deploy for ~16h (2026-07-15 → 07-16). New periodic work piggybacks the
 * agent-scheduler tick as a plain task — never a new schedule. This test turns that outage
 * class into a red build.
 */
const QUOTA = 10;

describe("trigger schedule quota", () => {
  it(`declares at most ${QUOTA} schedules.task registrations`, () => {
    const dir = join(__dirname, "trigger");
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      const count = (src.match(/schedules\.task\(/g) ?? []).length;
      for (let i = 0; i < count; i++) offenders.push(f);
    }
    expect(
      offenders.length,
      `schedules.task() registrations: ${offenders.join(", ")} — quota is ${QUOTA}. ` +
        "Piggyback new periodic work on the agent-scheduler tick instead of adding a schedule."
    ).toBeLessThanOrEqual(QUOTA);
  });

  it("scan finds existing registrations (sanity check)", () => {
    const dir = join(__dirname, "trigger");
    const offenders: string[] = [];
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))) {
      const src = readFileSync(join(dir, f), "utf8");
      const count = (src.match(/schedules\.task\(/g) ?? []).length;
      for (let i = 0; i < count; i++) offenders.push(f);
    }
    expect(offenders.length).toBeGreaterThan(0);
  });
});
