import { createClient } from "@/lib/supabase/server";
import { getGateData } from "@/lib/auth/context";
import { loadAnalytics, loadSignalAttribution } from "@/lib/analytics";
import { AnalyticsView } from "./analytics-view";

// The Analytics view of the Results surface — the renewal proof: conversion funnel + the ROI the
// report says decides renewal (pipeline vs the 2x-spend bar). All numbers come from loadAnalytics
// (shared with the copilot tool so they never diverge); RLS scopes every query (rule 02).
export async function AnalyticsSection() {
  const { account } = await getGateData();
  if (!account) return null; // layout gate guarantees this; satisfies TS

  const supabase = await createClient();
  const [vm, attribution] = await Promise.all([
    loadAnalytics(supabase),
    loadSignalAttribution(supabase),
  ]);

  return (
    <AnalyticsView
      hasLeads={vm.hasLeads}
      funnel={vm.funnel}
      meetingsTracked={vm.meetingsTracked}
      roi={vm.roi}
      hasValue={vm.hasValue}
      closedCents={vm.closedCents}
      pipelineCents={vm.pipelineCents}
      goalCents={vm.goalCents}
      attribution={attribution}
    />
  );
}
