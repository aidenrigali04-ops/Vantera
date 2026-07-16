import { describe, expect, it, vi } from "vitest";

describe("GET /api/version", () => {
  it("returns the deployed git sha from the Vercel env", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc1234");
    const { GET } = await import("./route");
    const res = await GET();
    expect(await res.json()).toEqual({ sha: "abc1234" });
    expect(res.headers.get("cache-control")).toContain("no-store");
    vi.unstubAllEnvs();
  });

  it("falls back to 'dev' outside Vercel", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");
    const { GET } = await import("./route");
    expect((await (await GET()).json()).sha).toBe("dev");
    vi.unstubAllEnvs();
  });
});
