import { cn } from "@/lib/utils";

/**
 * Shared auth form bits — the brand system (blue + white): a roomy blue-focus field and
 * a brand-blue submit, sized for the white card that sits on the blue left column.
 */

/** Marketing-grade headline + subheadline block for the card-less auth left column. */
export function AuthHeading({ title, sub }: { title: React.ReactNode; sub: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-[26px] font-bold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[28px]">
        {title}
      </h1>
      <p className="mt-3 max-w-[38ch] text-[14.5px] leading-relaxed text-[var(--ink-3)]">{sub}</p>
    </div>
  );
}

/** Brand LinkedIn mark (official blue), sized to flow inline inside a heading. */
export function LinkedInMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#0A66C2"
        d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"
      />
    </svg>
  );
}

/** Roomy, crisp white input — clean white fill, a defined hairline border, cyan focus. */
export const FIELD =
  "h-11 rounded-[12px] border border-[rgba(12,16,26,0.12)] bg-white px-4 text-[15px] text-foreground " +
  "placeholder:text-[var(--ink-4)] transition-colors " +
  "focus-visible:border-[var(--fb)] focus-visible:ring-2 focus-visible:ring-[rgba(24,119,242,0.18)]";

/** Brand-blue submit with a pending state — the hero's button, verbatim. */
export function SubmitButton({
  pending,
  idle,
  busy,
  className,
}: {
  pending: boolean;
  idle: React.ReactNode;
  busy: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "group inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--fb-strong)] px-6 py-3.5 text-[15px] font-semibold text-white",
        "transition-all hover:bg-[#1461d1] hover:shadow-[0_10px_28px_-10px_rgba(24,119,242,0.6)] active:scale-[0.99] disabled:opacity-60",
        className,
      )}
    >
      {pending ? busy : idle}
    </button>
  );
}

/** Trailing arrow for CTA labels — nudges on hover (pairs with SubmitButton's `group`). */
export function CtaArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-[18px] transition-transform group-hover:translate-x-0.5" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
