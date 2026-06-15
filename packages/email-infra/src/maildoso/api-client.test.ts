import { describe, expect, it, vi } from "vitest";
import { MaildosoApiClient } from "./api-client";

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

describe("MaildosoApiClient", () => {
  it("sends the API key as a Bearer header", async () => {
    const fetchMock = vi.fn(async () => okJson({ domain: "d.com" }));
    const client = new MaildosoApiClient({ apiKey: "k_test", fetchImpl: fetchMock });
    await client.ensureDomain("d.com");
    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[1].headers).toMatchObject({ Authorization: "Bearer k_test" });
  });

  it("createMailbox returns address + smtp creds", async () => {
    const fetchMock = vi.fn(async () =>
      okJson({ id: "mbx_9", email: "sdr0@d.com", smtp: { host: "smtp.maildoso.io", port: 587, username: "sdr0@d.com", password: "p" } })
    );
    const client = new MaildosoApiClient({ apiKey: "k", fetchImpl: fetchMock });
    const mbx = await client.createMailbox("d.com", "sdr0");
    expect(mbx).toMatchObject({ providerRef: "mbx_9", address: "sdr0@d.com", smtp: { username: "sdr0@d.com" } });
  });

  it("throws with status + body on non-2xx", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 422, text: async () => "bad domain" } as Response));
    const client = new MaildosoApiClient({ apiKey: "k", fetchImpl: fetchMock });
    await expect(client.ensureDomain("x")).rejects.toThrow(/422.*bad domain/);
  });

  it("getWarmup maps provider phase to the neutral shape", async () => {
    const fetchMock = vi.fn(async () => okJson({ warmup_state: "warming", daily_limit: 12 }));
    const client = new MaildosoApiClient({ apiKey: "k", fetchImpl: fetchMock });
    expect(await client.getWarmup("mbx_9")).toEqual({ phase: "warming", dailyCap: 12 });
  });
});
