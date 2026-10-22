import { describe, expect, it } from "vitest";
import { eventsForRouteParams } from "./route-event-map";

const p = (q: string) => new URLSearchParams(q);

describe("eventsForRouteParams", () => {
  it("fires linkedin_connected for connected=1 on the senders page", () => {
    expect(eventsForRouteParams(p("connected=1"), "/settings/senders")).toEqual([
      { name: "linkedin_connected", strip: [] },
    ]);
  });
  it("ignores connected=1 elsewhere", () => {
    expect(eventsForRouteParams(p("connected=1"), "/today")).toEqual([]);
  });
  it("ignores other connected values", () => {
    expect(eventsForRouteParams(p("connected=0"), "/settings/senders")).toEqual([]);
  });
  it("preserves deployed", () => {
    expect(eventsForRouteParams(p("deployed=scout"), "/playbook")).toEqual([
      { name: "agent_deployed", params: { kind: "scout" }, strip: [] },
    ]);
  });
  it("preserves onboarded", () => {
    expect(eventsForRouteParams(p("onboarded=1"), "/today")).toEqual([{ name: "onboarding_completed", strip: ["onboarded"] }]);
  });
  it("preserves checkout success with plan details", () => {
    expect(
      eventsForRouteParams(p("checkout=success&plan=pro&interval=month&value=99"), "/settings/billing")
    ).toEqual([
      { name: "subscription_started", params: { plan: "pro", interval: "month", value: "99", currency: "USD" }, strip: ["checkout", "plan", "interval", "value"] },
    ]);
    expect(eventsForRouteParams(p("checkout=success"), "/settings/billing")).toEqual([
      { name: "subscription_started", params: {}, strip: ["checkout", "plan", "interval", "value"] },
    ]);
    expect(eventsForRouteParams(p("checkout=cancel"), "/settings/billing")).toEqual([]);
  });
  it("never strips connected (the senders banner reads it)", () => {
    const evs = eventsForRouteParams(p("connected=1&deployed=x&onboarded=1&checkout=success"), "/settings/senders");
    expect(evs.flatMap((e) => e.strip)).not.toContain("connected");
  });
});
