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
  // security audit log — account_id is nullable so system/global events (no resolvable account)
  // can be recorded; account-scoped rows still cascade (0027).
  "security_events",
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
  it.each(["leads", "enrichment_results", "scheduled_sends", "replies", "inbound_leads"])(
    "%s states its retention window",
    (table) => {
      expect(allMigrations).toContain(`retention(${table})`);
    }
  );
});

describe("service-role-only write surfaces (rules 09/11)", () => {
  it.each(["outreach_sends", "copilot_actions", "enrichment_results", "replies", "unsubscribe_tokens", "conversion_tokens", "copilot_conversations", "copilot_messages", "calls", "security_events", "inbound_leads"])(
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

describe("billing entitlements (0013)", () => {
  it("0013: billing snapshot columns are not client-writable", () => {
    const sql = readFileSync(join(migrationsDir, "0013_billing_entitlements.sql"), "utf8");
    const grantMatch = sql.match(/grant update \(([^)]*)\)\s+on table public\.accounts/i);
    expect(grantMatch, "expected a column-scoped accounts UPDATE grant").toBeTruthy();
    const granted = grantMatch![1];
    for (const col of [
      "plan",
      "subscription_status",
      "seats_purchased",
      "linkedin_accounts_purchased",
      "current_period_end",
    ]) {
      expect(granted).not.toContain(col);
    }
  });

  it("0013: sender_address and outreach_paused ARE client-writable (closes pre-existing gap)", () => {
    const sql = readFileSync(join(migrationsDir, "0013_billing_entitlements.sql"), "utf8");
    const grantMatch = sql.match(/grant update \(([^)]*)\)\s+on table public\.accounts/i);
    expect(grantMatch, "expected a column-scoped accounts UPDATE grant").toBeTruthy();
    const granted = grantMatch![1];
    for (const col of ["sender_address", "outreach_paused"]) {
      expect(granted).toContain(col);
    }
  });
});

describe("account sender name (0019)", () => {
  it("0019: sender_name is client-writable (column-scoped accounts UPDATE grant)", () => {
    const sql = readFileSync(join(migrationsDir, "0019_account_sender_name.sql"), "utf8");
    const grantMatch = sql.match(/grant update \(([^)]*)\)\s+on (?:table )?public\.accounts/i);
    expect(grantMatch, "expected a column-scoped accounts UPDATE grant").toBeTruthy();
    expect(grantMatch![1]).toContain("sender_name");
  });
});

describe("mailbox SMTP secret columns (0021)", () => {
  it("0021 revokes mailbox SMTP secret columns from clients", () => {
    const sql = readFileSync(join(migrationsDir, "0021_mailbox_smtp_secret.sql"), "utf8");
    expect(sql).toMatch(/REVOKE ALL \(smtp_secret, smtp_host, smtp_port, smtp_username\) ON mailboxes FROM authenticated/);
  });
});

describe("linkedin_connected_at server-managed (0022)", () => {
  it("0022 revokes client UPDATE on linkedin_connected_at", () => {
    const sql = readFileSync(join(migrationsDir, "0022_linkedin_connected_at_grant.sql"), "utf8");
    expect(sql).toMatch(/revoke update \(linkedin_connected_at\) on leads from authenticated/i);
  });
});

describe("scheduled_sends stage/channel integrity (0023)", () => {
  it("0023 constrains linkedin_stage to the linkedin channel", () => {
    const sql = readFileSync(join(migrationsDir, "0023_scheduled_sends_stage_check.sql"), "utf8");
    expect(sql).toMatch(/check \(linkedin_stage is null or channel = 'linkedin'\)/i);
  });
});

describe("imessage webhook source (0024)", () => {
  it("0024 adds imessage to the webhook source set", () => {
    const sql = readFileSync(join(migrationsDir, "0024_imessage_webhook_source.sql"), "utf8");
    expect(sql).toMatch(/source in \('email', 'linkedin', 'stripe', 'voice', 'imessage'\)/i);
  });
});

describe("column-grant lockdown (0025)", () => {
  const sql = readFileSync(join(migrationsDir, "0025_column_grant_lockdown.sql"), "utf8");

  it("0025 removes client writes on mailboxes and hides smtp_* from SELECT", () => {
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.mailboxes FROM authenticated, anon/i);
    expect(sql).toMatch(/REVOKE SELECT ON public\.mailboxes FROM authenticated, anon/i);
    // the re-granted SELECT column list must NOT include any smtp_* column
    const grant = sql.match(/GRANT SELECT \(([\s\S]*?)\) ON public\.mailboxes/i);
    expect(grant, "expected a column-scoped mailboxes SELECT grant").toBeTruthy();
    expect(grant![1]).not.toMatch(/smtp_/);
  });

  it("0025 keeps client UPDATE on leads but excludes linkedin_connected_at", () => {
    expect(sql).toMatch(/REVOKE UPDATE ON public\.leads FROM authenticated/i);
    const grant = sql.match(/GRANT UPDATE \(([\s\S]*?)\) ON public\.leads/i);
    expect(grant, "expected a column-scoped leads UPDATE grant").toBeTruthy();
    expect(grant![1]).not.toMatch(/linkedin_connected_at/);
  });
});

describe("inbound responder (0029)", () => {
  const sql = readFileSync(join(migrationsDir, "0029_inbound_responder.sql"), "utf8");

  it("0029 adds 'responder' to the agent kind set", () => {
    expect(sql).toMatch(/kind in \('scout', 'copy', 'caller', 'responder'\)/i);
  });

  it("0029 adds 'inbound' to the webhook source and leads source sets", () => {
    expect(sql).toMatch(/source in \('email', 'linkedin', 'stripe', 'voice', 'imessage', 'inbound'\)/i);
    expect(sql).toMatch(/source in \('discovery', 'manual', 'import', 'inbound'\)/i);
  });

  it("0029 keeps the intake secret store service-role only (RLS on, no policies)", () => {
    expect(sql).toMatch(/alter table public\.inbound_intake_secrets enable row level security/i);
    expect(sql).not.toMatch(/create policy\s+\w+\s+on public\.inbound_intake_secrets/i);
  });
});

describe("column-grant lockdown (0026 — crm_connections tokens)", () => {
  const sql = readFileSync(join(migrationsDir, "0026_crm_token_column_lockdown.sql"), "utf8");

  it("0026 revokes SELECT and re-grants without the encrypted token columns", () => {
    expect(sql).toMatch(/REVOKE SELECT ON public\.crm_connections FROM authenticated, anon/i);
    const grant = sql.match(/GRANT SELECT \(([\s\S]*?)\) ON public\.crm_connections/i);
    expect(grant, "expected a column-scoped crm_connections SELECT grant").toBeTruthy();
    expect(grant![1]).not.toMatch(/access_token_enc/);
    expect(grant![1]).not.toMatch(/refresh_token_enc/);
  });
});
