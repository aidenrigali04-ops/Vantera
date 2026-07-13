import Link from "next/link";
import { Quote, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddProofForm } from "./proof-editor";
import { removeProofPoint } from "./actions";

const KIND_LABELS: Record<string, string> = {
  metric: "Stat",
  outcome: "Result",
  pricing: "Pricing",
  faq: "FAQ",
};

type Row = { id: string; kind: string; text: string; question: string | null };

export default async function ProofPointsPage() {
  const supabase = await createClient();
  const { data: points } = await supabase
    .from("proof_points")
    .select("id, kind, text, question")
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(200)
    .overrideTypes<Row[]>();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Proof &amp; pricing</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The true facts your agent is allowed to share when a prospect asks &quot;can you prove
          it?&quot; or &quot;what does it cost?&quot;. Without these, your agent won&apos;t invent a
          number, it&apos;ll say it doesn&apos;t have one, which can stall a warm conversation.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Back to settings
          </Link>
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[var(--hairline)] bg-muted/40 px-4 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-xs text-muted-foreground">
          These are sent to prospects as fact on your behalf. Add only true, verifiable statements.
          Use anonymized references like &quot;a fintech client&quot; unless you have permission to
          name a customer. Your agent quotes them sparingly and only when relevant, never in a first
          message.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add a proof point</CardTitle>
        </CardHeader>
        <CardContent>
          <AddProofForm />
        </CardContent>
      </Card>

      {!points || points.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <Quote className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">No proof points yet</CardTitle>
            <p className="mx-auto max-w-md text-pretty text-sm text-muted-foreground">
              Add your strongest true stats, a real (anonymized) result, your pricing, and the
              answers to the questions prospects ask most. Your agent will have them ready the
              moment someone asks.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border pt-2">
            {points.map((p) => (
              <div key={p.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0 space-y-1">
                  <Badge variant="secondary">{KIND_LABELS[p.kind] ?? p.kind}</Badge>
                  {p.question && (
                    <p className="text-xs font-medium text-muted-foreground">“{p.question}”</p>
                  )}
                  <p className="text-sm text-pretty">{p.text}</p>
                </div>
                <form action={removeProofPoint}>
                  <input type="hidden" name="id" value={p.id} />
                  <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                    Remove
                  </Button>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
