import { describe, expect, it } from "vitest";
import { validateInvite, canManageTeam, seatCapReached, matchMemberEmails } from "./validation";

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

describe("matchMemberEmails", () => {
  const owner = { user_id: "u-owner", role: "owner", created_at: "2026-01-01T00:00:00Z" };

  it("zips non-owner members to accepted invites in chronological order", () => {
    const members = [
      owner,
      { user_id: "u-2", role: "member", created_at: "2026-01-03T00:00:00Z" },
      { user_id: "u-1", role: "admin", created_at: "2026-01-02T00:00:00Z" },
    ];
    const invites = [
      { email: "second@x.com", accepted_at: "2026-01-03T00:00:00Z" },
      { email: "first@x.com", accepted_at: "2026-01-02T00:00:00Z" },
    ];
    const map = matchMemberEmails(members, invites);
    expect(map.get("u-1")).toBe("first@x.com");
    expect(map.get("u-2")).toBe("second@x.com");
    expect(map.has("u-owner")).toBe(false); // the owner never came from an invite
  });

  it("leaves members unmatched rather than guessing when invites are missing", () => {
    const members = [owner, { user_id: "u-1", role: "member", created_at: "2026-01-02T00:00:00Z" }];
    expect(matchMemberEmails(members, []).size).toBe(0);
  });
});
