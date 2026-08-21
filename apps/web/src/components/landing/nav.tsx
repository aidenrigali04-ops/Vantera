"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "./vantera-logo";
import { FLAT_LINKS, MENUS, type Menu, type MenuItem } from "./nav-menus";

/**
 * Landing nav — a full-width bar pinned to the top of the viewport, with three
 * mega-menus (Platform / Solutions / Resources) plus a flat Pricing link.
 *
 * Each mega-menu is one wide panel aligned to the page container: two icon-and-copy
 * link columns under tracked-caps eyebrows, and a tinted feature card with a mono
 * readout on the right. One menu is open at a time (shared state, not per-item CSS
 * hover) so the pointer can travel across triggers without the panel flickering shut;
 * a short close delay bridges the gap between trigger and panel.
 *
 * `onDark` (homepage only) inverts the bar while it overlaps the blue hero slab
 * (`[data-hero-dark]`): white content over transparent chrome, crossfading back to the
 * standard white bar once the hero scrolls past. Every other marketing page omits the
 * prop and is behaviorally untouched. An open menu always forces the solid bar — a
 * white panel hanging off transparent chrome reads as detached.
 */

/** How long the panel survives after the pointer leaves, so the gap is crossable. */
const CLOSE_DELAY_MS = 120;

function linkCls(dark: boolean) {
  return cn(
    "rounded-full px-3.5 py-2 text-[14px] font-medium transition-colors duration-200",
    dark ? "text-white/85 hover:text-white" : "text-[var(--ink-3)] hover:text-foreground",
  );
}

/** Renders <a> for hash links (same-page jumps), <Link> for real routes. */
function NavLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
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

function MenuRow({ item, onNavigate }: { item: MenuItem; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      href={item.href}
      onClick={onNavigate}
      className="group/row flex items-start gap-3.5 rounded-xl p-3 transition-colors duration-200 hover:bg-white/10"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-white/12 text-white ring-1 ring-inset ring-white/20 transition-transform duration-200 group-hover/row:scale-105">
        <Icon className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold tracking-[-0.01em] text-white">
          {item.title}
        </span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-[#c3d9f8]">
          {item.desc}
        </span>
      </span>
    </NavLink>
  );
}

function MegaPanel({ menu, onNavigate }: { menu: Menu; onNavigate: () => void }) {
  const { readout } = menu.feature;
  return (
    <div className="grid grid-cols-[1fr_1fr_320px] gap-8 p-6">
      {menu.columns.map((col) => (
        <div key={col.eyebrow}>
          <span className="block px-3 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#c3d9f8]">
            {col.eyebrow}
          </span>
          <div className="mt-2 flex flex-col gap-0.5">
            {col.items.map((item) => (
              <MenuRow key={item.title} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}

      {/* feature card — a lifted glass panel on the blue */}
      <div className="flex flex-col rounded-2xl border border-white/20 bg-white/[0.08] p-5">
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-white">
          {menu.feature.title}
        </span>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[#c3d9f8]">{menu.feature.blurb}</p>

        <div className="mt-4 rounded-xl border border-white/12 bg-[rgba(3,22,58,0.34)] p-3.5">
          <span className="block text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[#c3d9f8]">
            {readout.label}
          </span>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {readout.rows.map((r) => (
              <div key={r.k} className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[12px] font-medium text-white">{r.k}</span>
                <span className="shrink-0 text-[11.5px] tabular-nums text-[#c3d9f8]">{r.v}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-white/12 pt-2.5 text-[10.5px] leading-snug text-[#c3d9f8]">
            {readout.note}
          </p>
        </div>

        <NavLink
          href={menu.feature.cta.href}
          onClick={onNavigate}
          className="group/cta mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-white"
        >
          {menu.feature.cta.label}
          <ArrowRight
            className="size-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5"
            strokeWidth={2.4}
          />
        </NavLink>
      </div>
    </div>
  );
}

export function LandingNav({ onDark = false }: { onDark?: boolean } = {}) {
  const [scrolled, setScrolled] = useState(false);
  // Seeded from onDark so the homepage's first paint is already inverted (no flash).
  const [overHero, setOverHero] = useState(onDark);
  const [open, setOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      if (!onDark) return;
      const hero = document.querySelector<HTMLElement>("[data-hero-dark]");
      // 64 = bar height: the nav is "over" the hero until the hero's bottom clears the bar.
      setOverHero(!!hero && hero.getBoundingClientRect().bottom > 64);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [onDark]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeNow]);

  const dark = onDark && overHero;
  // An open panel always sits on solid chrome, whatever the scroll/hero state.
  const solid = scrolled || open !== null;
  const activeMenu = MENUS.find((m) => m.key === open) ?? null;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40">
        {/* Page scrim — blurs and dims everything behind an open panel. Fixed inside
            the z-40 header at -z-10, so it sits above all page content but beneath the
            bar and the panel. */}
        {open && (
          <div
            aria-hidden
            className="fixed inset-0 -z-10 animate-[nav-scrim_180ms_ease-out] bg-[rgba(4,24,64,0.22)] backdrop-blur-[7px]"
            onPointerEnter={scheduleClose}
            onClick={closeNow}
          />
        )}
        <nav
          className={cn(
            "relative border-b transition-colors duration-300",
            dark
              ? solid
                ? "border-white/12 bg-[rgba(15,94,203,0.72)] backdrop-blur-xl backdrop-saturate-150"
                : "border-transparent bg-transparent"
              : solid
                ? "border-[var(--hairline)] bg-white/80 backdrop-blur-xl backdrop-saturate-150"
                : "border-transparent bg-transparent",
          )}
          onPointerLeave={scheduleClose}
        >
          {/* Top scrim over the raw brand blue — lifts the 14px white links past AA
              (effective bar bg ≈ #1360c4, 6.4:1). Only while transparent over the hero. */}
          {dark && !solid && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[110px] [background:linear-gradient(180deg,rgba(4,24,64,0.26)_0%,rgba(4,24,64,0.10)_60%,transparent_100%)]"
            />
          )}

          <div className="relative mx-auto flex h-16 max-w-6xl items-center px-6 lg:px-8">
            <Link
              href="/"
              className={cn(
                "flex shrink-0 items-center gap-2 transition-colors duration-300",
                dark ? "text-white" : "text-foreground",
              )}
            >
              <VanteraLogo className="size-[22px]" />
              <span className="text-[16.5px] font-semibold tracking-[-0.02em]">Vantera</span>
            </Link>

            {/* Absolutely centered so the links sit at the true middle of the bar,
                independent of the logo/actions widths on either side. */}
            <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex">
              {MENUS.map((m) => {
                const on = open === m.key;
                return (
                  <li key={m.key} className="flex items-center">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={on}
                      onPointerEnter={() => {
                        cancelClose();
                        setOpen(m.key);
                      }}
                      onFocus={() => {
                        cancelClose();
                        setOpen(m.key);
                      }}
                      onClick={() => (on ? closeNow() : setOpen(m.key))}
                      className={cn(
                        linkCls(dark),
                        "inline-flex items-center gap-1.5",
                        on && (dark ? "bg-white/15 text-white" : "bg-[var(--tint)] text-foreground"),
                      )}
                    >
                      {m.label}
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform duration-200",
                          on && "rotate-180",
                          dark ? "text-white/70" : "text-[var(--ink-4)]",
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
                  <NavLink
                    href={l.href}
                    className={linkCls(dark)}
                    onClick={closeNow}
                  >
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="ml-auto flex items-center gap-1.5">
              <Link
                href="/login"
                className={cn(
                  "hidden rounded-md px-3.5 py-2 text-[14px] font-medium transition-colors duration-300 sm:inline-flex",
                  dark ? "text-white/85 hover:text-white" : "text-[var(--ink-2)] hover:text-foreground",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  "inline-flex items-center rounded-full px-4 py-2.5 text-[14px] font-medium transition-all duration-300",
                  dark
                    ? "bg-white text-[var(--fb-strong)] shadow-[0_8px_24px_-10px_rgba(3,22,58,0.6)] hover:shadow-[0_12px_32px_-10px_rgba(3,22,58,0.7)]"
                    : "bg-[#0a0c12] text-white shadow-[0_1px_2px_rgba(12,16,26,0.2)] hover:shadow-[0_8px_24px_-8px_rgba(24,119,242,0.55)]",
                )}
              >
                Get started
              </Link>
            </div>
          </div>

          {/* Mega panel — one wide surface aligned to the page container, not to the
              trigger. Stays opaque white so it reads on any bar state. */}
          {activeMenu && (
            <div
              className="absolute inset-x-0 top-full hidden md:block"
              onPointerEnter={cancelClose}
            >
              <div className="mx-auto max-w-6xl px-6 lg:px-8">
                {/* Not role="menu": the children are ordinary links, not menuitems,
                    so application-menu semantics would mislead a screen reader. The
                    trigger's aria-expanded already conveys the disclosure state. */}
                <div
                  data-nav-panel
                  aria-label={activeMenu.label}
                  className="mt-2 origin-top animate-[nav-panel_180ms_ease-out] overflow-hidden rounded-2xl border border-white/15 shadow-[0_2px_8px_rgba(3,22,58,0.20),0_30px_64px_-24px_rgba(3,22,58,0.55)] [background:linear-gradient(180deg,#0e4fb0_0%,#0a3f92_100%)]"
                >
                  <MegaPanel menu={activeMenu} onNavigate={closeNow} />
                </div>
              </div>
            </div>
          )}
        </nav>
      </header>
    </>
  );
}
