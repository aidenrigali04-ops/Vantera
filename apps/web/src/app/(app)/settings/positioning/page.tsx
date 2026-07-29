import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PositioningForm } from "./positioning-form";

export const metadata = { title: "Positioning" };

type Row = { value_prop: string | null; brand_voice: string | null; guardrails: string | null };

export default async function PositioningPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("value_prop, brand_voice, guardrails")
    .limit(1)
    .maybeSingle<Row>();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="border-b border-[var(--hairline)] pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Positioning</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          How your agent describes what you do, the voice it writes in, and the lines it must never
          cross. Your cold connection request stays deliberately un-pitched — positioning shapes the
          conversation once someone replies.{" "}
          <Link href="/settings" className="underline underline-offset-2">
            Back to settings
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your positioning</CardTitle>
        </CardHeader>
        <CardContent>
          <PositioningForm
            initial={{
              valueProp: data?.value_prop ?? "",
              brandVoice: data?.brand_voice ?? "",
              guardrails: data?.guardrails ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
