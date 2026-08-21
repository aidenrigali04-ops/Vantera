import { afterEach, describe, expect, it } from "vitest";
import { ResendTransactionalEmail, createTransactionalEmailFromEnv } from "./resend";

function stubFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    calls.push({ url: String(input), init: (init ?? {}) as RequestInit });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { fetchFn, calls };
}

describe("ResendTransactionalEmail", () => {
  it("posts to the emails endpoint with auth + mapped body and returns the id", async () => {
    const { fetchFn, calls } = stubFetch({ id: "re_msg_1" });
    const email = new ResendTransactionalEmail({
      apiKey: "re_key",
      from: "noreply@vanterasystem.com",
      fetchFn,
    });

    const res = await email.send({
      to: "user@example.com",
      subject: "Welcome",
      html: "<p>hi</p>",
      replyTo: "support@vanterasystem.com",
    });

    expect(res.messageId).toBe("re_msg_1");
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_key");
    const sent = JSON.parse(call.init.body as string);
    expect(sent).toMatchObject({
      from: "noreply@vanterasystem.com",
      to: "user@example.com",
      subject: "Welcome",
      html: "<p>hi</p>",
      reply_to: "support@vanterasystem.com",
    });
  });

  it("throws on a non-ok response", async () => {
    const { fetchFn } = stubFetch({ message: "bad request" }, 422);
    const email = new ResendTransactionalEmail({ apiKey: "re_key", from: "x@y.com", fetchFn });
    await expect(
      email.send({ to: "u@example.com", subject: "s", html: "h" })
    ).rejects.toThrow(/422/);
  });

  it("throws when the provider response has no id", async () => {
    const { fetchFn } = stubFetch({});
    const email = new ResendTransactionalEmail({ apiKey: "re_key", from: "x@y.com", fetchFn });
    await expect(
      email.send({ to: "u@example.com", subject: "s", html: "h" })
    ).rejects.toThrow(/missing id/);
  });
});

describe("createTransactionalEmailFromEnv", () => {
  const prev = {
    key: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL,
  };
  afterEach(() => {
    if (prev.key === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prev.key;
    if (prev.from === undefined) delete process.env.RESEND_FROM_EMAIL;
    else process.env.RESEND_FROM_EMAIL = prev.from;
  });

  it("throws when env vars are missing", () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
    expect(() => createTransactionalEmailFromEnv()).toThrow();
  });

  it("constructs when env vars are present", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "noreply@vanterasystem.com";
    expect(() => createTransactionalEmailFromEnv()).not.toThrow();
  });
});

describe("ResendTransactionalEmail headers", () => {
  it("forwards custom headers so List-Unsubscribe reaches the provider", async () => {
    let body: Record<string, unknown> = {};
    const mailer = new ResendTransactionalEmail({
      apiKey: "k",
      from: "noreply@example.com",
      fetchFn: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    await mailer.send({
      to: "a@x.com",
      subject: "s",
      html: "<p>h</p>",
      headers: {
        "List-Unsubscribe": "<https://app/api/lifecycle-unsubscribe/tok>",
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    expect(body.headers).toEqual({
      "List-Unsubscribe": "<https://app/api/lifecycle-unsubscribe/tok>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("omits headers entirely when none are supplied", async () => {
    let body: Record<string, unknown> = {};
    const mailer = new ResendTransactionalEmail({
      apiKey: "k",
      from: "noreply@example.com",
      fetchFn: (async (_url: string, init: RequestInit) => {
        body = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      }) as unknown as typeof fetch,
    });

    await mailer.send({ to: "a@x.com", subject: "s", html: "<p>h</p>" });

    expect(body).not.toHaveProperty("headers");
  });
});
