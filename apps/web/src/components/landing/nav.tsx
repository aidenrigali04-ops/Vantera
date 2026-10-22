"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "./vantera-logo";
import { ClaudeMark, HubSpotMark, SalesforceMark, SlackMark } from "./brand-glyphs";
import { FLAT_LINKS, MENUS, type Menu, type MenuItem } from "./nav-menus";

/**
 * Landing nav, after rankbox.xyz: a white bar with the mark and wordmark on the left,
 * three menus and two flat links centred, and the hairline Sign in beside the solid
 * Get started on the right.
 *
 * Each menu opens one white panel centred under the bar, two-tone like rankbox's: the
 * link columns sit on white (grey icon tiles that turn soft blue on hover), the right
 * rail and the footer strip sit on a soft grey, so the eye lands on the product first
 * and the extras second. One menu is open at a time (shared state, not per-item CSS
 * hover) so the pointer can travel across triggers without the panel flickering shut;
 * a short close delay bridges the gap between trigger and panel. A faint wash lifts
 * the panel off the page without blurring it.
 *
 * `framed` (homepage) pins the bar in the page flow as the top of the page frame, its
 * hairline rails continuing down into the hero's. Every other marketing page omits the
 * prop and gets the floating bar that turns solid once the page scrolls.
 */

/** How long the panel survives after the pointer leaves, so the gap is crossable. */
const CLOSE_DELAY_MS = 120;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(24,119,242,0.4)]";

/** The rail and footer tone: the page's soft grey, half-mixed with white. */
const MENU_RAIL = "bg-[color-mix(in_oklab,var(--tint)_70%,white)]";

const TOP_ITEM = cn(
  "flex h-9 items-center gap-1 whitespace-nowrap rounded-md px-3.5 text-sm font-medium text-foreground/65 transition-colors hover:text-foreground",
  FOCUS_RING,
);

/** Renders <a> for hash links (same-page jumps), <Link> for real routes. */
function NavLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  if (href.includes("#")) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function ColumnLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between px-2.5">
      <p className="text-[0.75rem] font-medium text-[var(--ink-3)]">{children}</p>
      {action}
    </div>
  );
}

/** The primary row: grey icon tile, name, one line of what it does. The tile turns
    soft blue on hover, and an arrow slides in beside the name. */
function MenuRow({ item, onNavigate }: { item: MenuItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-start gap-3 rounded-md px-2.5 py-2.5 transition-colors hover:bg-[rgba(12,16,26,0.03)]",
        FOCUS_RING,
      )}
    >
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-[rgba(12,16,26,0.045)] text-foreground/75 transition-colors group-hover:bg-[var(--cyan-tint)] group-hover:text-[var(--fb-strong)]">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-[0.9rem] font-medium leading-tight text-foreground">
          {item.title}
          <ArrowRight
            aria-hidden
            className="size-3.5 -translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none"
          />
        </span>
        <span className="mt-1 block text-pretty text-[0.78rem] leading-snug text-[var(--ink-3)]">
          {item.desc}
        </span>
      </span>
    </NavLink>
  );
}

/** A blue "see all" link with a sliding arrow. */
function MoreLink({
  href,
  onNavigate,
  className,
  children,
}: {
  href: string;
  onNavigate: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <NavLink
      href={href}
      onClick={onNavigate}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-[var(--fb-strong)] transition-colors hover:bg-[var(--cyan-tint)]",
        FOCUS_RING,
        className,
      )}
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </NavLink>
  );
}

const MARKS = [
  { name: "HubSpot", Mark: HubSpotMark, color: "#ff5c35" },
  { name: "Salesforce", Mark: SalesforceMark, color: "#00a1e0" },
  { name: "Slack", Mark: SlackMark, color: "#4a154b" },
  { name: "Claude", Mark: ClaudeMark, color: "#d97757" },
];

function MegaPanel({ menu, onNavigate }: { menu: Menu; onNavigate: () => void }) {
  const { feature, footer } = menu;
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_18rem]">
        <div className="grid grid-cols-2 gap-x-2 p-3">
          {menu.columns.map((col) => (
            <div key={col.eyebrow}>
              <ColumnLabel>{col.eyebrow}</ColumnLabel>
              {col.items.map((item) => (
                <MenuRow key={item.title} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          ))}
        </div>

        {/* The rail: the menu's spotlight, then a sample card with the way in. */}
        <div className={cn("flex flex-col gap-0.5 border-l border-[var(--hairline)] p-3", MENU_RAIL)}>
          <ColumnLabel
            action={
              <NavLink
                href={feature.cta.href}
                onClick={onNavigate}
                className={cn(
                  "group -mr-1 inline-flex items-center gap-1 rounded-md px-1 text-xs font-medium text-[var(--fb-strong)] transition-colors hover:text-[#1161cc]",
                  FOCUS_RING,
                )}
              >
                {feature.cta.label}
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </NavLink>
            }
          >
            {feature.title}
          </ColumnLabel>
          <p className="px-2.5 pb-3 text-pretty text-[0.78rem] leading-snug text-[var(--ink-3)]">
            {feature.blurb}
          </p>

          <div className="mt-auto rounded-lg border border-[rgba(12,16,26,0.08)] bg-white p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.875rem] font-medium text-foreground">{feature.readout.label}</p>
              <span className="shrink-0 rounded-md border border-[rgba(12,16,26,0.08)] px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-[0.1em] text-[var(--ink-3)]">
                Sample
              </span>
            </div>
            <div className="mt-2.5 flex flex-col gap-1.5">
              {feature.readout.rows.map((r) => (
                <div key={r.k} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[var(--ink-3)]">{r.k}</span>
                  <span className="shrink-0 font-semibold text-foreground">{r.v}</span>
                </div>
              ))}
            </div>
            <p className="mt-2.5 border-t border-[var(--hairline)] pt-2 text-[0.7rem] leading-snug text-[var(--ink-3)]">
              {feature.readout.note}
            </p>
            <Link
              href="/signup"
              onClick={onNavigate}
              className={cn(
                "group mt-3 flex items-center justify-center gap-1.5 rounded-md bg-[var(--fb-strong)] px-3 py-2 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)] transition-colors hover:bg-[#1161cc]",
                FOCUS_RING,
              )}
            >
              Start free
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </div>
        </div>
      </div>

      {/* The footer strip: a lead link on the left, "see all" on the right. */}
      <div
        className={cn(
          "flex items-center justify-between gap-4 border-t border-[var(--hairline)] px-3 py-2.5",
          MENU_RAIL,
        )}
      >
        <NavLink
          href={footer.lead.href}
          onClick={onNavigate}
          className={cn(
            "group flex min-w-0 items-center gap-3 rounded-md px-2.5 py-1.5 transition-colors hover:bg-white",
            FOCUS_RING,
          )}
        >
          {footer.lead.marks && (
            <span aria-hidden className="flex shrink-0 gap-1">
              {MARKS.map(({ name, Mark, color }) => (
                <span
                  key={name}
                  className="grid size-5 place-items-center rounded-[5px] bg-white ring-1 ring-inset ring-[rgba(12,16,26,0.08)] transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                  style={{ color }}
                >
                  <Mark className="size-3" />
                </span>
              ))}
            </span>
          )}
          <span className="shrink-0 text-[0.875rem] font-medium text-foreground">
            {footer.lead.label}
          </span>
          <span className="hidden truncate text-xs text-[var(--ink-3)] lg:inline">
            {footer.lead.text}
          </span>
        </NavLink>
        <MoreLink href={footer.more.href} onNavigate={onNavigate} className="shrink-0">
          {footer.more.label}
        </MoreLink>
      </div>
    </>
  );
}

export function LandingNav({ framed = false }: { framed?: boolean } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navRef = useRef<HTMLElement>(null);
  /** How the last press came in: a mouse press lands on a menu hover already opened. */
  const lastPointer = useRef<string>("mouse");

  const cancelClose = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(null), CLOSE_DELAY_MS);
  }, [cancelClose]);

  const closeNow = useCallback(() => {
    cancelClose();
    setOpen(null);
  }, [cancelClose]);

  useEffect(() => cancelClose, [cancelClose]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Escape closes the panel, and so does a tap or click anywhere outside the bar
  // (the wash behind the panel never takes the pointer, so touch needs this).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNow();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) closeNow();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, closeNow]);

  // The framed bar is always solid: it is the top of the page frame. The floating
  // bar turns solid once the page scrolls, or while a panel is open (a white panel
  // hanging off transparent chrome reads as detached).
  const solid = framed || scrolled || open !== null;
  const activeMenu = MENUS.find((m) => m.key === open) ?? null;

  return (
    <header className={cn("inset-x-0 top-0 z-40", framed ? "sticky" : "fixed")}>
      {/* A faint wash over the page while a panel is open, lifting the panel off
          whatever it opens over without blurring it. Purely visual. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none fixed inset-x-0 bottom-0 top-16 hidden bg-[rgba(12,16,26,0.04)] transition-opacity duration-300 md:block",
          open ? "opacity-100" : "opacity-0",
        )}
      />
      <nav
        ref={navRef}
        aria-label="Main"
        className={cn(
          "relative border-b transition-colors duration-300",
          solid ? "border-[var(--hairline)] bg-white" : "border-transparent bg-transparent",
        )}
        onPointerLeave={scheduleClose}
      >
        {/* Framed: the bar's rails run on into the hero's. */}
        <div
          className={cn(
            "relative mx-auto flex h-16 max-w-6xl items-center px-5 lg:px-6",
            framed && "border-x border-[var(--hairline)]",
          )}
        >
          <Link href="/" className="flex shrink-0 items-center gap-2.5 text-foreground">
            <VanteraLogo className="size-6 text-[var(--fb)]" />
            <span className="text-[1.2rem] font-semibold tracking-tight">Vantera</span>
          </Link>

          {/* Absolutely centered so the links sit at the true middle of the bar,
              independent of the logo/actions widths on either side. */}
          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex">
            {MENUS.map((m) => {
              const on = open === m.key;
              return (
                <li key={m.key}>
                  <button
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={on}
                    onPointerEnter={() => {
                      cancelClose();
                      setOpen(m.key);
                    }}
                    onFocus={() => {
                      cancelClose();
                      setOpen(m.key);
                    }}
                    onPointerDown={(e) => {
                      lastPointer.current = e.pointerType;
                    }}
                    onClick={(e) => {
                      // Hover already opened it: clicking the label the pointer is on
                      // shouldn't shut it again. Touch and keyboard still toggle.
                      if (on && e.detail > 0 && lastPointer.current === "mouse") return;
                      if (on) closeNow();
                      else setOpen(m.key);
                    }}
                    className={cn(TOP_ITEM, on && "bg-[rgba(12,16,26,0.045)] text-foreground")}
                  >
                    {m.label}
                    <ChevronDown
                      className={cn(
                        "size-3.5 opacity-60 transition-transform duration-200",
                        on && "rotate-180",
                      )}
                      strokeWidth={2.2}
                      aria-hidden
                    />
                  </button>
                </li>
              );
            })}
            {FLAT_LINKS.map((l) => (
              <li key={l.href}>
                <NavLink href={l.href} className={TOP_ITEM} onClick={closeNow}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>

          {/* Rankbox's pair: a hairline secondary beside the solid primary. */}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className={cn(
                "hidden h-[38px] items-center rounded-lg border border-[rgba(12,16,26,0.1)] bg-white px-4 text-sm font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:border-[rgba(12,16,26,0.16)] hover:bg-[rgba(12,16,26,0.02)] sm:inline-flex",
                FOCUS_RING,
              )}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className={cn(
                "inline-flex h-[38px] items-center rounded-lg bg-[var(--fb-strong)] px-4 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_1px_2px_rgba(16,24,40,0.14)] transition-colors hover:bg-[#1161cc]",
                FOCUS_RING,
              )}
            >
              Get Started Free
            </Link>
          </div>
        </div>

        {/* The panel: one white card centred under the bar, not aligned to its
            trigger. Opaque, so it reads on any bar state. */}
        {activeMenu && (
          <div className="absolute inset-x-0 top-full hidden px-4 pt-2 md:block" onPointerEnter={cancelClose}>
            {/* Not role="menu": the children are ordinary links, not menuitems, so
                application-menu semantics would mislead a screen reader. The trigger's
                aria-expanded already conveys the disclosure state. */}
            <div
              data-nav-panel
              aria-label={activeMenu.label}
              className="mx-auto w-[min(60rem,calc(100vw-2rem))] origin-top animate-[nav-panel_180ms_ease-out] overflow-hidden rounded-lg border border-[rgba(12,16,26,0.08)] bg-white shadow-[0_2px_6px_-2px_rgba(16,24,40,0.06),0_16px_40px_-16px_rgba(16,24,40,0.2)]"
            >
              <MegaPanel menu={activeMenu} onNavigate={closeNow} />
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
