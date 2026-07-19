import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPullbackEmail } from "./lifecycle";

/**
 * sendPullbackEmail has no injection seam (it calls createTransactionalEmailFromEnv()
 * internally, same as every other lifecycle sender), so — same idiom as
 * createTransactionalEmailFromEnv's own tests in resend.test.ts — env vars provide the
 * mailer config and the global fetch is stubbed to capture what actually goes over the wire.
 */
describe("sendPullbackEmail", () => {
  const prevEnv = {
    key: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL,
  };

  afterEach(() => {
    if (prevEnv.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevEnv.key;
    if (prevEnv.from === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = prevEnv.from;
    vi.unstubAllGlobals();
  });

  it("emits List-Unsubscribe + List-Unsubscribe-Post and passes subject/CTA through unchanged", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "noreply@example.com";

    let body: Record<string, unknown> = {};
    const fetchFn = vi.fn(async (_url: unknown, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchFn);

    await sendPullbackEmail({
      to: "user@example.com",
      subject: "Vera wrote 2 messages for you",
      lines: [
        "There are 2 messages written and waiting for your approval.",
        "They're addressed to people like Jane Doe — VP Sales at Acme.",
      ],
      ctaLabel: "Review the messages",
      ctaUrl: "https://app.vanterasystem.com/inbox",
      unsubscribeUrl: "https://app.vanterasystem.com/api/lifecycle-unsubscribe/tok123",
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    // subject/CTA reach the message unchanged — this sender renders, it never rewords.
    expect(body.subject).toBe("Vera wrote 2 messages for you");
    expect(String(body.html)).toContain("Review the messages");
    expect(String(body.html)).toContain("https://app.vanterasystem.com/inbox");
    expect(String(body.text)).toContain("Review the messages");
    expect(String(body.html)).toContain("Jane Doe — VP Sales at Acme");

    // RFC 8058 one-click opt-out headers, derived only from the signed unsubscribeUrl.
    expect(body.headers).toEqual({
      "List-Unsubscribe": "<https://app.vanterasystem.com/api/lifecycle-unsubscribe/tok123>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});
