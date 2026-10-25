import { afterEach, describe, expect, it, vi } from "vitest";
import { sendPullbackEmail, sendTrialEndingEmail } from "./lifecycle";

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
      ctaUrl: "https://app.vanterasystem.com/approvals",
      unsubscribeUrl: "https://app.vanterasystem.com/api/lifecycle-unsubscribe/tok123",
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);

    // subject/CTA reach the message unchanged — this sender renders, it never rewords.
    expect(body.subject).toBe("Vera wrote 2 messages for you");
    expect(String(body.html)).toContain("Review the messages");
    expect(String(body.html)).toContain("https://app.vanterasystem.com/approvals");
    expect(String(body.text)).toContain("Review the messages");
    expect(String(body.html)).toContain("Jane Doe — VP Sales at Acme");

    // RFC 8058 one-click opt-out headers, derived only from the signed unsubscribeUrl.
    expect(body.headers).toEqual({
      "List-Unsubscribe": "<https://app.vanterasystem.com/api/lifecycle-unsubscribe/tok123>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });
});

describe("sendTrialEndingEmail", () => {
  const prevEnv = { key: process.env.RESEND_API_KEY, from: process.env.RESEND_FROM_EMAIL };

  afterEach(() => {
    if (prevEnv.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevEnv.key;
    if (prevEnv.from === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = prevEnv.from;
    vi.unstubAllGlobals();
  });

  async function capture(over: { daysLeft: number; hasCard: boolean; planName: string | null }) {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "noreply@example.com";
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      })
    );
    await sendTrialEndingEmail({
      to: "u@example.com",
      endsOn: "October 27",
      appUrl: "https://app.example.com",
      ...over,
    });
    return body;
  }

  it("card on file: charge-date copy, plan name, Manage billing CTA", async () => {
    const body = await capture({ daysLeft: 2, hasCard: true, planName: "All Access" });
    expect(body.subject).toBe("Your Vantera trial ends in 2 days");
    const html = String(body.html);
    expect(html).toContain("October 27");
    expect(html).toContain("charged for the All Access plan");
    expect(html).toContain("agents keep running");
    expect(html).toContain("Manage billing");
    expect(html).toContain("https://app.example.com/settings/billing");
    expect(html).not.toContain("Choose a plan");
  });

  it("card on file without a plan name falls back to 'your'", async () => {
    const body = await capture({ daysLeft: 2, hasCard: true, planName: null });
    expect(String(body.html)).toContain("charged for your plan and your agents keep running");
  });

  it("legacy no-card: keeps the pause copy and Choose a plan CTA; 1 day subject", async () => {
    const body = await capture({ daysLeft: 1, hasCard: false, planName: null });
    expect(body.subject).toBe("Your Vantera trial ends tomorrow");
    expect(String(body.html)).toContain("Choose a plan");
    expect(String(body.html)).not.toContain("Manage billing");
  });
});
