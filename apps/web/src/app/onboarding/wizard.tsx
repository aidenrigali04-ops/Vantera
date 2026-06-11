"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

type StepKey = "industry" | "icp" | "revenueGoal";

const STEPS: { key: StepKey; title: string; placeholder: string; hint: string }[] = [
  {
    key: "industry",
    title: "What industry are you in?",
    placeholder: "e.g. B2B SaaS, logistics, fintech",
    hint: "Your SDR agent tailors prospecting to your space.",
  },
  {
    key: "icp",
    title: "Who is your ideal customer?",
    placeholder: "e.g. VP of Operations at mid-market logistics companies",
    hint: "This becomes your default campaign targeting.",
  },
  {
    key: "revenueGoal",
    title: "What's your monthly revenue goal?",
    placeholder: "e.g. 25,000",
    hint: "We track every campaign against this goal.",
  },
];

export function Wizard() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<StepKey, string>>({
    industry: "",
    icp: "",
    revenueGoal: "",
  });
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {}
  );

  // progress: 1 endowed segment (account created) + 3 wizard steps
  const segmentsDone = 1 + step;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const remaining = STEPS.length - step;

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex gap-1.5" aria-label={`Step ${segmentsDone} of 4`}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < segmentsDone ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Account created ✓ — {remaining} step{remaining === 1 ? "" : "s"} to your dashboard
        </p>
        <CardTitle>{current.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={action}
          onSubmit={(e) => {
            if (!isLast) {
              e.preventDefault();
              if (values[current.key].trim()) setStep(step + 1);
            }
          }}
          className="flex flex-col gap-4"
        >
          {/* earlier answers ride along as hidden fields; the visible input owns the current step */}
          {STEPS.filter(({ key }) => key !== current.key).map(({ key }) => (
            <input key={key} type="hidden" name={key} value={values[key]} />
          ))}
          <div className="flex flex-col gap-2">
            <Label htmlFor={current.key}>{current.title}</Label>
            <Input
              id={current.key}
              name={current.key}
              value={values[current.key]}
              onChange={(e) => setValues({ ...values, [current.key]: e.target.value })}
              placeholder={current.placeholder}
              inputMode={current.key === "revenueGoal" ? "decimal" : "text"}
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">{current.hint}</p>
          </div>
          <FormError message={state.error} />
          <div className="flex justify-between">
            <Button
              type="button"
              variant="ghost"
              disabled={step === 0 || pending}
              onClick={() => setStep(step - 1)}
            >
              Back
            </Button>
            <Button type="submit" disabled={pending}>
              {isLast ? (pending ? "Finishing…" : "Finish setup") : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
