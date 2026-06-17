import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  parseInboundLead,
  signIntake,
  verifyIntakeSignature,
  handleInboundIntake,
  type InboundIntakeDeps,
} from "./inbound-intake";

const SECRET = "whsec_test_secret_value";

function sign(body: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
}

describe("verifyIntakeSignature", () => {
  it("accepts a correct HMAC-SHA256 signature", () => {
    const body = '{"email":"a@b.com"}';
    expect(verifyIntakeSignature(body, SECRET, sign(body))).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign('{"email":"a@b.com"}');
    expect(verifyIntakeSignature('{"email":"evil@b.com"}', SECRET, sig)).toBe(false);
  });

  it("rejects a missing or malformed signature", () => {
    expect(verifyIntakeSignature("{}", SECRET, null)).toBe(false);
    expect(verifyIntakeSignature("{}", SECRET, "garbage")).toBe(false);
  });

  it("signIntake round-trips with verifyIntakeSignature", () => {
    const body = '{"x":1}';
    expect(verifyIntakeSignature(body, SECRET, signIntake(body, SECRET))).toBe(true);
  });
});

describe("parseInboundLead", () => {
  it("normalizes common field shapes", () => {
    const r = parseInboundLead({
      source: "form_fill",
      email: "Jordan@Acme.com ",
      first_name: "Jordan",
      company: "Acme",
    });
    expect(r).toEqual({
      source: "form_fill",
      email: "jordan@acme.com",
      firstName: "Jordan",
      companyName: "Acme",
    });
  });

  it("reads nested fields and derives first name from a full name", () => {
    const r = parseInboundLead({ fields: { email: "sam@x.io", name: "Sam Rivera", company: "X" } });
    expect(r.email).toBe("sam@x.io");
    expect(r.firstName).toBe("Sam");
    expect(r.companyName).toBe("X");
  });

  it("defaults an unknown source to form_fill and tolerates missing contact", () => {
    const r = parseInboundLead({ source: "whatever" });
    expect(r.source).toBe("form_fill");
    expect(r.email).toBeNull();
  });
});

function deps(over: Partial<InboundIntakeDeps> = {}): InboundIntakeDeps {
  return {
    resolveIntake: vi.fn(async () => ({
      accountId: "acc1",
      agentId: "agent1",
      secret: SECRET,
    })),
    recordEvent: vi.fn(async () => true),
    enqueue: vi.fn(async () => {}),
    onUnverified: vi.fn(),
    ...over,
  };
}

describe("handleInboundIntake", () => {
  const body = JSON.stringify({ event_id: "evt_1", email: "jordan@acme.com", first_name: "Jordan" });

  it("404s an unknown intake id", async () => {
    const d = deps({ resolveIntake: vi.fn(async () => null) });
    const res = await handleInboundIntake("nope", { "x-vantera-signature": sign(body) }, body, d);
    expect(res.status).toBe(404);
    expect(d.enqueue).not.toHaveBeenCalled();
  });

  it("401s and audits an invalid signature", async () => {
    const d = deps();
    const res = await handleInboundIntake("intake1", { "x-vantera-signature": "sha256=bad" }, body, d);
    expect(res.status).toBe(401);
    expect(d.onUnverified).toHaveBeenCalled();
    expect(d.enqueue).not.toHaveBeenCalled();
  });

  it("enqueues a verified inbound lead with the resolved tenant", async () => {
    const d = deps();
    const res = await handleInboundIntake("intake1", { "x-vantera-signature": sign(body) }, body, d);
    expect(res.status).toBe(200);
    expect(d.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "inbound",
        payload: expect.objectContaining({
          accountId: "acc1",
          agentId: "agent1",
          email: "jordan@acme.com",
          source: "form_fill",
        }),
      })
    );
  });

  it("dedupes a duplicate event without enqueuing twice", async () => {
    const d = deps({ recordEvent: vi.fn(async () => false) });
    const res = await handleInboundIntake("intake1", { "x-vantera-signature": sign(body) }, body, d);
    expect(res.status).toBe(200);
    expect(res.body).toBe("duplicate");
    expect(d.enqueue).not.toHaveBeenCalled();
  });

  it("falls back to a body hash as the idempotency key when no event id is present", async () => {
    const noId = JSON.stringify({ email: "x@y.com" });
    const d = deps();
    await handleInboundIntake("intake1", { "x-vantera-signature": sign(noId) }, noId, d);
    expect(d.recordEvent).toHaveBeenCalledWith(expect.any(String), expect.anything());
    const key = (d.recordEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(key.length).toBeGreaterThan(0);
  });
});
