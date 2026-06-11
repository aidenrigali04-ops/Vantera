import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { accounts, accountMembers } from "./schema";

const migration = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../migrations/0000_init.sql"),
  "utf8"
).toLowerCase();

describe("migration #1", () => {
  // RLS from migration #1 is a locked decision (rule 02) — this keeps it unskippable
  it.each([accounts, accountMembers].map((t) => getTableName(t)))(
    "enables row level security on %s",
    (table) => {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  );

  it("scopes membership checks through auth.uid()", () => {
    expect(migration).toContain("auth.uid()");
  });
});
