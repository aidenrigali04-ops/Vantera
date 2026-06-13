import { describe, expect, it } from "vitest";
import { validateInvite, canManageTeam, seatCapReached } from "./validation";

describe("validateInvite", () => {
  it("requires a valid email and an allowed role", () => {
    expect(validateInvite({ email: "x@y.com", role: "member" }).ok).toBe(true);
    expect(validateInvite({ email: "nope", role: "member" }).ok).toBe(false);
    expect(validateInvite({ email: "x@y.com", role: "owner" }).ok).toBe(false); // owner not invitable
  });
});

describe("canManageTeam", () => {
  it("allows owner/admin, blocks member", () => {
    expect(canManageTeam("owner")).toBe(true);
    expect(canManageTeam("admin")).toBe(true);
    expect(canManageTeam("member")).toBe(false);
  });
});

describe("seatCapReached", () => {
  it("counts members + pending invites against maxSeats", () => {
    expect(seatCapReached(2, 1, 3)).toBe(true);  // 2 members + 1 pending = 3 >= 3
    expect(seatCapReached(1, 1, 3)).toBe(false);
  });
});
