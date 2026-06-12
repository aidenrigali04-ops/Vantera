import Link from "next/link";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { DraftCard, type DraftRow } from "./draft-card";

const CHANNELS = ["all", "email", "linkedin"] as const;

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const { channel } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("scheduled_sends")
    .select(
      "id, channel, subject, body, style_flags, created_at, leads(first_name, last_name, title, company_name)",
      { count: "exact" }
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: true })
    .limit(50);
  if (channel === "email" || channel === "linkedin") query = query.eq("channel", channel);
  const { data: drafts, count } = await query;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
        <p className="text-sm text-muted-foreground">
          {count ?? 0} draft{count === 1 ? "" : "s"} waiting. Nothing sends without your approval.
        </p>
      </div>

      <div className="mb-4 flex gap-2 text-sm">
        {CHANNELS.map((c) => (
          <Link
            key={c}
            href={c === "all" ? "/review" : `/review?channel=${c}`}
            className={`rounded-full border px-3 py-1 capitalize ${
              (channel ?? "all") === c ? "border-primary bg-primary/10 font-medium" : "border-border"
            }`}
          >
            {c === "linkedin" ? "LinkedIn" : c}
          </Link>
        ))}
      </div>

      {!drafts || drafts.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Inbox className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Queue&apos;s clear</CardTitle>
            <p className="max-w-md text-sm text-muted-foreground">
              When your Copy Agent drafts outreach for qualified leads, every message lands here
              for your sign-off first. Check{" "}
              <Link href="/agents" className="underline underline-offset-2">
                your agents
              </Link>{" "}
              are live.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {(drafts as unknown as DraftRow[]).map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </div>
      )}
    </div>
  );
}
