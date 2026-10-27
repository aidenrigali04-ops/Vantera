"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import type { Roi } from "@/lib/revenue";
import type { ProofModel } from "@/lib/proof/types";
import type { OutreachDiagnosisVM } from "@/lib/optimize";
import { OutreachDiagnosis } from "./outreach-diagnosis";
import { visibleBlocks } from "./gate";
import { ProofFunnel } from "./proof-funnel";
import { ProofTable } from "./proof-table";
import { DollarsHint, DollarsStrip } from "./dollars-strip";

type Props = {
  proof: ProofModel;
  roi: Roi;
  hasValue: boolean;
  outreach: OutreachDiagnosisVM;
};

// The Analytics view of Results — the proof. Counts (funnel + where prospects come from)
// show as soon as there is one prospect; dollars gate only dollars (gate.ts).
export function AnalyticsView({ proof, roi, hasValue, outreach }: Props) {
  const found = proof.funnel[0]?.count ?? 0;
  const show = visibleBlocks({ found, hasValue, hasSpend: roi.hasSpend });
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <header className="mb-6 border-b border-[var(--hairline)] pb-5">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          What your outreach is producing — counted from your own prospects, replies and meetings.
        </p>
      </header>

      {/* Where outreach leaks + the single biggest opportunity. Null until there's outreach. */}
      <OutreachDiagnosis vm={outreach} />

      {!show.funnel ? (
        <EmptyLeads />
      ) : (
        <div className="space-y-6">
          <ProofFunnel funnel={proof.funnel} nonMonotonic={proof.nonMonotonic} />
          {show.sources && <ProofTable sources={proof.sources} agents={proof.agents} capped={proof.capped} />}
          {show.dollars ? <DollarsStrip roi={roi} /> : show.dollarsHint && <DollarsHint missing={show.dollarsHint} />}
        </div>
      )}
    </div>
  );
}

function EmptyLeads() {
  return (
    <Panel className="py-12 text-center">
      <p className="mx-auto max-w-md text-sm text-muted-foreground">
        No prospects yet. Once your agents find people, your funnel and where they came from land
        here.
      </p>
      <Link
        href="/playbook"
        className="mt-5 inline-flex rounded-lg bg-foreground px-5 py-2 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Set up your pipeline
      </Link>
    </Panel>
  );
}
