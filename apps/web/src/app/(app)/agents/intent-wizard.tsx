"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { deployIntentAgent, type AgentActionState } from "./actions";

const RUN_TIMES = ["06:00", "07:00", "08:00", "09:00", "10:00", "12:00", "15:00", "18:00"];
const STEPS = ["Name", "Watch", "Schedule", "Deploy"] as const;

export function IntentWizard({ scoutName }: { scoutName: string }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [creators, setCreators] = useState<string[]>([]);
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [engagement, setEngagement] = useState(true);
  const [content, setContent] = useState(true);
  const [runAtTime, setRunAtTime] = useState("08:00");
  const [cadence, setCadence] = useState<"daily" | "weekly">("daily");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  const [state, action, pending] = useActionState<AgentActionState, FormData>(deployIntentAgent, {});

  const watchCount = creators.length + competitors.length + keywords.length + hashtags.length;
  const canNext =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && watchCount > 0 && (engagement || content)) ||
    step >= 2;

  return (
    <WizardShell
      stepLabels={[...STEPS]}
      step={step}
      endowed={1}
      endowedNote={`Qualifies against ${scoutName}'s ICP ✓`}
      title={
        [
          "Name your agent",
          "What should it watch?",
          "When should it run?",
          `Deploy ${name.trim() || "your agent"}`,
        ][step]!
      }
      hint={
        [
          "Your intent scout — it finds people showing they're in-market on LinkedIn.",
          "Point it at the creators, competitors, keywords, and hashtags your buyers engage with.",
          "It reads LinkedIn, qualifies, and drafts on this schedule.",
          "Review everything, then put it to work.",
        ][step]
      }
    >
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="creators" value={JSON.stringify(creators)} />
        <input type="hidden" name="competitors" value={JSON.stringify(competitors)} />
        <input type="hidden" name="keywords" value={JSON.stringify(keywords)} />
        <input type="hidden" name="hashtags" value={JSON.stringify(hashtags)} />
        {engagement && <input type="hidden" name="signalEngagement" value="on" />}
        {content && <input type="hidden" name="signalContent" value="on" />}
        <input type="hidden" name="runAtTime" value={runAtTime} />
        <input type="hidden" name="cadence" value={cadence} />
        <input type="hidden" name="timezone" value={timezone} suppressHydrationWarning />

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
          <div className="flex flex-col gap-5">
            <ChipList label="Creators (LinkedIn profile URLs)" placeholder="https://linkedin.com/in/…" values={creators} onChange={setCreators} />
            <ChipList label="Competitors (LinkedIn profile URLs)" placeholder="https://linkedin.com/in/…" values={competitors} onChange={setCompetitors} />
            <ChipList label="Keywords" placeholder="e.g. onboarding churn" values={keywords} onChange={setKeywords} />
            <ChipList label="Hashtags" placeholder="e.g. revops" values={hashtags} onChange={setHashtags} />

            <div className="flex flex-col gap-2">
              <Label>Intent signals</Label>
              <div className="flex flex-col gap-2">
                <SignalToggle
                  label="Engagement"
                  note="People who like or comment on the posts you watch"
                  on={engagement}
                  set={setEngagement}
                />
                <SignalToggle
                  label="Content"
                  note="People posting about your keywords and hashtags"
                  on={content}
                  set={setContent}
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="run-time">Run time</Label>
              <select
                id="run-time"
                value={runAtTime}
                onChange={(e) => setRunAtTime(e.target.value)}
                className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {RUN_TIMES.map((t) => (
                  <option key={t} value={t}>
                    {Number(t.slice(0, 2)) % 12 || 12}:{t.slice(3)} {Number(t.slice(0, 2)) < 12 ? "AM" : "PM"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                Times are in your timezone ({timezone}).
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Cadence</Label>
              <div className="flex gap-2" role="radiogroup" aria-label="Cadence">
                {(["daily", "weekly"] as const).map((c) => (
                  <Button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={cadence === c}
                    variant={cadence === c ? "default" : "outline"}
                    onClick={() => setCadence(c)}
                  >
                    Every {c === "daily" ? "day" : "week"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Agent</dt>
            <dd className="font-medium">{name}</dd>
            <dt className="text-muted-foreground">Watching</dt>
            <dd>{watchCount} target{watchCount === 1 ? "" : "s"} · {[engagement && "engagement", content && "content"].filter(Boolean).join(" + ")}</dd>
            <dt className="text-muted-foreground">Qualifies against</dt>
            <dd>{scoutName}&apos;s ICP</dd>
            <dt className="text-muted-foreground">Schedule</dt>
            <dd>Every {cadence === "daily" ? "day" : "week"} at {runAtTime} ({timezone})</dd>
            <dt className="text-muted-foreground">First run</dt>
            <dd>within 15 minutes of deploy</dd>
          </dl>
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

function ChipList({
  label,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = (raw: string) => {
    const v = raw.trim();
    if (!v || values.includes(v) || values.length >= 10) return;
    onChange([...values, v]);
    setInput("");
  };
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={placeholder}
          disabled={values.length >= 10}
        />
        <Button type="button" variant="secondary" onClick={() => add(input)} disabled={!input.trim() || values.length >= 10}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <Badge key={v} variant="secondary" className="max-w-full gap-1 py-1 pl-3 pr-1 text-sm">
              <span className="truncate">{v}</span>
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function SignalToggle({
  label,
  note,
  on,
  set,
}: {
  label: string;
  note: string;
  on: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => set(!on)}
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
        on ? "border-primary bg-primary/5" : "border-border text-muted-foreground"
      }`}
    >
      <span>
        <span className="font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{note}</span>
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-[left] ${on ? "left-4.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
