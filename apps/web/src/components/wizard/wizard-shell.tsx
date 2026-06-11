"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shared multi-step wizard chrome: endowed-progress segments + step heading.
 * Parents own the form, fields, and navigation; this keeps every wizard's
 * progress language identical across the app (first used in onboarding).
 */
export function WizardShell({
  stepLabels,
  step,
  endowed = 0,
  endowedNote,
  title,
  hint,
  children,
}: {
  stepLabels: string[];
  step: number;
  /** segments already "done" before the user starts (endowed progress) */
  endowed?: number;
  endowedNote?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const total = endowed + stepLabels.length;
  const done = endowed + step;
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <div className="mb-2 flex gap-1.5" aria-label={`Step ${done + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-primary" : i === done ? "bg-primary/40" : "bg-muted"}`}
            />
          ))}
        </div>
        {endowedNote ? <p className="text-xs text-muted-foreground">{endowedNote}</p> : null}
        <CardTitle className="text-xl">{title}</CardTitle>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
