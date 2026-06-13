"use client";

import { useActionState, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";
import { WizardShell } from "@/components/wizard/wizard-shell";
import { deployScoutAgent, updateScoutAgent, type AgentActionState } from "./actions";
import { MAX_ICPS } from "./validation";

const RUN_TIMES = ["06:00", "07:00", "08:00", "09:00", "10:00", "12:00", "15:00", "18:00"];

const STEPS = ["Name", "ICPs", "Schedule", "Deploy"] as const;

export type ScoutEditValues = {
  name: string;
  icps: string[];
  runAtTime: string;
  cadence: "daily" | "weekly";
};

export function ScoutWizard({
  defaultIcp,
  existingIcps,
  edit,
}: {
  /** the ICP captured at onboarding — offered as a pre-built chip (rule 08 default) */
  defaultIcp: string | null;
  existingIcps: string[];
  /** present → edit an existing agent's config instead of deploying a new one */
  edit?: ScoutEditValues;
}) {
  const isEdit = Boolean(edit);
  const [step, setStep] = useState(0);
  const [name, setName] = useState(edit?.name ?? "");
  const [icps, setIcps] = useState<string[]>(edit?.icps ?? (defaultIcp ? [defaultIcp] : []));
  const [icpInput, setIcpInput] = useState("");
  const [runAtTime, setRunAtTime] = useState(edit?.runAtTime ?? "08:00");
  const [cadence, setCadence] = useState<"daily" | "weekly">(edit?.cadence ?? "daily");
  // resolved on the client; SSR sees the server zone, so the two nodes rendering it suppress hydration diffs
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC");
  const [state, action, pending] = useActionState<AgentActionState, FormData>(
    isEdit ? updateScoutAgent : deployScoutAgent,
    {}
  );

  const suggestions = useMemo(() => {
    const pool = [...new Set([...(defaultIcp ? [defaultIcp] : []), ...existingIcps])];
    const q = icpInput.trim().toLowerCase();
    return pool
      .filter((p) => !icps.includes(p))
      .filter((p) => (q ? p.toLowerCase().includes(q) : true))
      .slice(0, 5);
  }, [defaultIcp, existingIcps, icpInput, icps]);

  const addIcp = (value: string) => {
    const v = value.trim();
    if (!v || icps.includes(v) || icps.length >= MAX_ICPS) return;
    setIcps([...icps, v]);
    setIcpInput("");
  };

  const canNext =
    (step === 0 && name.trim().length > 0) ||
    (step === 1 && icps.length > 0) ||
    step >= 2;

  return (
    <WizardShell
      stepLabels={[...STEPS]}
      step={step}
      endowed={1}
      endowedNote={defaultIcp ? "Your onboarding ICP is already loaded ✓" : "Account ready ✓"}
      title={
        [
          "Name your agent",
          "Who should it hunt for?",
          "When should it run?",
          isEdit
            ? `Save changes to ${name.trim() || "your agent"}`
            : `Deploy ${name.trim() || "your agent"}`,
        ][step]!
      }
      hint={
        [
          "This is your prospecting teammate — give it a name you'll recognize.",
          `Type your own or pick a suggestion. Up to ${MAX_ICPS}.`,
          "It sources, scores, and enriches leads on this schedule.",
          isEdit ? "Review your changes, then save the new config." : "Review everything, then put it to work.",
        ][step]
      }
    >
      <form action={action} className="flex flex-col gap-5">
        {/* collected values ride along as hidden fields; each step shows one focused control */}
        <input type="hidden" name="name" value={name} />
        <input type="hidden" name="icps" value={JSON.stringify(icps)} />
        <input type="hidden" name="runAtTime" value={runAtTime} />
        <input type="hidden" name="cadence" value={cadence} />
        <input type="hidden" name="timezone" value={timezone} suppressHydrationWarning />

        {step === 0 && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="agent-name">Agent name</Label>
            <Input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Scout, Hunter, Ada"
              maxLength={60}
              autoFocus
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            {icps.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {icps.map((icp) => (
                  <Badge key={icp} variant="secondary" className="gap-1 py-1 pl-3 pr-1 text-sm">
                    {icp}
                    <button
                      type="button"
                      aria-label={`Remove ${icp}`}
                      onClick={() => setIcps(icps.filter((i) => i !== icp))}
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="icp-input">
                Ideal customer profile{icps.length > 0 ? ` (${icps.length}/${MAX_ICPS})` : ""}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="icp-input"
                  value={icpInput}
                  onChange={(e) => setIcpInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addIcp(icpInput);
                    }
                  }}
                  placeholder="e.g. Heads of RevOps at Series A SaaS"
                  disabled={icps.length >= MAX_ICPS}
                  autoFocus
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => addIcp(icpInput)}
                  disabled={!icpInput.trim() || icps.length >= MAX_ICPS}
                >
                  Add
                </Button>
              </div>
              {suggestions.length > 0 && icps.length < MAX_ICPS && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addIcp(s)}
                      className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              )}
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
            <dt className="text-muted-foreground">Targets</dt>
            <dd>{icps.join(" · ")}</dd>
            <dt className="text-muted-foreground">Schedule</dt>
            <dd>
              Every {cadence === "daily" ? "day" : "week"} at {runAtTime} ({timezone})
            </dd>
            <dt className="text-muted-foreground">{isEdit ? "Takes effect" : "First run"}</dt>
            <dd>{isEdit ? "on the next scheduled run" : "within 15 minutes of deploy"}</dd>
          </dl>
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
