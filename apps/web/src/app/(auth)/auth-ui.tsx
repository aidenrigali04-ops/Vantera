import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared auth form pieces, after rankbox.xyz's sign-up column: a two-line headline whose
 * second line is the bold blue accent, roomy hairline fields with a soft blue focus halo
 * (the landing hero's URL field), and the landing's solid blue submit. Onboarding's
 * details form reuses FIELD, SubmitButton and CtaArrow, so their shapes stay stable.
 */

/** Rises in on first paint (`landing-rise` in globals.css), staggered by `delay` (s). CSS,
    not framer, so the column paints on the server and never waits on hydration. */
export function Rise({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("landing-rise", className)}
      style={{ "--rise-delay": `${delay}s` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * The column's headline: `title` on the first line, the optional `accent` on its own
 * line in bold brand blue, then the muted subtitle. The {" "} keeps the accessible name
 * word-separated across the two visual lines.
 */
export function AuthHeading({
  title,
  accent,
  sub,
}: {
  title: ReactNode;
  accent?: ReactNode;
  sub: ReactNode;
}) {
  return (
    <div>
      <Rise>
        <h1 className="text-balance text-[1.85rem] font-medium leading-[1.1] tracking-[-0.035em] text-foreground min-[400px]:text-[2rem] sm:text-[2.4rem]">
          <span className="block">{title}</span>
          {accent && (
            <>
              {" "}
              <span className="block font-bold text-[var(--fb)]">{accent}</span>
            </>
          )}
        </h1>
      </Rise>
      <Rise delay={0.06}>
        <p className="mt-4 text-[1.02rem] leading-relaxed text-[var(--ink-3)]">{sub}</p>
      </Rise>
    </div>
  );
}

/** Brand LinkedIn mark (official blue), sized to flow inline. */
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

/** One field's stack: label, input, hint, 6px apart. */
export const FIELD_STACK = "space-y-1.5";

/** A field's label: above the input, never inside it. */
export const LABEL = "block text-[0.85rem] font-medium leading-none text-foreground";

/** A field's helper line under the input. */
export const HINT = "text-[0.78rem] leading-snug text-[var(--ink-3)]";

/** Inline text links in the column: the CTA blue, underlined on hover. */
export const TEXT_LINK =
  "font-semibold text-[var(--fb-strong)] underline-offset-2 transition-colors hover:text-[#1161cc] hover:underline";

/** Roomy white input with a hairline border and the hero field's soft blue focus halo.
    Layered over the shadcn Input's base classes (tailwind-merge keeps these). */
export const FIELD =
  "h-12 rounded-lg border border-[rgba(12,16,26,0.1)] bg-white px-3.5 text-[0.95rem] text-foreground md:text-[0.95rem] " +
  "shadow-[0_1px_2px_rgba(16,24,40,0.04)] placeholder:text-[var(--ink-4)] " +
  "transition-[border-color,box-shadow] duration-200 hover:border-[rgba(12,16,26,0.16)] " +
  "focus-visible:border-[var(--cyan-line)] focus-visible:ring-4 focus-visible:ring-[var(--fb-tint)]";

/** The landing's solid blue submit, full width, with a pending state. */
export function SubmitButton({
  pending,
  idle,
  busy,
  className,
}: {
  pending: boolean;
  idle: ReactNode;
  busy: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "group inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--fb-strong)] px-6 text-[0.95rem] font-semibold text-white",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)]",
        "transition-[background-color,transform] duration-150 hover:bg-[#1161cc] active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--fb-tint)] disabled:opacity-70",
        className,
      )}
    >
      {pending ? busy : idle}
    </button>
  );
}

/** Official four-color G — required by Google's sign-in branding. */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

/** Outlined social continue — primary path on login/signup; email+password stays as the fallback. */
export function GoogleContinueButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2.5 rounded-[12px] border border-[rgba(12,16,26,0.12)] bg-white px-6 py-3.5 text-[15px] font-semibold text-foreground",
        "transition-colors hover:bg-[var(--tint)] active:scale-[0.99] disabled:opacity-60",
      )}
    >
      <GoogleMark className="size-5" />
      {pending ? "Continuing…" : "Continue with Google"}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label="or">
      <span className="h-px flex-1 bg-[rgba(12,16,26,0.12)]" />
      <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-4)]">or</span>
      <span className="h-px flex-1 bg-[rgba(12,16,26,0.12)]" />
    </div>
  );
}

/** Trailing arrow for CTA labels — nudges on hover (pairs with SubmitButton's `group`). */
export function CtaArrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
      aria-hidden
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
