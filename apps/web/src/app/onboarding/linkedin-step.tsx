"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Gauge, Loader2, Lock, Power, RefreshCw, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormError } from "@/components/form-error";
import { PRIMARY_BUTTON } from "@/components/landing/frame";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { CEILING_FACT, CUSTODY_SENTENCE } from "@/components/landing/claims";
import { createOnboardingConnectLink } from "./actions";

/** The promise block — the fear precedes the click, so the answers precede the button. */
const PROMISES = [
  { icon: Lock, text: CUSTODY_SENTENCE },
  { icon: Power, text: "Connecting sends nothing. Your agents start only once your trial begins." },
  { icon: Gauge, text: `Sends stay inside a hard weekly ceiling (${CEILING_FACT}), at a human pace.` },
  { icon: TrendingUp, text: "New or quiet accounts ramp up gradually to stay well inside LinkedIn's limits." },
];

/**
 * Step 2 · LinkedIn — the highest-anxiety step, so the answers sit in one bordered list
 * above the button. The hosted connect window returns to /onboarding?connected=1, where
 * the page reconciles and advances; `failed` re-renders this step with an honest,
 * non-alarming message.
 */
export function LinkedInStep({
  failed,
  unconfirmed = false,
  devReason = null,
}: {
  failed: boolean;
  /** Came back from a completed hosted-auth flow, but no connected account was recorded. */
  unconfirmed?: boolean;
  /** Diagnostic shown in development only — never production copy. */
  devReason?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(
    failed ? "That didn't finish — nothing was changed on your LinkedIn account. Try again when you're ready." : null
  );
  const [pending, startTransition] = useTransition();
  const [rechecking, startRecheck] = useTransition();

  const connect = () =>
    startTransition(async () => {
      setError(null);
      const res = await createOnboardingConnectLink();
      if (res.url) {
        window.location.href = res.url;
      } else {
        setError(res.error ?? "Could not open the LinkedIn connection right now. Try again shortly.");
      }
    });

  return (
    <div className="flex flex-col">
      {unconfirmed && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={2.4} />
            <div className="min-w-0">
              <p className="text-[13.5px] font-semibold text-amber-900">
                You finished on LinkedIn, but we couldn&rsquo;t confirm the connection yet.
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-amber-900/80">
                Nothing was changed on your account. This usually clears in a few seconds — check again, or
                reconnect if it doesn&rsquo;t.
              </p>
              {devReason && (
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-amber-900/70">dev: {devReason}</p>
              )}
              <button
                type="button"
                onClick={() => startRecheck(() => router.refresh())}
                disabled={rechecking}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-amber-500 px-4 text-[13px] font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-70"
              >
                <RefreshCw className={rechecking ? "size-3.5 animate-spin" : "size-3.5"} />
                {rechecking ? "Checking…" : "Check again"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ul className="divide-y divide-[var(--hairline)] overflow-hidden rounded-xl border border-[rgba(12,16,26,0.09)] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {PROMISES.map((p) => (
          <li key={p.text} className="flex items-start gap-3 px-4 py-3.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--cyan-tint)] text-[var(--fb-strong)]">
              <p.icon className="size-3.5" strokeWidth={2.2} />
            </span>
            <p className="pt-1 text-[0.88rem] leading-relaxed text-[var(--ink-2)]">{p.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        <FormError message={error ?? undefined} />
      </div>

      <button
        type="button"
        onClick={connect}
        disabled={pending}
        className={cn("mt-2 w-full disabled:opacity-60 disabled:active:scale-100", PRIMARY_BUTTON)}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LinkedinMark className="size-4" />}
        {pending ? "Opening the secure connect window…" : unconfirmed ? "Reconnect LinkedIn" : "Connect LinkedIn"}
      </button>

      <p className="mt-3.5 text-center text-[0.8rem] leading-relaxed text-[var(--ink-3)]">
        This is the account your agents will send from.
      </p>
    </div>
  );
}
