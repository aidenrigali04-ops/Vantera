"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { deployIntentAgent, suggestIntentWatchlist, updateIntentAgent, type AgentActionState } from "./actions";
import { intentFormFields, type IntentFormValues } from "./validation";
import { ReviewStep, ScheduleStep, WatchStep, type Cadence } from "./intent-wizard/steps";

const STEPS = ["Name", "Watch", "Schedule", "Deploy"] as const;

/** The saved agent, when the wizard edits a deployed Intent agent instead of deploying one. */
export type IntentWizardEdit = IntentFormValues;

export function IntentWizard({ scoutName, edit }: { scoutName: string; edit?: IntentWizardEdit }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(edit?.name ?? "");
  const [creators, setCreators] = useState<string[]>(edit?.watch.creators ?? []);
  const [competitors, setCompetitors] = useState<string[]>(edit?.watch.competitors ?? []);
  const [keywords, setKeywords] = useState<string[]>(edit?.watch.keywords ?? []);
  const [hashtags, setHashtags] = useState<string[]>(edit?.watch.hashtags ?? []);
  const [suggesting, setSuggesting] = useState(!edit);
  const [suggested, setSuggested] = useState(false);
  const [engagement, setEngagement] = useState(edit?.signals.engagement ?? true);
  const [content, setContent] = useState(edit?.signals.content ?? true);
  const [follows, setFollows] = useState(edit?.signals.follows ?? true);
  const [runAtTime, setRunAtTime] = useState(edit?.runAtTime ?? "08:00");
  const [cadence, setCadence] = useState<Cadence>(edit?.cadence ?? "daily");
  const [timezone] = useState(
    () => edit?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
  );
  const [state, action, pending] = useActionState<AgentActionState, FormData>(
    edit ? updateIntentAgent : deployIntentAgent,
    {}
  );

  // Auto-fill the watchlist from what we already know (industry + website scan + ICP) so setup needs
  // no hunting for profiles or URLs. Only fills lists the user hasn't touched; fails silently to the
  // manual form (B=MAP — kill the ability cost before the deploy moment). Skipped when editing:
  // the saved watchlist is the user's.
  useEffect(() => {
    if (edit) return;
    let active = true;
    suggestIntentWatchlist()
      .then((s) => {
        if (!active) return;
        setKeywords((cur) => (cur.length ? cur : s.keywords));
        setCompetitors((cur) => (cur.length ? cur : s.competitors));
        setHashtags((cur) => (cur.length ? cur : s.hashtags));
        if (s.keywords.length || s.competitors.length || s.hashtags.length) setSuggested(true);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSuggesting(false);
      });
    return () => {
      active = false;
    };
  }, [edit]);

  const watchCount = creators.length + competitors.length + keywords.length + hashtags.length;
  const canNext =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && watchCount > 0 && (engagement || content || follows)) ||
    step >= 2;
  const fields = intentFormFields({
    name,
    watch: { creators, competitors, keywords, hashtags },
    signals: { engagement, content, follows },
    runAtTime,
    cadence,
    timezone,
  });
  const submitLabel = edit
    ? pending ? "Saving…" : "Save changes"
    : pending ? "Deploying…" : `Deploy ${name.trim() || "agent"}`;

  return (
    <WizardShell
      stepLabels={edit ? ["Name", "Watch", "Schedule", "Save"] : [...STEPS]}
      step={step}
      endowed={1}
      endowedNote={`Qualifies against ${scoutName}'s ICP ✓`}
      title={
        [
          "Name your agent",
          "What should it watch?",
          "When should it run?",
          edit ? "Review your changes" : `Deploy ${name.trim() || "your agent"}`,
        ][step]!
      }
      hint={
        [
          "Your intent scout — it finds people showing they're in-market on LinkedIn.",
          edit
            ? "Change the topics, competitors, and people it watches."
            : "We filled this in from your business — review the topics and competitors we'll watch, and add any of your own.",
          "It reads LinkedIn, qualifies, and drafts on this schedule.",
          edit ? "Review everything, then save." : "Review everything, then put it to work.",
        ][step]
      }
    >
      <form action={action} className="flex flex-col gap-5">
        {fields.map(([key, value]) => (
          <input
            key={key}
            type="hidden"
            name={key}
            value={value}
            suppressHydrationWarning={key === "timezone"}
          />
        ))}

        {step === 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="intent-name">Agent name</Label>
            <Input
              id="intent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sonar, Pulse, Radar"
              maxLength={60}
              autoFocus
            />
          </div>
        )}

        {step === 1 && (
          <WatchStep
            suggesting={suggesting}
            suggested={suggested}
            keywords={{ values: keywords, set: setKeywords }}
            competitors={{ values: competitors, set: setCompetitors }}
            hashtags={{ values: hashtags, set: setHashtags }}
            creators={{ values: creators, set: setCreators }}
            engagement={{ on: engagement, set: setEngagement }}
            content={{ on: content, set: setContent }}
            follows={{ on: follows, set: setFollows }}
          />
        )}

        {step === 2 && (
          <ScheduleStep
            runAtTime={runAtTime}
            setRunAtTime={setRunAtTime}
            cadence={cadence}
            setCadence={setCadence}
            timezone={timezone}
          />
        )}

        {step === 3 && (
          <ReviewStep
            name={name}
            watchCount={watchCount}
            signalLabels={[engagement && "engagement", content && "content", follows && "followers"].filter(
              (s): s is string => Boolean(s)
            )}
            scoutName={scoutName}
            cadence={cadence}
            runAtTime={runAtTime}
            timezone={timezone}
            editing={Boolean(edit)}
          />
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
              {submitLabel}
            </Button>
          )}
        </div>
      </form>
    </WizardShell>
  );
}
