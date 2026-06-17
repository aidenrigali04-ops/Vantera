import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdsGenerator } from "./ads-generator";

type AdCampaignRow = {
  id: string;
  name: string;
  offer: string;
  status: string;
  created_at: string;
  ad_creatives: { id: string }[];
};

export default async function AdsPage() {
  const supabase = await createClient();

  const [{ data: campaigns }, { data: scout }] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select("id, name, offer, status, created_at, ad_creatives(id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("agents")
      .select("agent_icps(position, icps(name))")
      .eq("kind", "scout")
      .limit(1)
      .maybeSingle<{ agent_icps: { position: number; icps: { name: string } | null }[] }>(),
  ]);

  const defaultTargetIcp = (scout?.agent_icps ?? [])
    .sort((a, b) => a.position - b.position)
    .map((l) => l.icps?.name)
    .find((n): n is string => Boolean(n));

  const rows = (campaigns as AdCampaignRow[] | null) ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Ads</h1>
        <p className="text-sm text-muted-foreground">
          Generate ad concepts on-brand, then turn the leads they bring in into nurtured pipeline.
        </p>
      </div>

      <div className="mb-8">
        <AdsGenerator defaultTargetIcp={defaultTargetIcp} />
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Your campaigns</h2>
          {rows.map((c) => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">
                    <Link href={`/ads/${c.id}`} className="underline-offset-4 hover:underline">
                      {c.name}
                    </Link>
                  </CardTitle>
                  <Badge variant="secondary" className="font-normal capitalize">
                    {c.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{c.offer}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {c.ad_creatives.length} concept{c.ad_creatives.length === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
