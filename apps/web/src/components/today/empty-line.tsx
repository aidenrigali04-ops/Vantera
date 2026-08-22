import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The empty state of a Today zone (blueprint §6.13): one calm 14px line — no box, no
 * illustration. Children may carry one `TextLink`.
 */
export function EmptyLine({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-sm leading-5 text-[var(--ink-mid)]", className)}>{children}</p>;
}
