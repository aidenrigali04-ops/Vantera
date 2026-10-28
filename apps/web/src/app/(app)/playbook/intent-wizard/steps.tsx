"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RUN_TIMES = ["06:00", "07:00", "08:00", "09:00", "10:00", "12:00", "15:00", "18:00"];

/** ML-8: "Every 6 hours" catches a high-intent moment within hours; the read budget per run shrinks
 *  to match, so LinkedIn reads per day are unchanged. */
const CADENCE_LABEL = { daily: "Every day", intraday: "Every 6 hours", weekly: "Every week" } as const;

export type Cadence = "daily" | "intraday" | "weekly";
type List = { values: string[]; set: (next: string[]) => void };

export function WatchStep({
  suggesting,
  suggested,
  keywords,
  competitors,
  hashtags,
  creators,
  engagement,
  content,
  follows,
}: {
  suggesting: boolean;
  suggested: boolean;
  keywords: List;
  competitors: List;
  hashtags: List;
  creators: List;
  engagement: { on: boolean; set: (v: boolean) => void };
  content: { on: boolean; set: (v: boolean) => void };
  follows: { on: boolean; set: (v: boolean) => void };
}) {
  return (
    <div className="flex flex-col gap-5">
      {suggesting ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Finding what to watch for you…
        </div>
      ) : suggested ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
          We pre-filled what to watch from your business — edit anything, then deploy.
        </div>
      ) : null}

      <ChipList label="Keywords" placeholder="e.g. onboarding churn" values={keywords.values} onChange={keywords.set} />
      <ChipList label="Competitors (name or LinkedIn URL)" placeholder="e.g. Salesforce" values={competitors.values} onChange={competitors.set} />
      <ChipList label="Hashtags" placeholder="e.g. revops" values={hashtags.values} onChange={hashtags.set} />
      <ChipList label="Creators — optional (LinkedIn profile URLs)" placeholder="https://linkedin.com/in/…" values={creators.values} onChange={creators.set} />

      <div className="flex flex-col gap-2">
        <Label>Intent signals</Label>
        <div className="flex flex-col gap-2">
          <SignalToggle label="Engagement" note="People who like or comment on the posts you watch" on={engagement.on} set={engagement.set} />
          <SignalToggle label="Content" note="People posting about your keywords and hashtags" on={content.on} set={content.set} />
          <SignalToggle
            label="Followers"
            note="People who start following your LinkedIn profile — warm, and still held to your ICP"
            on={follows.on}
            set={follows.set}
          />
        </div>
      </div>
    </div>
  );
}

export function ScheduleStep({
  runAtTime,
  setRunAtTime,
  cadence,
  setCadence,
  timezone,
}: {
  runAtTime: string;
  setRunAtTime: (v: string) => void;
  cadence: Cadence;
  setCadence: (v: Cadence) => void;
  timezone: string;
}) {
  // an edited agent may carry a run time outside the preset list — keep it selectable
  const times = RUN_TIMES.includes(runAtTime) ? RUN_TIMES : [...RUN_TIMES, runAtTime].sort();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="run-time">Run time</Label>
        <select
          id="run-time"
          value={runAtTime}
          onChange={(e) => setRunAtTime(e.target.value)}
          className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {times.map((t) => (
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
          {(["daily", "intraday", "weekly"] as const).map((c) => (
            <Button
              key={c}
              type="button"
              role="radio"
              aria-checked={cadence === c}
              variant={cadence === c ? "default" : "outline"}
              onClick={() => setCadence(c)}
            >
              {CADENCE_LABEL[c]}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReviewStep({
  name,
  watchCount,
  signalLabels,
  scoutName,
  cadence,
  runAtTime,
  timezone,
  editing,
  paused,
}: {
  name: string;
  watchCount: number;
  signalLabels: string[];
  scoutName: string;
  cadence: Cadence;
  runAtTime: string;
  timezone: string;
  editing: boolean;
  paused: boolean;
}) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Agent</dt>
      <dd className="font-medium">{name}</dd>
      <dt className="text-muted-foreground">Watching</dt>
      <dd>{watchCount} target{watchCount === 1 ? "" : "s"} · {signalLabels.join(" + ")}</dd>
      <dt className="text-muted-foreground">Qualifies against</dt>
      <dd>{scoutName}&apos;s ICP</dd>
      <dt className="text-muted-foreground">Schedule</dt>
      <dd>Every {cadence === "daily" ? "day" : cadence === "intraday" ? "6 hours" : "week"} at {runAtTime} ({timezone})</dd>
      <dt className="text-muted-foreground">{editing ? "Next run" : "First run"}</dt>
      <dd>
        {editing && paused
          ? "Runs resume when you unpause the agent."
          : `within 15 minutes of ${editing ? "saving" : "deploy"}`}
      </dd>
    </dl>
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
