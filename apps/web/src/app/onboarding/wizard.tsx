"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/form-error";

type FieldKey = "companyName" | "websiteUrl" | "industry" | "icp" | "revenueGoal";

type Field = {
  key: FieldKey;
  label: string;
  placeholder: string;
  hint: string;
  required: boolean;
};

const STEPS: { title: string; fields: Field[] }[] = [
  {
    title: "Tell us about your company",
    fields: [
      {
        key: "companyName",
        label: "Company name",
        placeholder: "e.g. Acme Inc",
        hint: "This names your workspace.",
        required: true,
      },
      {
        key: "websiteUrl",
        label: "Website URL",
        placeholder: "e.g. acme.com",
        hint: "Leave blank if you don't have one. We scan it to learn your offerings so your agent finds the right leads.",
        required: false,
      },
    ],
  },
  {
    title: "What industry are you in?",
    fields: [
      {
        key: "industry",
        label: "Industry",
        placeholder: "e.g. B2B SaaS, logistics, fintech",
        hint: "Your SDR agent tailors prospecting to your space.",
        required: true,
      },
    ],
  },
  {
    title: "Who is your target audience?",
    fields: [
      {
        key: "icp",
        label: "Target audience",
        placeholder: "e.g. VP of Operations at mid-market logistics companies",
        hint: "This becomes your default campaign targeting.",
        required: true,
      },
    ],
  },
  {
    title: "What's your monthly revenue goal?",
    fields: [
      {
        key: "revenueGoal",
        label: "Monthly revenue goal",
        placeholder: "e.g. 25,000",
        hint: "We track every campaign against this goal.",
        required: true,
      },
    ],
  },
];

const ALL_FIELDS = STEPS.flatMap((s) => s.fields);
const TOTAL_SEGMENTS = STEPS.length + 1; // 1 endowed segment (account created) + wizard steps

export function Wizard({ defaultCompanyName = "" }: { defaultCompanyName?: string }) {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<FieldKey, string>>({
    companyName: defaultCompanyName,
    websiteUrl: "",
    industry: "",
    icp: "",
    revenueGoal: "",
  });
  const [state, action, pending] = useActionState<OnboardingState, FormData>(
    completeOnboarding,
    {}
  );

  if (state.scan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Here&apos;s what we learned about {values.companyName.trim()}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">{state.scan.summary}</p>
          {state.scan.offerings.length > 0 && (
            <div>
              <p className="text-sm font-medium">What you offer</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {state.scan.offerings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {state.scan.value_props.length > 0 && (
            <div>
              <p className="text-sm font-medium">The outcomes you promise</p>
              <ul className="list-disc pl-5 text-sm text-muted-foreground">
                {state.scan.value_props.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Saved to your workspace — your Prospect Agent uses this to find leads that fit. You
            can update your website any time in Settings.
          </p>
          <Button asChild>
            <a href="/dashboard">Go to dashboard</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const segmentsDone = 1 + step;
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const remaining = STEPS.length - step;
  const currentKeys = current.fields.map((f) => f.key);
  const stepComplete = current.fields.every(
    (f) => !f.required || values[f.key].trim().length > 0
  );
  const willScan = values.websiteUrl.trim().length > 0;

  return (
    <Card>
      <CardHeader>
        <div
          className="mb-2 flex gap-1.5"
          aria-label={`Step ${segmentsDone} of ${TOTAL_SEGMENTS}`}
        >
          {Array.from({ length: TOTAL_SEGMENTS }, (_, i) => (
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
              if (stepComplete) setStep(step + 1);
            }
          }}
          className="flex flex-col gap-4"
        >
          {/* earlier answers ride along as hidden fields; visible inputs own the current step */}
          {ALL_FIELDS.filter(({ key }) => !currentKeys.includes(key)).map(({ key }) => (
            <input key={key} type="hidden" name={key} value={values[key]} />
          ))}
          {current.fields.map((field, i) => (
            <div key={field.key} className="flex flex-col gap-2">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                name={field.key}
                value={values[field.key]}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                inputMode={field.key === "revenueGoal" ? "decimal" : "text"}
                autoFocus={i === 0}
                required={field.required}
              />
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            </div>
          ))}
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
              {isLast
                ? pending
                  ? willScan
                    ? "Scanning your website…"
                    : "Finishing…"
                  : "Finish setup"
                : "Continue"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
