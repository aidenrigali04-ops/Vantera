"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/form-error";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { deployResponderAgent, type AgentActionState } from "./actions";

const STEPS = ["Name", "Targeting", "Goal", "Sources", "Deploy"] as const;

const CTA_EXAMPLES = [
  "book a 15-minute intro call",
  "get a personalized demo",
  "talk to a specialist",
] as const;

const SOURCES = [
  { key: "formFill", name: "sourceFormFill", label: "Form fills", note: "Someone submits a contact or demo form." },
  { key: "websiteVisitor", name: "sourceWebsiteVisitor", label: "Website visitors", note: "A known company lands on a high-intent page." },
  { key: "signal", name: "sourceSignal", label: "Buying signals", note: "An inbound signal from a connected source." },
] as const;

export function ResponderWizard({ scoutName, icpNames }: { scoutName: string; icpNames: string[] }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [cta, setCta] = useState("");
  const [sendMode, setSendMode] = useState<"auto" | "review">("review");
  const [slaMinutes, setSlaMinutes] = useState(5);
  const [sources, setSources] = useState({ formFill: true, websiteVisitor: false, signal: false });
  const [state, action, pending] = useActionState<AgentActionState, FormData>(deployResponderAgent, {});

  const anySource = sources.formFill || sources.websiteVisitor || sources.signal;
  const canNext =
    (step === 0 && name.trim().length > 0) ||
    step === 1 ||
    (step === 2 && cta.trim().length >= 3) ||
    (step === 3 && anySource) ||
    step === 4;

  // One-time reveal after deploy — the signing secret is never shown again.
  if (state.responderDeployed) {
    const { intakePath, signingSecret } = state.responderDeployed;
    const webhookUrl =
      typeof window !== "undefined" ? `${window.location.origin}${intakePath}` : intakePath;
    return (
      <WizardShell
        stepLabels={[...STEPS]}
        step={STEPS.length - 1}
        title={`${name.trim() || "Your Responder"} is live`}
        hint="Point your form or site at this endpoint. Save the signing secret now — it won't be shown again."
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label>Webhook URL</Label>
            <code className="break-all rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
              {webhookUrl}
            </code>
            <p className="text-xs text-muted-foreground">
              POST inbound leads here; sign the raw body with{" "}
              <span className="font-medium">HMAC-SHA256</span> and send it as the{" "}
              <code className="text-[11px]">X-Vantera-Signature: sha256=…</code> header.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Signing secret</Label>
            <code className="break-all rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs">
              {signingSecret}
            </code>
            <p className="text-xs text-muted-foreground">
              Store this in your form provider now. We can&apos;t show it again — you&apos;d have to
              roll a new one.
            </p>
          </div>
          <Button asChild>
            <Link href="/agents?deployed=responder">Done</Link>
          </Button>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell
      stepLabels={[...STEPS]}
      step={step}
      endowed={1}
      endowedNote={`Targeting inherited from ${scoutName} ✓`}
      title={
        [
          "Name your agent",
          "Who it qualifies",
          "What's the ask?",
          "Where leads come from",
          `Deploy ${name.trim() || "your agent"}`,
        ][step]!
      }
      hint={
        [
          "Your fast-response teammate — it answers inbound leads in minutes, not days.",
          "Set by your Prospect Agent — inbound leads are scored against the same bar.",
          "The one thing your reply should invite the prospect to do.",
          "Enable at least one inbound source. Speed only helps where leads actually arrive.",
          "Choose how it responds, then deploy.",
        ][step]
      }
    >
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="cta" value={cta} />
        <input type="hidden" name="sendMode" value={sendMode} />
        <input type="hidden" name="slaMinutes" value={slaMinutes} />
        {sources.formFill && <input type="hidden" name="sourceFormFill" value="on" />}
        {sources.websiteVisitor && <input type="hidden" name="sourceWebsiteVisitor" value="on" />}
        {sources.signal && <input type="hidden" name="sourceSignal" value="on" />}

        {step === 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="resp-name">Agent name</Label>
            <Input
              id="resp-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rey, Echo, Flash"
              maxLength={60}
              autoFocus
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-wrap gap-2">
            {icpNames.map((icp) => (
              <Badge key={icp} variant="secondary" className="py-1 px-3 text-sm">
                {icp}
              </Badge>
            ))}
            <p className="w-full pt-2 text-xs text-muted-foreground">
              Inbound leads are qualified against this same bar — fast doesn&apos;t mean answering
              everyone. To change it, edit {scoutName}.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="resp-cta">Call to action</Label>
            <Textarea
              id="resp-cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              placeholder="e.g. book a 15-minute intro call"
              maxLength={200}
              autoFocus
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {CTA_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setCta(example)}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            {SOURCES.map((src) => {
              const on = sources[src.key];
              return (
                <button
                  key={src.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => setSources((s) => ({ ...s, [src.key]: !s[src.key] }))}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    on ? "border-primary bg-primary/5" : "border-border text-muted-foreground"
                  }`}
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{src.label}</span>
                    <span className="text-xs text-muted-foreground">{src.note}</span>
                  </span>
                  <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-[left] ${on ? "left-4.5" : "left-0.5"}`} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Agent</dt>
              <dd className="font-medium">{name}</dd>
              <dt className="text-muted-foreground">Qualifies against</dt>
              <dd>{icpNames.join(" · ") || "your Prospect Agent's ICPs"}</dd>
              <dt className="text-muted-foreground">CTA</dt>
              <dd>{cta}</dd>
              <dt className="text-muted-foreground">Sources</dt>
              <dd>{SOURCES.filter((s) => sources[s.key]).map((s) => s.label).join(" · ")}</dd>
              <dt className="text-muted-foreground">Respond within</dt>
              <dd>{slaMinutes} min</dd>
            </dl>

            <div className="flex flex-col gap-2">
              <Label htmlFor="resp-sla">Response time goal (minutes)</Label>
              <Input
                id="resp-sla"
                type="number"
                min={1}
                max={1440}
                value={slaMinutes}
                onChange={(e) => setSlaMinutes(Math.max(1, Math.min(1440, Number(e.target.value) || 5)))}
              />
              <p className="text-xs text-muted-foreground">
                Speed is the edge — most inbound leads go cold within the hour.
              </p>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1 text-sm font-medium">How should it respond?</legend>
              {(
                [
                  { value: "review", title: "Review every reply", note: "Recommended — nothing sends until you approve it." },
                  { value: "auto", title: "Respond automatically", note: "Clean replies send instantly within your SLA; anything flagged waits for you." },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={sendMode === opt.value}
                  onClick={() => setSendMode(opt.value)}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                    sendMode === opt.value ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <span className="font-medium">{opt.title}</span>
                  <span className="text-xs text-muted-foreground">{opt.note}</span>
                </button>
              ))}
            </fieldset>

            <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              {name.trim() || "Your agent"} qualifies every inbound lead and{" "}
              {sendMode === "review"
                ? "drafts a reply for your review — nothing sends without you."
                : "sends a clean reply within minutes; flagged ones wait in your review queue."}
            </p>
          </div>
        )}

        <FormError message={state.error} />

        <div className="flex justify-between">
          <Button type="button" variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || pending}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}>
              {step === STEPS.length - 2 ? "Finish" : "Next"}
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {pending ? "Deploying…" : `Deploy ${name.trim() || "agent"}`}
            </Button>
          )}
        </div>
      </form>
    </WizardShell>
  );
}
