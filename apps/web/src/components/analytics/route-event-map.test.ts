import { describe, expect, it } from "vitest";
import { eventsForRouteParams } from "./route-event-map";

const p = (q: string) => new URLSearchParams(q);

describe("eventsForRouteParams", () => {
  it("fires linkedin_connected for connected=1 on the senders page", () => {
    expect(eventsForRouteParams(p("connected=1"), "/settings/senders")).toEqual([
      { name: "linkedin_connected" },
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
      { name: "agent_deployed", params: { kind: "scout" } },
    ]);
  });
  it("preserves onboarded", () => {
    expect(eventsForRouteParams(p("onboarded=1"), "/today")).toEqual([{ name: "onboarding_completed" }]);
  });
  it("preserves checkout success with plan details", () => {
    expect(
      eventsForRouteParams(p("checkout=success&plan=pro&interval=month&value=99"), "/settings/billing")
    ).toEqual([
      { name: "subscription_started", params: { plan: "pro", interval: "month", value: "99", currency: "USD" } },
    ]);
    expect(eventsForRouteParams(p("checkout=success"), "/settings/billing")).toEqual([
      { name: "subscription_started", params: {} },
    ]);
    expect(eventsForRouteParams(p("checkout=cancel"), "/settings/billing")).toEqual([]);
  });
});
