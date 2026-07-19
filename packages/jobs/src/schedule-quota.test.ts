import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
 *
 * The recursion proof builds its fixture tree in a MKDTEMP DIRECTORY, never inside src/trigger/.
 * An earlier version wrote a real `schedules.task(` file into the scanned tree and deleted it in
 * afterEach — but a test run killed between the write and the cleanup (Ctrl-C, CI timeout, OOM)
 * leaves an 11th schedule committed-adjacent in the deploy path, i.e. it could cause the exact
 * outage this file exists to prevent. The scan root is a parameter precisely so the proof can run
 * somewhere harmless.
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
    let sandbox: string | null = null;

    afterEach(() => {
      if (sandbox) rmSync(sandbox, { recursive: true, force: true });
      sandbox = null;
    });

    it("a schedules.task() added in a nested subdirectory is counted, not missed", () => {
      // Fixture tree lives outside the repo entirely — see the file header.
      sandbox = mkdtempSync(join(tmpdir(), "vantera-schedule-quota-"));
      writeFileSync(join(sandbox, "top-level.ts"), "export const nothing = 1;\n");
      expect(scanForScheduleRegistrations(sandbox)).toEqual([]);

      const nested = join(sandbox, "nested");
      mkdirSync(nested, { recursive: true });
      writeFileSync(
        join(nested, "throwaway-schedule.ts"),
        'import { schedules } from "@trigger.dev/sdk";\n' +
          'export const throwaway = schedules.task({ id: "throwaway", cron: "0 0 * * *", run: async () => {} });\n'
      );

      expect(scanForScheduleRegistrations(sandbox)).toEqual([join("nested", "throwaway-schedule.ts")]);
    });

    it("never writes into the scanned trigger tree", () => {
      // Guards the fix itself: the recursion proof above must not leave (or ever create) a file
      // under src/trigger/. Any leftover fixture from a killed run would show up here.
      const entries = readdirSync(triggerDir, { recursive: true }) as string[];
      expect(entries.filter((e) => e.includes("throwaway") || e.includes("__schedule_quota"))).toEqual([]);
    });
  });
});
