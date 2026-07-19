import { describe, expect, it } from "vitest";
import {
  composePullback,
  COLLISION_WINDOW_MS,
  MIN_ARTIFACT_AGE_MS,
  type PullbackRow,
} from "./pullback";

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

  it("uses the singular subject for leads_waiting when there is exactly one item", () => {
    const msg = composePullback(
      row({ segment: "leads_waiting", itemCount: 1, draftExcerpt: null }),
      APP,
      NOW
    );
    expect(msg!.subject).toBe("1 buyer matched your ICP");
  });

  it("uses the singular body line for drafts_waiting when there is exactly one item", () => {
    const msg = composePullback(row({ itemCount: 1 }), APP, NOW);
    expect(msg!.lines[0]).toBe(
      "There's a message written and waiting for your approval. Nothing sends until you say so."
    );
  });

  it("uses the singular body line for leads_waiting when there is exactly one item", () => {
    const msg = composePullback(
      row({ segment: "leads_waiting", itemCount: 1, draftExcerpt: null }),
      APP,
      NOW
    );
    expect(msg!.lines[0]).toBe("Vera found and qualified a buyer that matches the ICP you set.");
  });

  it("includes the draft excerpt line when draftExcerpt is present", () => {
    const msg = composePullback(
      row({ draftExcerpt: "Saw you work on GDPR compliance for startups —" }),
      APP,
      NOW
    );
    expect(msg!.lines).toHaveLength(3);
    expect(msg!.lines[2]).toBe('One of them opens: "Saw you work on GDPR compliance for startups —"');
  });

  it("adds no excerpt line when draftExcerpt is null", () => {
    const msg = composePullback(row({ draftExcerpt: null }), APP, NOW);
    expect(msg!.lines).toHaveLength(2);
    expect(msg!.lines.some((l) => l.startsWith("One of them opens:"))).toBe(false);
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

  it("sends once the artifact age is exactly MIN_ARTIFACT_AGE_MS", () => {
    const oldestArtifactAt = new Date(NOW.getTime() - MIN_ARTIFACT_AGE_MS).toISOString();
    expect(composePullback(row({ oldestArtifactAt }), APP, NOW)).not.toBeNull();
  });

  it("yields to another lifecycle email sent within 48h", () => {
    expect(composePullback(row({ lifecycleLastEmailAt: hoursAgo(47) }), APP, NOW)).toBeNull();
  });

  it("sends once the 48h collision window has cleared", () => {
    expect(composePullback(row({ lifecycleLastEmailAt: hoursAgo(49) }), APP, NOW)).not.toBeNull();
  });

  it("sends when the collision gap is exactly COLLISION_WINDOW_MS", () => {
    const lifecycleLastEmailAt = new Date(NOW.getTime() - COLLISION_WINDOW_MS).toISOString();
    expect(composePullback(row({ lifecycleLastEmailAt }), APP, NOW)).not.toBeNull();
  });

  it("names exactly three people when more are available", () => {
    const many = Array.from({ length: 9 }, (_, i) => ({
      name: `Person ${i}`,
      title: "CEO",
      company: "Co",
    }));
    const msg = composePullback(row({ previews: many }), APP, NOW);
    const text = msg!.lines.join(" ");
    expect(text).toContain("Person 0");
    expect(text).toContain("Person 1");
    expect(text).toContain("Person 2");
    expect(text).not.toContain("Person 3");
  });
});
