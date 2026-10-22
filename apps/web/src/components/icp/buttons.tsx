"use client";

import { useFormStatus } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { CtaArrow, SubmitButton } from "@/app/onboarding/onboarding-ui";

export function Submit({ mode, disabled }: { mode: "onboarding" | "settings"; disabled: boolean }) {
  const { pending } = useFormStatus();
  const idle =
    mode === "onboarding" ? (
      <>
        These are my buyers
        <CtaArrow />
      </>
    ) : (
      "Save targeting"
    );
  return (
    <SubmitButton
      pending={pending || disabled}
      idle={idle}
      // disabled-but-not-submitting (a redraft in flight) keeps the idle label
      busy={
        pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {mode === "onboarding" ? "Setting up your agents…" : "Saving…"}
          </>
        ) : (
          idle
        )
      }
    />
  );
}

/** Disabled while the form submits or a redraft is in flight — one write at a time. */
export function RegenerateButton({ onRegenerate, regenerating }: { onRegenerate: () => void; regenerating: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="button"
      onClick={onRegenerate}
      disabled={regenerating || pending}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg text-[0.85rem] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground disabled:opacity-60"
    >
      {regenerating ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          Rewriting your buyer profile…
        </>
      ) : (
        <>
          <RefreshCw className="size-4" />
          Redraft from my website
        </>
      )}
    </button>
  );
}
