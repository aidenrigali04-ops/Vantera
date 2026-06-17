"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormError } from "@/components/form-error";
import { generateAdCampaign, type AdActionState } from "./actions";

export function AdsGenerator({ defaultTargetIcp }: { defaultTargetIcp?: string }) {
  const [state, action, pending] = useActionState<AdActionState, FormData>(generateAdCampaign, {});
  const [variants, setVariants] = useState(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Generate ad concepts</CardTitle>
        <p className="text-sm text-muted-foreground">
          Describe the offer and who it&apos;s for. We&apos;ll write a few on-brand concepts —
          copy plus a creative brief — grounded in what you actually do. Leads who fill the form
          flow into your nurture sequence automatically.
        </p>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ad-name">Campaign name</Label>
            <Input id="ad-name" name="name" placeholder="e.g. Q3 demo push" maxLength={60} required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ad-offer">What does this ad offer?</Label>
            <Textarea
              id="ad-offer"
              name="offer"
              placeholder="e.g. a free pipeline teardown, a 14-day trial, a benchmark report"
              maxLength={200}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ad-target">Who is it for?</Label>
            <Input
              id="ad-target"
              name="targetIcp"
              defaultValue={defaultTargetIcp}
              placeholder="e.g. VP Sales at 50–500-person SaaS companies"
              maxLength={200}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ad-cta">What should a click lead to?</Label>
            <Input
              id="ad-cta"
              name="cta"
              placeholder="e.g. book a 15-minute teardown"
              maxLength={200}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ad-variants">How many concepts?</Label>
            <Input
              id="ad-variants"
              name="variants"
              type="number"
              min={1}
              max={5}
              value={variants}
              onChange={(e) => setVariants(Math.max(1, Math.min(5, Number(e.target.value) || 3)))}
              className="w-24"
            />
          </div>
          <FormError message={state.error} />
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Generating…" : "Generate concepts"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
