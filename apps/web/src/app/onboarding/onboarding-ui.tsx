import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIMARY_BUTTON } from "@/components/landing/frame";

/**
 * Onboarding form pieces, in the landing's new style: the hero's URL field (h-12, hairline
 * border, a 4px soft-blue ring on focus) and its solid blue button. Kept beside the steps
 * rather than borrowed from the auth pages, so either surface can move without the other.
 */

/** The text input: the hero's URL field, as a plain <input>. */
export const INPUT =
  "h-12 w-full rounded-lg border border-[rgba(12,16,26,0.1)] bg-white px-3.5 text-[0.95rem] text-foreground " +
  "shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-[border-color,box-shadow] duration-200 " +
  "placeholder:text-[var(--ink-4)] hover:border-[rgba(12,16,26,0.16)] " +
  "focus-visible:border-[var(--cyan-line)] focus-visible:shadow-[0_0_0_4px_var(--fb-tint)]";

/** A field's label, rankbox's: small, medium weight, ink. */
export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[0.85rem] font-medium text-foreground">
      {children}
    </label>
  );
}

/** The solid blue primary, full width, with a pending state. */
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
      className={cn("group w-full disabled:opacity-60 disabled:active:scale-100", PRIMARY_BUTTON, className)}
    >
      {pending ? busy : idle}
    </button>
  );
}

/** The trailing arrow on a primary label; it nudges on hover (pairs with the button's `group`). */
export function CtaArrow() {
  return (
    <ArrowRight
      aria-hidden
      className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
    />
  );
}
