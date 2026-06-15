import { describe, expect, it } from "vitest";
import { SmtpSender, type SmtpCredentials, type SmtpMessage, type SmtpTransport } from "./smtp-sender";

const creds: SmtpCredentials = { host: "smtp.example.com", port: 587, username: "sdr0@a.com", password: "pw" };
const msg: SmtpMessage = { from: "sdr0@a.com", to: "lead@x.com", subject: "Hi", html: "<p>Body</p>" };

describe("SmtpSender", () => {
  it("sends through the injected transport and maps to SendResult", async () => {
    const calls: Array<{ creds: SmtpCredentials; msg: SmtpMessage }> = [];
    const transport: SmtpTransport = {
      async sendMail(c, m) { calls.push({ creds: c, msg: m }); return { messageId: "smtp_1" }; },
    };
    const res = await new SmtpSender(transport).send(creds, msg);

    expect(res.messageId).toBe("smtp_1");
    expect(typeof res.sentAt).toBe("string");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.creds.username).toBe("sdr0@a.com");
    expect(calls[0]!.msg.to).toBe("lead@x.com");
  });

  it("propagates transport failures", async () => {
    const transport: SmtpTransport = {
      async sendMail() { throw new Error("smtp auth failed"); },
    };
    await expect(new SmtpSender(transport).send(creds, msg)).rejects.toThrow(/smtp auth failed/);
  });
});
