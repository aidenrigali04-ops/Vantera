"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Eye, Loader2, Lock, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { FormError } from "@/components/form-error";
import { LinkedinMark } from "@/components/landing/brand-glyphs";
import { createOnboardingConnectLink } from "./actions";

/** The promise block — the fear precedes the click, so the answers precede the button. */
const PROMISES = [
  { icon: Lock, text: "You sign in through LinkedIn's own flow — your password never touches Vantera." },
  { icon: Eye, text: "Connecting only looks. Nothing is sent, liked, or changed until you approve it." },
  { icon: ShieldCheck, text: "Every message waits for your approval before it goes out." },
  { icon: TrendingUp, text: "New or quiet accounts ramp up gradually to stay well inside LinkedIn's limits." },
];

/**
 * Step 2 · LinkedIn — the highest-anxiety step. The hosted connect window returns to
 * /onboarding?connected=1, where the page reconciles and advances; `failed` re-renders
 * this step with an honest, non-alarming message.
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
        <div className="mb-7 rounded-[14px] border border-amber-300 bg-amber-50 p-4">
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
                className="mt-3 inline-flex items-center gap-2 rounded-[10px] bg-amber-500 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-70"
              >
                <RefreshCw className={rechecking ? "size-3.5 animate-spin" : "size-3.5"} />
                {rechecking ? "Checking…" : "Check again"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-4">
        {PROMISES.map((p) => (
          <li key={p.text} className="flex items-start gap-3">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[8px] bg-[rgba(24,119,242,0.08)] text-[var(--fb-strong)] ring-1 ring-inset ring-[rgba(24,119,242,0.18)]">
              <p.icon className="size-3.5" strokeWidth={2.2} />
            </span>
            <p className="text-[14px] leading-relaxed text-[var(--ink-2)]">{p.text}</p>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        <FormError message={error ?? undefined} />
      </div>

      <button
        type="button"
        onClick={connect}
        disabled={pending}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--fb-strong)] px-6 py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-[#1461d1] hover:shadow-[0_10px_28px_-10px_rgba(24,119,242,0.6)] active:scale-[0.99] disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <LinkedinMark className="size-4" />}
        {pending ? "Opening the secure connect window…" : unconfirmed ? "Reconnect LinkedIn" : "Connect LinkedIn"}
      </button>

      <p className="mt-4 text-center text-[12.5px] leading-relaxed text-[var(--ink-4)]">
        This is the account your outreach will come from.
      </p>
    </div>
  );
}
