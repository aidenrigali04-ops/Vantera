"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/form-error";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { deployCopyAgent, updateCopyAgent, type AgentActionState } from "./actions";

const STEPS = ["Name", "Targeting", "CTA", "Content", "Deploy"] as const;

const CTA_EXAMPLES = [
  "book a 15-minute intro call",
  "reply to set up a quick chat",
  "try a free demo",
] as const;

export type CopyEditValues = {
  name: string;
  cta: string;
  links: string;
  channels: { linkedin: boolean };
  sendMode: "review" | "automatic";
};

export function CopyWizard({
  scoutName,
  icpNames,
  linkedinCount = 0,
  edit,
}: {
  scoutName: string;
  icpNames: string[];
  linkedinCount?: number;
  /** present → edit an existing agent's config instead of deploying a new one */
  edit?: CopyEditValues;
}) {
  const isEdit = Boolean(edit);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(edit?.name ?? "");
  const [cta, setCta] = useState(edit?.cta ?? "");
  const [links, setLinks] = useState(edit?.links ?? "");
  const [fileCount, setFileCount] = useState(0);
  const [sendMode, setSendMode] = useState<"review" | "automatic">(edit?.sendMode ?? "review");
  const [state, action, pending] = useActionState<AgentActionState, FormData>(
    isEdit ? updateCopyAgent : deployCopyAgent,
    {}
  );

  const canNext =
    (step === 0 && name.trim().length > 0) ||
    step === 1 ||
    (step === 2 && cta.trim().length >= 3) ||
    step === 3 ||
    step === 4;

  return (
    <WizardShell
      stepLabels={[...STEPS]}
      step={step}
      endowed={1}
      endowedNote={`Targeting inherited from ${scoutName} ✓`}
      title={
        [
          "Name your agent",
          "Who it writes to",
          "What's the ask?",
          "Give it material",
          isEdit
            ? `Save changes to ${name.trim() || "your agent"}`
            : `Deploy ${name.trim() || "your agent"}`,
        ][step]!
      }
      hint={
        [
          "Your outreach teammate — it writes every LinkedIn message, tailored to each lead.",
          "Set by your Prospect Agent — every draft targets these people.",
          "The one thing each message invites the prospect to do.",
          isEdit
            ? "Add more material — anything you already uploaded stays."
            : "Optional — but the more you add, the smarter every message gets.",
          isEdit ? "Review your changes, then save the new config." : "Choose how it sends, then deploy.",
        ][step]
      }
    >
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="cta" value={cta} />
        <input type="hidden" name="links" value={links} />
        <input type="hidden" name="sendMode" value={sendMode} />

        {step === 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-name">Agent name</Label>
            <Input
              id="copy-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Penn, Quill, Sage"
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
              To change targeting, edit {scoutName} — both agents stay in sync.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-cta">Call to action</Label>
            <Textarea
              id="copy-cta"
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

        {/* stays mounted across steps so the chosen files survive to the final submit */}
        <div className={step === 3 ? "flex flex-col gap-4" : "hidden"}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-links">Links (one per line)</Label>
            <Textarea
              id="copy-links"
              value={links}
              onChange={(e) => setLinks(e.target.value)}
              placeholder={"https://yoursite.com/case-study\nhttps://yoursite.com/demo"}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="copy-files">Files or images (up to 5, 5 MB each)</Label>
            <Input
              id="copy-files"
              name="files"
              type="file"
              multiple
              onChange={(e) => setFileCount(e.target.files?.length ?? 0)}
            />
          </div>
        </div>

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Agent</dt>
              <dd className="font-medium">{name}</dd>
              <dt className="text-muted-foreground">Reaches out to</dt>
              <dd>{icpNames.join(" · ")}</dd>
              <dt className="text-muted-foreground">CTA</dt>
              <dd>{cta}</dd>
              <dt className="text-muted-foreground">Content</dt>
              <dd>
                {(() => {
                  const linkCount = links.split("\n").filter((l) => l.trim()).length;
                  const parts = [
                    linkCount > 0 && `${linkCount} link${linkCount === 1 ? "" : "s"}`,
                    fileCount > 0 && `${fileCount} file${fileCount === 1 ? "" : "s"}`,
                  ].filter(Boolean);
                  return parts.length > 0 ? parts.join(" · ") : "none — add anytime";
                })()}
              </dd>
              <dt className="text-muted-foreground">Channel</dt>
              <dd>LinkedIn</dd>
            </dl>

            <fieldset className="flex flex-col gap-2">
              <legend className="pb-1 text-sm font-medium">How should it send?</legend>
              {(
                [
                  {
                    value: "review",
                    title: "Review every draft",
                    note: "Recommended — nothing sends until you approve it.",
                  },
                  {
                    value: "automatic",
                    title: "Send automatically",
                    note: "Clean drafts send on a human-like schedule; anything with a style flag still comes to you.",
                  },
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

            {linkedinCount === 0 && (
              <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
                No LinkedIn account connected yet — drafting works now; sending starts once you{" "}
                <a href="/settings/channels" className="underline underline-offset-2">
                  connect LinkedIn in Settings → Channels
                </a>
                .
              </p>
            )}

            <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
              {name.trim() || "Your agent"} starts drafting as soon as qualified leads arrive.{" "}
              {sendMode === "review"
                ? "Every draft waits in your review queue — nothing sends without you."
                : "Clean drafts send automatically on a human-like schedule; flagged ones wait in your review queue."}
            </p>
          </div>
        )}

        <FormError message={state.error} />

        <div className="flex justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0 || pending}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={() => setStep(step + 1)} disabled={!canNext}>
              {step === STEPS.length - 2 ? "Finish" : "Next"}
            </Button>
          ) : (
            <Button type="submit" disabled={pending}>
              {isEdit
                ? pending
                  ? "Saving…"
                  : "Save changes"
                : pending
                  ? "Deploying…"
                  : `Deploy ${name.trim() || "agent"}`}
            </Button>
          )}
        </div>
      </form>
    </WizardShell>
  );
}
