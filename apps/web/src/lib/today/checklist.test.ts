import { describe, expect, it } from "vitest";
import { checklistFor, GET_STARTED_ASK, type ChecklistFacts } from "./checklist";

const facts = (over: Partial<ChecklistFacts> = {}): ChecklistFacts => ({
  buyersConfirmed: false,
  prospectsReviewed: false,
  linkedinActive: false,
  firstApprovedAt: null,
  calendarOrCrmConnected: false,
  dismissedAt: null,
  ...over,
});

describe("checklistFor — the Today Get Started rail", () => {
  it("endows the two onboarding steps", () => {
    const c = checklistFor(facts({ buyersConfirmed: true, prospectsReviewed: true }));
    expect(c).not.toBeNull();
    expect(c!.done).toBe(2);
    expect(c!.total).toBe(4);
    expect(c!.collapsed).toBe(true);
    expect(c!.dismissable).toBe(false);
    expect(c!.steps.map((s) => s.key)).toEqual(["buyers", "prospects", "linkedin", "approve", "connect"]);
  });
  it("four of four is dismissable", () => {
    const c = checklistFor(
      facts({ buyersConfirmed: true, prospectsReviewed: true, linkedinActive: true, firstApprovedAt: "2026-10-20T10:00:00Z" })
    );
    expect(c!.done).toBe(4);
    expect(c!.dismissable).toBe(true);
    expect(c!.collapsed).toBe(true);
  });
  it("optional connect step never counts", () => {
    const c = checklistFor(facts({ calendarOrCrmConnected: true }));
    expect(c!.done).toBe(0);
    expect(c!.collapsed).toBe(false);
    const connect = c!.steps.find((s) => s.key === "connect")!;
    expect(connect).toMatchObject({ done: true, optional: true, label: "Connect calendar or CRM", href: "/settings/integrations" });
    expect(c!.steps.filter((s) => !s.optional)).toHaveLength(4);
  });
  it("dismissed returns null", () => {
    expect(checklistFor(facts({ dismissedAt: "2026-01-01T00:00:00Z" }))).toBeNull();
    // permanent: a months-old dismissal still hides it (no 24 h rule here)
    expect(checklistFor(facts({ buyersConfirmed: true, dismissedAt: "2025-01-01T00:00:00Z" }))).toBeNull();
    expect(GET_STARTED_ASK).toBe("get_started");
  });
  it("a never-connected account has Connect LinkedIn open with the senders href", () => {
    const c = checklistFor(facts({ buyersConfirmed: true }));
    const li = c!.steps.find((s) => s.key === "linkedin")!;
    expect(li).toEqual({ key: "linkedin", label: "Connect LinkedIn", done: false, href: "/settings/senders", optional: false });
    expect(c!.steps.map((s) => s.href)).toEqual([
      "/playbook/scout/targeting",
      "/prospects",
      "/settings/senders",
      "/approvals",
      "/settings/integrations",
    ]);
    expect(c!.done).toBe(1);
  });
});
