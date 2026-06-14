import { describe, expect, it, vi } from "vitest";
import { InMemoryGmailSender } from "./gmail-send";

describe("InMemoryGmailSender", () => {
  it("records the send and returns a message id", async () => {
    const s = new InMemoryGmailSender();
    const res = await s.sendRaw("sdr0@acme.com", { to: "lead@x.com", subject: "Hi", body: "Body", headers: {} });
    expect(res.messageId).toBeTruthy();
    expect(s.sent[0]).toMatchObject({ from: "sdr0@acme.com", to: "lead@x.com" });
  });
});

import { GoogleGmailSender } from "./gmail-send";

describe("GoogleGmailSender", () => {
  it("POSTs a base64url raw message to the sender's Gmail send endpoint", async () => {
    let calledUrl = "";
    const fetchFn = vi.fn(async (url: string) => { calledUrl = url; return { ok: true, status: 200, json: async () => ({ id: "gmsg_1" }), text: async () => "" }; }) as unknown as typeof fetch;
    const s = new GoogleGmailSender({ getAccessToken: async () => "tok", fetchFn });
    const res = await s.sendRaw("sdr0@acme.com", { to: "lead@x.com", subject: "Hi", body: "Body", headers: { "List-Unsubscribe": "<u>" } });
    expect(res.messageId).toBe("gmsg_1");
    expect(calledUrl).toContain("/users/sdr0@acme.com/messages/send");
  });
});
