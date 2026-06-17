import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, Eyebrow } from "@/components/ui/panel";

type Creative = {
  id: string;
  headline: string;
  primary_text: string;
  description: string | null;
  cta: string;
  creative_prompt: string;
  style_flags: string | null;
  status: string;
};

type Campaign = {
  id: string;
  name: string;
  offer: string;
  target_icp: string;
  cta: string;
  status: string;
  provider_campaign_id: string | null;
  ad_creatives: Creative[];
};

export default async function AdCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("ad_campaigns")
    .select(
      "id, name, offer, target_icp, cta, status, provider_campaign_id, ad_creatives(id, headline, primary_text, description, cta, creative_prompt, style_flags, status)"
    )
    .eq("id", id)
    .maybeSingle<Campaign>();
  if (!campaign) notFound();

  const concepts = campaign.ad_creatives ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Eyebrow>Ad campaign</Eyebrow>
          <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">{campaign.name}</h1>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/ads">← All ads</Link>
        </Button>
      </div>

      <Panel className="mb-4 flex flex-col gap-4">
        <h2 className="font-heading text-base font-semibold">Brief</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Offer</dt>
          <dd>{campaign.offer}</dd>
          <dt className="text-muted-foreground">Target</dt>
          <dd>{campaign.target_icp}</dd>
          <dt className="text-muted-foreground">Goal</dt>
          <dd>{campaign.cta}</dd>
        </dl>
      </Panel>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {concepts.length} concept{concepts.length === 1 ? "" : "s"}
        </h2>
      </div>

      {concepts.length === 0 ? (
        <Panel className="border-dashed py-8 text-center text-sm text-muted-foreground">
          No concepts generated yet. Generation may have hit a snag — generate this campaign again
          from the Ads page.
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {concepts.map((c) => {
            const flags: { rule: string; detail: string }[] = c.style_flags
              ? (JSON.parse(c.style_flags) as { rule: string; detail: string }[])
              : [];
            return (
              <Panel key={c.id} index={Math.min(concepts.indexOf(c), 5)} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold">{c.headline}</h3>
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {c.cta.replace(/_/g, " ").toLowerCase()}
                  </Badge>
                </div>
                <p className="text-sm">{c.primary_text}</p>
                {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                <div className="rounded-xl border border-black/[0.06] bg-black/[0.03] px-3 py-2 dark:border-white/[0.08] dark:bg-white/[0.04]">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Creative brief
                  </p>
                  <p className="mt-1 text-sm">{c.creative_prompt}</p>
                </div>
                {flags.length > 0 && (
                  <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                    Needs a look before publishing — this concept made a claim we couldn&apos;t
                    ground in what you told us ({flags.map((f) => f.detail).join(", ")}). Edit it
                    so every claim is true.
                  </p>
                )}
              </Panel>
            );
          })}
          <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
            Publishing to your ad account and generating the visuals are set up by your workspace
            once your ad account is connected. Until then, copy any concept straight into your ad
            manager — the leads it brings back will still nurture automatically.
          </p>
        </div>
      )}
    </div>
  );
}
