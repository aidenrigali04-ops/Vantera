import { describe, expect, it, vi } from "vitest";
import { alertOnce, classifyProviderError, withProviderAlert, type ProviderAlertDeps } from "./provider-alert";

function makeDeps(start = new Date("2026-10-28T00:00:00Z")) {
  const settings = new Map<string, unknown>();
  const sent: { subject: string; body: string }[] = [];
  let t = start;
  const deps: ProviderAlertDeps = {
    store: { getSetting: async (k) => settings.get(k), setSetting: async (k, v) => void settings.set(k, v) },
    send: async (a) => void sent.push(a),
    now: () => t,
    recipient: "ops@example.com",
  };
  return { deps, sent, settings, advance: (ms: number) => (t = new Date(t.getTime() + ms)) };
}

describe("classifyProviderError", () => {
  it("billing", () => {
    expect(classifyProviderError(new Error("AI_APICallError: Your credit balance is too low"))).toBe("billing");
  });
  it("auth", () => {
    expect(classifyProviderError(new Error("invalid x-api-key"))).toBe("auth");
  });
  it("nested cause", () => {
    expect(classifyProviderError(new Error("wrapped", { cause: new Error("credit balance is too low") }))).toBe("billing");
  });
  it("a bare 401 inside an identifier is not an auth error", () => {
    expect(classifyProviderError(new Error("lead_4012 not found"))).toBeNull();
    expect(classifyProviderError(new Error("HTTP 401"))).toBe("auth");
  });
  it("other errors and non-errors are null", () => {
    expect(classifyProviderError(new Error("db blip"))).toBeNull();
    expect(classifyProviderError(undefined)).toBeNull();
  });
});

describe("alertOnce", () => {
  it("sends once within 24h and again after", async () => {
    const m = makeDeps();
    expect(await alertOnce("billing", m.deps)).toBe(true);
    m.advance(23 * 3600_000);
    expect(await alertOnce("billing", m.deps)).toBe(false);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]!.body).toContain("Add credits in the AI provider console");
    m.advance(2 * 3600_000);
    expect(await alertOnce("billing", m.deps)).toBe(true);
    expect(m.sent).toHaveLength(2);
  });
  it("kinds are throttled independently", async () => {
    const m = makeDeps();
    await alertOnce("billing", m.deps);
    expect(await alertOnce("auth", m.deps)).toBe(true);
    expect(m.sent[1]!.body).toContain("Rotate the AI API key in Trigger.dev + Vercel");
  });
});

describe("alertOnce without a recipient", () => {
  it("logs an error, sends nothing, returns false", async () => {
    const m = makeDeps();
    m.deps.recipient = null;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await alertOnce("billing", m.deps)).toBe(false);
    expect(spy).toHaveBeenCalledWith("provider alert: no admin recipient configured", { kind: "billing" });
    expect(m.sent).toHaveLength(0);
    spy.mockRestore();
  });
});

describe("withProviderAlert", () => {
  it("alerts on a billing error and re-throws the original", async () => {
    const m = makeDeps();
    const err = new Error("Your credit balance is too low");
    await expect(withProviderAlert(async () => { throw err; }, m.deps)).rejects.toBe(err);
    expect(m.sent).toHaveLength(1);
  });
  it("alerts on an auth error (kind auth) and re-throws", async () => {
    const m = makeDeps();
    const err = new Error("invalid x-api-key");
    await expect(withProviderAlert(async () => { throw err; }, m.deps)).rejects.toBe(err);
    expect(m.sent).toHaveLength(1);
    expect(m.sent[0]!.subject).toContain("API key");
    expect(m.settings.has("provider_alert:auth")).toBe(true);
  });
  it("a second failing run inside the cooldown sends nothing more", async () => {
    const m = makeDeps();
    const fail = async () => { throw new Error("Your credit balance is too low"); };
    await expect(withProviderAlert(fail, m.deps)).rejects.toThrow();
    m.advance(3600_000);
    await expect(withProviderAlert(fail, m.deps)).rejects.toThrow();
    expect(m.sent).toHaveLength(1);
  });
  it("passes through a non-provider error without alerting", async () => {
    const m = makeDeps();
    await expect(withProviderAlert(async () => { throw new Error("db blip"); }, m.deps)).rejects.toThrow("db blip");
    expect(m.sent).toHaveLength(0);
  });
  it("a failing alert send never masks the original error", async () => {
    const m = makeDeps();
    m.deps.send = async () => { throw new Error("mail down"); };
    await expect(withProviderAlert(async () => { throw new Error("credit balance too low"); }, m.deps)).rejects.toThrow("credit balance");
  });
  it("returns the value on success", async () => {
    expect(await withProviderAlert(async () => 7, makeDeps().deps)).toBe(7);
  });
});
