import { describe, expect, it } from "vitest";
import { parseDraftEdit } from "./validation";

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("parseDraftEdit", () => {
  it("accepts an email edit with subject and body", () => {
    const r = parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "Hi", body: "Short note." }));
    expect(r).toEqual({
      ok: true,
      values: { sendId: "s1", channel: "email", subject: "Hi", body: "Short note." },
    });
  });

  it("accepts a linkedin edit with no subject", () => {
    const r = parseDraftEdit(form({ sendId: "s1", channel: "linkedin", body: "Hello there" }));
    expect(r.ok && r.values.subject).toBe(null);
  });

  it("rejects an empty body", () => {
    expect(parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "Hi", body: "  " })).ok).toBe(false);
  });

  it("rejects a missing sendId and unknown channels", () => {
    expect(parseDraftEdit(form({ channel: "email", subject: "Hi", body: "x" })).ok).toBe(false);
    expect(parseDraftEdit(form({ sendId: "s1", channel: "sms", body: "x" })).ok).toBe(false);
  });

  it("rejects oversized content", () => {
    expect(
      parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "x".repeat(121), body: "x" })).ok
    ).toBe(false);
    expect(
      parseDraftEdit(form({ sendId: "s1", channel: "email", subject: "Hi", body: "x".repeat(5001) })).ok
    ).toBe(false);
  });
});
