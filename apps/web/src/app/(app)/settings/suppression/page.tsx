import Link from "next/link";
import { ShieldBan } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddSuppressionForm } from "./add-form";

const SOURCE_LABELS: Record<string, string> = {
  unsubscribe: "Unsubscribed",
  bounce: "Bounced",
  complaint: "Spam complaint",
  manual: "Added manually",
  not_interested: "Not interested",
  gdpr: "GDPR request",
};

export default async function SuppressionPage() {
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from("suppression_entries")
    .select("id, kind, value, source, note, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suppression list</h1>
        <p className="text-sm text-muted-foreground">
          Contacts here are never messaged by your agents on the channel they&apos;re suppressed
          for. Entries are permanent — they protect you and your prospects.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Back to settings
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suppress a contact</CardTitle>
        </CardHeader>
        <CardContent>
          <AddSuppressionForm />
        </CardContent>
      </Card>

      {!entries || entries.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <ShieldBan className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Nothing suppressed yet</CardTitle>
            <p className="text-sm text-muted-foreground">
              Unsubscribes, bounces, and &quot;not interested&quot; replies land here automatically
              once sending goes live. You can add contacts manually any time.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 font-medium">Contact</th>
                  <th className="pb-2 font-medium">Channel</th>
                  <th className="pb-2 font-medium">Reason</th>
                  <th className="pb-2 font-medium">Added</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="max-w-80 truncate py-2 font-medium" title={e.value}>
                      {e.value}
                      {e.note && (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {e.note}
                        </span>
                      )}
                    </td>
                    <td className="py-2">{e.kind === "email" ? "Email" : "LinkedIn"}</td>
                    <td className="py-2">
                      <Badge variant="secondary">{SOURCE_LABELS[e.source] ?? e.source}</Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {new Date(e.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
