import { describe, expect, it } from "vitest";
import { InMemoryGmailSender } from "./gmail-send";

describe("InMemoryGmailSender", () => {
  it("records the send and returns a message id", async () => {
    const s = new InMemoryGmailSender();
    const res = await s.sendRaw("sdr0@acme.com", { to: "lead@x.com", subject: "Hi", body: "Body", headers: {} });
    expect(res.messageId).toBeTruthy();
    expect(s.sent[0]).toMatchObject({ from: "sdr0@acme.com", to: "lead@x.com" });
  });
});
