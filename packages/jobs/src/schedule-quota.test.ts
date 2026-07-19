import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Trigger.dev cloud allows 10 declarative schedules on this plan. The 11th schedules.task()
 * broke EVERY prod deploy for ~16h (2026-07-15 → 07-16). New periodic work piggybacks the
 * agent-scheduler tick as a plain task — never a new schedule. This test turns that outage
 * class into a red build.
 *
 * The scan is RECURSIVE because trigger.config.ts declares `dirs: ["./src/trigger"]`, which
 * Trigger scans recursively — a schedule added under a future src/trigger/<subdir>/ would deploy
 * and break every production deploy while a non-recursive scan here stayed green. No
 * subdirectories exist today; the recursion is proven live below rather than left as an assertion
 * about code that doesn't exist yet.
 */
const QUOTA = 10;
const triggerDir = join(__dirname, "trigger");

function scanForScheduleRegistrations(dir: string): string[] {
  const offenders: string[] = [];
  for (const entry of readdirSync(dir, { recursive: true }) as string[]) {
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) continue;
    const full = join(dir, entry);
    if (!statSync(full).isFile()) continue;
    const count = (readFileSync(full, "utf8").match(/schedules\.task\(/g) ?? []).length;
    for (let i = 0; i < count; i++) offenders.push(entry);
  }
  return offenders;
}

describe("trigger schedule quota", () => {
  it(`declares at most ${QUOTA} schedules.task registrations`, () => {
    const offenders = scanForScheduleRegistrations(triggerDir);
    expect(
      offenders.length,
      `schedules.task() registrations: ${offenders.join(", ")} — quota is ${QUOTA}. ` +
        "Piggyback new periodic work on the agent-scheduler tick instead of adding a schedule."
    ).toBeLessThanOrEqual(QUOTA);
  });

  it("scan finds existing registrations (sanity check)", () => {
    expect(scanForScheduleRegistrations(triggerDir).length).toBeGreaterThan(0);
  });

  it("pullback-email is a plain task, not a schedule", () => {
    const src = readFileSync(join(triggerDir, "pullback-email.ts"), "utf8");
    expect(src).toContain("task({");
    expect(src).not.toContain("schedules.task(");
  });

  it("the agent-scheduler tick fires pullback-email", () => {
    const src = readFileSync(join(triggerDir, "agent-scheduler.ts"), "utf8");
    expect(src).toContain(`tasks.trigger("pullback-email"`);
  });

  describe("recursion (non-vacuity)", () => {
    const nestedDir = join(triggerDir, "__schedule_quota_test_tmp__");
    const nestedFile = join(nestedDir, "throwaway-schedule.ts");

    afterEach(() => {
      if (existsSync(nestedDir)) rmSync(nestedDir, { recursive: true, force: true });
    });

    it("a schedules.task() added in a nested subdirectory is counted, not missed", () => {
      const before = scanForScheduleRegistrations(triggerDir).length;

      mkdirSync(nestedDir, { recursive: true });
      writeFileSync(
        nestedFile,
        'import { schedules } from "@trigger.dev/sdk";\n' +
          'export const throwaway = schedules.task({ id: "throwaway", cron: "0 0 * * *", run: async () => {} });\n'
      );

      const after = scanForScheduleRegistrations(triggerDir).length;
      expect(after).toBe(before + 1);
    });
  });
});
