import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import * as schema from "./schema";

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "../migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();
const fileContents = new Map(
  migrationFiles.map((f) => [f, readFileSync(join(migrationsDir, f), "utf8").toLowerCase()])
);
const allMigrations = [...fileContents.values()].join("\n");

// every Drizzle table export — a table added to schema.ts without RLS fails automatically
const allTables = Object.values(schema)
  .filter((v) => typeof v === "object" && v !== null)
  .map((t) => getTableName(t as Parameters<typeof getTableName>[0]));

// exceptions to the account_id tenancy rule, each justified in its migration comment
const tenantExempt = new Set([
  "accounts",
  "account_members",
  "user_profiles",
  "app_settings",
  "webhook_events",
  // global RAG table — no account_id by design (identical data for every tenant); service-role only
  "copilot_knowledge_chunks",
]);

// returns the create-table DDL block for a table from the concatenated migrations
function tableDdl(table: string): string {
  const start = allMigrations.indexOf(`create table public.${table} (`);
  expect(start, `create table public.${table} not found in migrations`).toBeGreaterThan(-1);
  const end = allMigrations.indexOf(");", start);
  return allMigrations.slice(start, end);
}

describe("RLS guardrails (rule 02 — locked)", () => {
  it.each(allTables)("enables row level security on %s in its creating migration", (table) => {
    const file = migrationFiles.find((f) =>
      fileContents.get(f)?.includes(`create table public.${table} (`)
    );
    expect(file, `create table public.${table} not found in any migration`).toBeDefined();
    // RLS must be enabled in the SAME migration that creates the table (rule 02)
    expect(fileContents.get(file!)).toContain(
      `alter table public.${table} enable row level security`
    );
  });

  it.each(allTables.filter((t) => !tenantExempt.has(t)))(
    "%s is tenant-scoped via account_id with cascade",
    (table) => {
      expect(tableDdl(table)).toContain(
        "account_id uuid not null references public.accounts(id) on delete cascade"
      );
    }
  );

  it("scopes membership checks through auth.uid()", () => {
    expect(allMigrations).toContain("auth.uid()");
  });

  it("pins search_path on every security definer function", () => {
    for (const [file, rawContent] of fileContents) {
      // strip comment lines so prose mentioning "security definer" doesn't count
      const content = rawContent
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n");
      const definers = content.match(/security definer/g)?.length ?? 0;
      const pinned = content.match(/set search_path = ''/g)?.length ?? 0;
      expect(pinned, `${file}: every security definer needs set search_path = ''`).toBeGreaterThanOrEqual(definers);
    }
  });

  it("uses the membership helpers, never inline subqueries, in policies after 0000", () => {
    for (const [file, content] of fileContents) {
      if (file.startsWith("0000")) continue; // 0000 defines the helpers themselves
      expect(content, `${file}: use is_account_member/is_account_admin`).not.toContain(
        "from public.account_members"
      );
    }
  });
});

describe("suppression list (rule 11 — the master gate)", () => {
  const ddl = tableDdl("suppression_entries");

  it("entries never expire", () => {
    expect(ddl).not.toContain("expires_at");
    expect(allMigrations).toContain("never expire");
  });

  it("survives lead deletion (set null, not cascade)", () => {
    expect(ddl).toContain("references public.leads (id, account_id) on delete set null (lead_id)");
  });

  it("has no update or delete policies", () => {
    expect(allMigrations).not.toMatch(/create policy \w+ on public\.suppression_entries\s+for (update|delete)/);
  });

  it("has the scheduler-boundary lookup index", () => {
    expect(allMigrations).toContain(
      "create unique index suppression_lookup_idx on public.suppression_entries (account_id, kind, value)"
    );
  });
});

describe("retention windows (rule 11)", () => {
  it.each(["leads", "enrichment_results", "scheduled_sends", "replies"])(
    "%s states its retention window",
    (table) => {
      expect(allMigrations).toContain(`retention(${table})`);
    }
  );
});

describe("service-role-only write surfaces (rules 09/11)", () => {
  it.each(["outreach_sends", "copilot_actions", "enrichment_results", "replies", "unsubscribe_tokens", "copilot_conversations", "copilot_messages"])(
    "%s has no client write policies",
    (table) => {
    const policyRe = new RegExp(`create policy \\w+ on public\\.${table}\\s+for (insert|update|delete|all)`);
    expect(allMigrations).not.toMatch(policyRe);
    // still readable by account members
    expect(allMigrations).toMatch(new RegExp(`create policy \\w+ on public\\.${table}\\s+for select`));
  });
});

describe("migration hygiene", () => {
  it("files are sequentially numbered with no gaps", () => {
    migrationFiles.forEach((file, i) => {
      expect(file.startsWith(String(i).padStart(4, "0"))).toBe(true);
    });
  });
});

describe("copilot v1 (0011)", () => {
  it("copilot_knowledge_chunks is global: RLS on, no tenant policies (0011)", () => {
    const sql = readFileSync(join(migrationsDir, "0011_copilot_v1.sql"), "utf8");
    expect(sql).toMatch(/alter table public\.copilot_knowledge_chunks enable row level security/);
    // no RLS policy directly on the table (global/service-role-only table; see migration comment)
    expect(sql).not.toMatch(/create policy\s+\w+\s+on public\.copilot_knowledge_chunks/);
  });
});
