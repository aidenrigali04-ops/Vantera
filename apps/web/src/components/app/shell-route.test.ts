import { describe, expect, it } from "vitest";
import { shellRoute } from "./shell-route";

describe("shellRoute", () => {
  it("lets Today scroll the window", () => {
    expect(shellRoute("/today")).toEqual({ onToday: true, oneScreen: false });
  });

  it.each(["/approvals", "/inbox", "/prospects", "/prospects/abc", "/playbook", "/dashboard", "/sequence"])(
    "keeps %s to one screen",
    (path) => {
      expect(shellRoute(path)).toEqual({ onToday: false, oneScreen: true });
    }
  );

  it("lets settings and wizards scroll naturally", () => {
    expect(shellRoute("/settings/billing")).toEqual({ onToday: false, oneScreen: false });
    expect(shellRoute("/playbook/scout/edit")).toEqual({ onToday: false, oneScreen: false });
  });

  it("ignores the query string and a missing path", () => {
    expect(shellRoute("/inbox?lead=1").oneScreen).toBe(true);
    expect(shellRoute(null)).toEqual({ onToday: false, oneScreen: false });
  });
});
