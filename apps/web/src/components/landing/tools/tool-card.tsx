import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Tool } from "@/lib/tools/registry";
import { CARD, CARD_INTERACTIVE } from "@/components/landing/surface";
import { cn } from "@/lib/utils";

/**
 * Hub / related-tools card. Live tools link to their page; "coming soon" tools render
 * as a muted, non-interactive card with a badge (mirrors the USE_CASES live/soon pattern).
 */
export function ToolCard({ tool }: { tool: Tool }) {
  const Icon = tool.icon;

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="grid size-11 place-items-center rounded-xl bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
          <Icon className="size-5" />
        </span>
        {tool.live ? (
          <ArrowRight className="size-4 text-[var(--ink-4)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--cyan-strong)]" />
        ) : (
          <span className="rounded-full bg-[var(--tint)] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-4)]">
            Soon
          </span>
        )}
      </div>
      <h3 className="mt-5 text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">{tool.name}</h3>
      <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--ink-3)]">{tool.tagline}</p>
    </>
  );

  if (!tool.live) {
    return <div className={cn(CARD, "flex flex-col p-6 opacity-70")}>{inner}</div>;
  }

  return (
    <Link href={`/tools/${tool.slug}`} className={cn(CARD_INTERACTIVE, "group flex flex-col p-6")}>
      {inner}
    </Link>
  );
}
