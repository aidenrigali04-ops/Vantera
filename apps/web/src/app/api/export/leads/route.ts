import { createClient } from "@/lib/supabase/server";

/**
 * P1 (2026-07-15): CSV export of the account's leads — table-stakes for a pipeline tool.
 * RLS scopes the select to the caller's account (rule 02); no account id is passed.
 * Email/phone are included (the user's own data, same as the CRM push carries).
 */
const COLS = [
  "first_name",
  "last_name",
  "title",
  "company_name",
  "industry",
  "location",
  "status",
  "source",
  "ai_score",
  "email",
  "phone",
  "linkedin_url",
  "meeting_booked_at",
  "deal_value_cents",
  "created_at",
] as const;

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in required.", { status: 401 });

  const { data, error } = await supabase
    .from("leads")
    .select(COLS.join(", "))
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return new Response("Export failed.", { status: 500 });

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const csv = [
    COLS.join(","),
    ...rows.map((r) => COLS.map((c) => csvCell(r[c])).join(",")),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vantera-leads.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
