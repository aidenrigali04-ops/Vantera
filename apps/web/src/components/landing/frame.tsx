import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The landing page's frame, after rankbox.xyz (itself after Rankaria): hairline rails
 * down both sides of the 72rem column, a full-width hairline over every band, and
 * blank spacer bands between sections. The nav opens the frame and the footer closes
 * it.
 *
 * Every homepage section is built from these, so the rails line up from the nav to
 * the footer and the hairlines never double up: a band draws only its top line, and
 * only the closing band draws a bottom one.
 */

/** The hairline colour, for borders drawn outside these components. */
export const LINE = "border-[var(--hairline)]";

export type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

export function Band({
  children,
  id,
  className,
  inner,
  closing = false,
}: {
  children?: ReactNode;
  id?: string;
  /** On the full-width band, outside the rails. */
  className?: string;
  /** On the railed column itself. */
  inner?: string;
  /** Draw the bottom hairline too: the last band before the footer. */
  closing?: boolean;
}) {
  return (
    // scroll-mt: an anchored band lands below the sticky 4rem nav, not under it.
    <div id={id} className={cn("border-t", closing && "border-b", id && "scroll-mt-16", LINE, className)}>
      <div className={cn("relative mx-auto max-w-6xl border-x", LINE, inner)}>{children}</div>
    </div>
  );
}

/** An empty band: the pause between two sections. */
export function Spacer() {
  return <Band inner="h-12 sm:h-16" />;
}

/** The blue, bold phrase that closes a section title. */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="font-bold text-[var(--fb)]">{children}</span>;
}

/** A small white label with an icon, above a section title. */
export function Pill({ icon: Icon, children }: { icon: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[rgba(12,16,26,0.08)] bg-white py-1 pl-1 pr-2.5 text-[0.8rem] font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span className="grid size-5 place-items-center rounded-md bg-[var(--cyan-tint)] text-[var(--fb)]">
        <Icon className="size-3" strokeWidth={2.2} />
      </span>
      {children}
    </span>
  );
}

/** The section title's type, shared with the FAQ's left-aligned heading. */
export const TITLE =
  "text-balance text-[1.9rem] font-medium leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[2.4rem]";

/** The section subtitle's type. */
export const SUBTITLE =
  "text-balance text-[0.98rem] leading-relaxed text-[var(--ink-3)] sm:text-[1.05rem]";

/**
 * A section's opening band: pill, title, subtitle, centred. Rankaria gives every
 * section header a band of its own, ruled off from the content below. Without an
 * eyebrow, the icon stands alone as a larger white tile.
 */
export function SectionHead({
  id,
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  id?: string;
  icon: Icon;
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Anything that sits under the subtitle, inside the header band. */
  children?: ReactNode;
}) {
  return (
    <Band id={id} inner="px-5 py-12 text-center sm:px-8 sm:py-16">
      {eyebrow ? (
        <Pill icon={Icon}>{eyebrow}</Pill>
      ) : (
        <span className="mx-auto grid size-11 place-items-center rounded-xl border border-[rgba(12,16,26,0.08)] bg-white text-[var(--fb)] shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <Icon className="size-5" strokeWidth={2} />
        </span>
      )}
      <h2 className={cn(TITLE, "mx-auto mt-5 max-w-3xl")}>{title}</h2>
      {subtitle && <p className={cn(SUBTITLE, "mx-auto mt-4 max-w-2xl")}>{subtitle}</p>}
      {children}
    </Band>
  );
}

/**
 * Hairline cells for any number of items. Each cell (give it CELL) draws its right
 * and bottom edge, and the grid overhangs by a pixel so the outer edges fall under
 * the rails and the next band's line, clipped. Unlike a `gap-px` grid, a short last
 * row stays white instead of showing a grey fill.
 */
export function CellGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden">
      <ul className={cn("-mb-px -mr-px grid", className)}>{children}</ul>
    </div>
  );
}

/** A CellGrid cell's edges. */
export const CELL = cn("border-b border-r", LINE);

/** The pastel grounds feature panels sit on, and their matching icon tiles. */
export const TONES = {
  blue: { panel: "bg-[#eaf2fe]", tile: "bg-[#dbe9fd] text-[#1461d1]" },
  green: { panel: "bg-[#e9f6ee]", tile: "bg-[#d5efdf] text-[#13824a]" },
  violet: { panel: "bg-[#f0eefd]", tile: "bg-[#e2defb] text-[#5b4bd1]" },
  amber: { panel: "bg-[#fdf5e6]", tile: "bg-[#fbe8c5] text-[#a86500]" },
  rose: { panel: "bg-[#fdeef1]", tile: "bg-[#fbdbe2] text-[#c0365a]" },
} as const;

/** A tinted square holding a feature's icon. `tone` picks the tint. */
export function IconTile({
  icon: Icon,
  tone = "blue",
  className,
}: {
  icon: Icon;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span className={cn("grid size-8 place-items-center rounded-lg", TONES[tone].tile, className)}>
      <Icon className="size-4" strokeWidth={2} />
    </span>
  );
}

/** A small hairline button, Rankaria's "Learn more". */
export function GhostLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 rounded-lg border border-[rgba(12,16,26,0.1)] bg-white px-3 py-1.5 text-[0.8rem] font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-[border-color,background-color] hover:border-[rgba(12,16,26,0.18)] hover:bg-[rgba(12,16,26,0.02)]"
    >
      {children}
      <ArrowRight
        className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
        strokeWidth={2.2}
      />
    </Link>
  );
}

/** The solid blue call to action, as a link: the hero's button, everywhere below it. */
export const PRIMARY_BUTTON =
  "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[var(--fb-strong)] px-6 text-[0.95rem] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)] transition-[background-color,transform] duration-150 hover:bg-[#1161cc] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--fb-tint)]";
