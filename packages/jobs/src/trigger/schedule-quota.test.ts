import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname);

describe("Trigger schedule quota", () => {
  it("never exceeds 10 schedules — an 11th breaks every prod deploy", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    const scheduled = files.filter((f) =>
      readFileSync(join(dir, f), "utf8").includes("schedules.task(")
    );
    expect(scheduled.length).toBeLessThanOrEqual(10);
  });

  it("pullback-email is a plain task, not a schedule", () => {
    const src = readFileSync(join(dir, "pullback-email.ts"), "utf8");
    expect(src).toContain("task({");
    expect(src).not.toContain("schedules.task(");
  });

  it("the tick fires pullback-email", () => {
    const src = readFileSync(join(dir, "agent-scheduler.ts"), "utf8");
    expect(src).toContain(`tasks.trigger("pullback-email"`);
  });
});
