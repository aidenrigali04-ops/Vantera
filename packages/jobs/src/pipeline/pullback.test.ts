import { describe, expect, it } from "vitest";
import { composePullback, type PullbackRow } from "./pullback";

const APP = "https://www.vanterasystem.dev";
const NOW = new Date("2026-07-18T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function row(over: Partial<PullbackRow> = {}): PullbackRow {
  return {
    accountId: "acc-1",
    userId: "user-1",
    emails: ["founder@example.com"],
    segment: "drafts_waiting",
    touchNumber: 1,
    itemCount: 20,
    previews: [
      { name: "Antonino Ingoglia", title: "Attorney", company: "Studio Legale" },
      { name: "Marco Rossi", title: "CTO", company: "Acme SRL" },
    ],
    draftExcerpt: "Saw you work on GDPR compliance for startups —",
    oldestArtifactAt: hoursAgo(30),
    lifecycleEmailsEnabled: true,
    lifecycleLastEmailAt: null,
    ...over,
  };
}

describe("composePullback", () => {
  it("names the real count and real people for drafts_waiting", () => {
    const msg = composePullback(row(), APP, NOW);
    expect(msg).not.toBeNull();
    expect(msg!.subject).toBe("Vera wrote 20 messages for you");
    expect(msg!.lines.join(" ")).toContain("Antonino Ingoglia");
    expect(msg!.ctaUrl).toBe(`${APP}/inbox`);
  });

  it("names real buyers for leads_waiting and links to leads", () => {
    const msg = composePullback(
      row({ segment: "leads_waiting", itemCount: 22, draftExcerpt: null }),
      APP,
      NOW
    );
    expect(msg!.subject).toBe("22 buyers matched your ICP");
    expect(msg!.ctaUrl).toBe(`${APP}/leads`);
  });

  it("uses singular copy when there is exactly one item", () => {
    const msg = composePullback(row({ itemCount: 1 }), APP, NOW);
    expect(msg!.subject).toBe("Vera wrote 1 message for you");
  });

  it("returns null when lifecycle emails are switched off", () => {
    expect(composePullback(row({ lifecycleEmailsEnabled: false }), APP, NOW)).toBeNull();
  });

  it("returns null when there are no recipients", () => {
    expect(composePullback(row({ emails: [] }), APP, NOW)).toBeNull();
  });

  it("returns null when there is nothing waiting", () => {
    expect(composePullback(row({ itemCount: 0 }), APP, NOW)).toBeNull();
  });

  it("returns null when nobody can be named — never send a hollow email", () => {
    expect(composePullback(row({ previews: [] }), APP, NOW)).toBeNull();
  });

  it("returns null while the artifact is younger than 24h", () => {
    expect(composePullback(row({ oldestArtifactAt: hoursAgo(23) }), APP, NOW)).toBeNull();
  });

  it("yields to another lifecycle email sent within 48h", () => {
    expect(composePullback(row({ lifecycleLastEmailAt: hoursAgo(47) }), APP, NOW)).toBeNull();
  });

  it("sends once the 48h collision window has cleared", () => {
    expect(composePullback(row({ lifecycleLastEmailAt: hoursAgo(49) }), APP, NOW)).not.toBeNull();
  });

  it("names at most three people even when more are available", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      name: `Person ${i}`,
      title: "CEO",
      company: "Co",
    }));
    const msg = composePullback(row({ previews: many }), APP, NOW);
    expect(msg!.lines.join(" ")).toContain("Person 0");
    expect(msg!.lines.join(" ")).not.toContain("Person 3");
  });
});
