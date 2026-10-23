import { cn } from "@/lib/utils";
import { INPUT } from "@/app/onboarding/onboarding-ui";

export const GROUP_HEADER = "text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--ink-4)]";
export const CHIP =
  "inline-flex h-8 items-center gap-1.5 rounded-full border border-[rgba(12,16,26,0.1)] bg-white px-3 text-[0.85rem] text-foreground";
export const TEXTAREA = cn(INPUT, "h-auto min-h-20 py-2.5 leading-relaxed");
export const HINT = "mt-2 text-[0.8rem] leading-relaxed text-[var(--ink-3)]";
