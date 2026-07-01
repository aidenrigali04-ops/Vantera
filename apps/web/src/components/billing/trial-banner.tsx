import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Persistent, app-wide trial/lapse strip — the soft-lock layer. The dashboard stays
 * viewable; this keeps the clock visible during the trial and turns into a clear
 * "paused — choose a plan" state once it lapses (agent/outreach actions are already
 * gated server-side by the entitlement check). Real data only: fed the account's
 * subscription_status + trial_ends_at from the app layout.
 */
export type TrialBannerProps = {
  tone: "info" | "urgent" | "ended";
  message: string;
  cta: string;
  href: string;
};

export function TrialBanner({ tone, message, cta, href }: TrialBannerProps) {
  const ended = tone === "ended";
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-sm shadow-[var(--shadow-card)]",
        ended
          ? "border-transparent bg-foreground text-background"
          : tone === "urgent"
            ? "border-[var(--cyan-line)] bg-[var(--cyan-tint)] text-foreground"
            : "border-[var(--hairline)] bg-white text-foreground",
      )}
    >
      <p className="font-medium">{message}</p>
      <Link
        href={href}
        className={cn(
          "inline-flex shrink-0 items-center rounded-full px-4 py-2 text-xs font-medium transition-all",
          ended
            ? "bg-[var(--cyan)] text-white hover:shadow-[0_8px_24px_-8px_rgba(11, 87, 171,0.7)]"
            : "bg-[#0a0c12] text-white hover:shadow-[0_8px_24px_-8px_rgba(11, 87, 171,0.55)]",
        )}
      >
        {cta}
      </Link>
    </div>
  );
}
