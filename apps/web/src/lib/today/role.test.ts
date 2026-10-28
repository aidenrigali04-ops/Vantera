import { describe, expect, it } from "vitest";
import { isAccountAdmin } from "./role";

describe("isAccountAdmin", () => {
  it("owner and admin of this account are admins; a member is not", () => {
    expect(isAccountAdmin([{ account_id: "a", role: "owner" }], "a")).toBe(true);
    expect(isAccountAdmin([{ account_id: "a", role: "admin" }], "a")).toBe(true);
    expect(isAccountAdmin([{ account_id: "a", role: "member" }], "a")).toBe(false);
  });
  it("an admin row for another account does not count; no rows is not an admin", () => {
    expect(isAccountAdmin([{ account_id: "b", role: "admin" }, { account_id: "a", role: "member" }], "a")).toBe(false);
    expect(isAccountAdmin(null, "a")).toBe(false);
    expect(isAccountAdmin([], "a")).toBe(false);
  });
});
