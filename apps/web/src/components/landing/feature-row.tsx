import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Band, GhostLink, IconTile, TONES, type Icon } from "./frame";
import { Reveal, RevealItem } from "./surface";

/**
 * One feature, after rankbox.xyz's feature rows (themselves after Rankaria's): a band
 * split in two, the copy on the left (tinted icon tile, title, a line of body,
 * "Learn more") and the product on a pastel panel on the right, inset a few pixels
 * from the band's lines and the rail. The panel's tint and the icon tile's match, so a
 * long list of rows still reads as distinct tools. Hovering the row lifts the card.
 */
export function FeatureRow({
  id,
  title,
  body,
  href,
  icon,
  tone,
  screen,
}: {
  id: string;
  title: string;
  body: string;
  /** Where "Learn more" goes. */
  href: string;
  icon: Icon;
  tone: keyof typeof TONES;
  /** The product card the panel holds (a ScreenCard). */
  screen: ReactNode;
}) {
  return (
    <Band id={id}>
      <div className="group grid lg:grid-cols-[0.85fr_1fr]">
        <Reveal className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:py-12 lg:pl-14 lg:pr-10">
          <RevealItem>
            <IconTile icon={icon} tone={tone} />
            <h3 className="mt-5 text-[1.6rem] font-medium leading-tight tracking-[-0.025em] text-foreground sm:text-[1.85rem]">
              {title}
            </h3>
            <p className="mt-3 max-w-sm text-[0.95rem] leading-relaxed text-[var(--ink-3)]">{body}</p>
            <div className="mt-6">
              <GhostLink href={href}>Learn more</GhostLink>
            </div>
          </RevealItem>
        </Reveal>
        {/* Flush to the right rail, with a hairline of white around it. */}
        <div className="px-3 pb-3 lg:py-3 lg:pl-0 lg:pr-3">
          <div
            aria-hidden
            className={cn("relative h-[17rem] overflow-hidden sm:h-[18.5rem]", TONES[tone].panel)}
          >
            {screen}
          </div>
        </div>
      </div>
    </Band>
  );
}

/**
 * The white product card inside a tinted panel. It runs past the panel's foot and is
 * cropped there, the way Rankaria shows its screens. Sample data, decorative: the
 * panel around it is aria-hidden.
 */
export function ScreenCard({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-x-5 top-8 mx-auto max-w-[27rem] rounded-xl border border-[var(--hairline)] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.05),0_24px_48px_-24px_rgba(16,24,40,0.25)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1.5 sm:inset-x-10 sm:top-10 sm:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <p className="text-[0.8rem] font-semibold text-foreground">{title}</p>
        {meta}
      </div>
      {children}
    </div>
  );
}

/** One bordered line in a ScreenCard: a label on the left, its value on the right. */
export function ScreenRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--hairline)] bg-white px-3 py-2 text-xs">
      <span className="truncate font-medium text-foreground">{label}</span>
      <span className="shrink-0 tabular-nums text-[var(--ink-3)]">{value}</span>
    </div>
  );
}

/** The soft blue strip under a ScreenCard's rows. */
export function ScreenNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-[rgba(24,119,242,0.25)] bg-[var(--cyan-tint)] px-3 py-2 text-[0.72rem] text-foreground">
      {children}
    </div>
  );
}

/** A ScreenCard's header meta: a small status with a live dot, rankbox's "Running". */
export function LiveMeta({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[0.68rem] font-medium text-[var(--fb)]">
      <span className="size-1.5 animate-pulse rounded-full bg-[var(--fb)] motion-reduce:animate-none" />
      {children}
    </span>
  );
}
