"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Mail,
  MessageSquare,
  Phone,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Panel, Eyebrow } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveSequenceConfig, type SequenceState } from "./actions";
import type { SequenceConfig, SequenceStage } from "@vantera/jobs/pipeline/types";

const STAGE_META: { key: SequenceStage; label: string; icon: LucideIcon }[] = [
  { key: "linkedin", label: "LinkedIn", icon: UserPlus },
  { key: "email", label: "Email", icon: Mail },
  { key: "imessage", label: "iMessage", icon: MessageSquare },
  { key: "call", label: "Caller", icon: Phone },
];

export function SequenceBuilder({
  config,
  hasCampaign,
}: {
  config: SequenceConfig;
  hasCampaign: boolean;
}) {
  const [state, action, pending] = useActionState<SequenceState, FormData>(saveSequenceConfig, {});

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Eyebrow>Outreach sequence</Eyebrow>
        <h1 className="font-heading mt-3 text-3xl font-semibold tracking-tight">The flow every lead runs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {config.stages.linkedin.touches} LinkedIn touches → {config.stages.email.touches} emails → a
          text → up to {config.stages.call.maxAttempts ?? 2} calls — and it stops the instant a lead
          books.
        </p>
      </div>

      {!hasCampaign && (
        <Panel className="mb-4 flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            Launch a campaign to activate this sequence — you can still tune it here.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/agents">
              Go to agents <ArrowRight className="size-4" />
            </Link>
          </Button>
        </Panel>
      )}

      <form action={action} className="space-y-3">
        {STAGE_META.map((meta, i) => (
          <div key={meta.key}>
            <StageCard meta={meta} stage={config.stages[meta.key]} />
            {i < STAGE_META.length - 1 && (
              <div className="flex justify-center py-1">
                <ChevronRight className="size-4 rotate-90 text-muted-foreground/40" aria-hidden />
              </div>
            )}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save sequence"}
          </Button>
          {state.saved && (
            <span className="flex items-center gap-1.5 text-sm text-foreground">
              <CheckCircle2 className="size-4" /> Saved
            </span>
          )}
          {state.error && <span className="text-sm text-muted-foreground">{state.error}</span>}
        </div>
      </form>
    </div>
  );
}

function StageCard({
  meta,
  stage,
}: {
  meta: { key: SequenceStage; label: string; icon: LucideIcon };
  stage: SequenceConfig["stages"][SequenceStage];
}) {
  const Icon = meta.icon;
  const isCall = meta.key === "call";
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-foreground/10 text-foreground">
            <Icon className="size-4" />
          </span>
          <span className="font-heading text-base font-semibold">{meta.label}</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name={`${meta.key}.enabled`}
            defaultChecked={stage.enabled}
            className="size-4 accent-white"
          />
          Enabled
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field
          name={`${meta.key}.${isCall ? "maxAttempts" : "touches"}`}
          label={isCall ? "Call attempts" : "Touches"}
          defaultValue={isCall ? stage.maxAttempts ?? 2 : stage.touches}
          min={isCall ? 1 : 0}
          max={isCall ? 3 : 5}
        />
        <Field
          name={`${meta.key}.touchGapDays`}
          label="Gap (days)"
          defaultValue={stage.touchGapDays}
          min={0}
          max={14}
        />
        <Field
          name={`${meta.key}.waitDays`}
          label="Wait then advance"
          defaultValue={stage.waitDays}
          min={0}
          max={14}
        />
      </div>
    </Panel>
  );
}

function Field({
  name,
  label,
  defaultValue,
  min,
  max,
}: {
  name: string;
  label: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5")}>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <Input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="h-10 font-mono tabular-nums"
      />
    </label>
  );
}
