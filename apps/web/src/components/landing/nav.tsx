"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { VanteraLogo } from "./vantera-logo";
import { LiveBanner } from "./live-banner";
import {
  CrmSyncIcon,
  McpIcon,
  OutreachIcon,
  ProspectingIcon,
  RepliesIcon,
  SafetyIcon,
  type ProductIcon,
} from "./product-icons";

/**
 * Landing nav — a standard full-width bar (Stripe / Vercel / ChatGPT register), pinned
 * directly beneath the fixed announcement banner. Transparent over the hero, then a
 * white blur + hairline underline once the page scrolls. Links sit next to the logo,
 * actions on the right. "Products" opens a hover/focus dropdown (pure CSS, no JS state)
 * with a two-column menu of the product surfaces.
 */

// Absolute hrefs so the nav works from any page (subpages jump back to the homepage section).
const FLAT_LINKS = [
  { label: "How it works", href: "/#showcase" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/#faq" },
];

type ProductLink = { icon: ProductIcon; title: string; desc: string; href: string };

const PRODUCTS: ProductLink[] = [
  { icon: ProspectingIcon, title: "Prospecting", desc: "Find and rank in-market buyers", href: "/#features" },
  { icon: OutreachIcon, title: "Outreach", desc: "Personalized LinkedIn messages", href: "/#features" },
  { icon: SafetyIcon, title: "Safety", desc: "LinkedIn-safe, anti-ban pacing", href: "/#features" },
  { icon: RepliesIcon, title: "Replies", desc: "Every reply captured in one place", href: "/#features" },
  { icon: CrmSyncIcon, title: "CRM sync", desc: "Closed deals pushed to your CRM", href: "/#integrations" },
  { icon: McpIcon, title: "Claude & MCP", desc: "Drive Vantera from Claude", href: "/claude-linkedin-mcp" },
];

const LINK_CLS =
  "rounded-md px-3 py-2 text-[14px] font-medium text-[var(--ink-3)] transition-colors hover:text-foreground";

/** Renders <a> for hash links (same-page jumps), <Link> for real routes. */
function NavLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.includes("#")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function ProductsMenu() {
  return (
    <li className="group relative flex items-center">
      <button
        type="button"
        aria-haspopup="menu"
        className={cn(LINK_CLS, "inline-flex items-center gap-1 group-hover:text-foreground")}
      >
        Products
        <ChevronDown
          className="size-3.5 text-[var(--ink-4)] transition-transform duration-200 group-hover:rotate-180"
          strokeWidth={2.2}
          aria-hidden
        />
      </button>

      {/* Dropdown — the pt-3 wrapper is a transparent hover bridge so the pointer can
          cross the gap between trigger and panel without the menu closing. */}
      <div
        className={cn(
          "invisible absolute left-1/2 top-full -translate-x-1/2 translate-y-1 pt-3 opacity-0 transition-all duration-200",
          "group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
          "group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100",
        )}
      >
        <div
          role="menu"
          className="w-[544px] rounded-2xl border border-[var(--hairline)] bg-white/95 p-2 shadow-[var(--shadow-lift)] backdrop-blur-xl"
        >
          <div className="grid grid-cols-2 gap-0.5">
            {PRODUCTS.map((p) => (
              <NavLink
                key={p.title}
                href={p.href}
                className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--tint)]"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-1 ring-inset ring-[var(--cyan-line)]">
                  <p.icon className="size-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold tracking-[-0.01em] text-foreground">
                    {p.title}
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--ink-4)]">{p.desc}</span>
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </li>
  );
}

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Announcement ribbon + nav render as one fixed header so every page that uses
          LandingNav gets the pinned banner and the correct top offset automatically. */}
      <LiveBanner />
      {/* Nav pinned directly below the h-9 banner; both are fixed and never scroll. */}
      <header className="fixed inset-x-0 top-9 z-40">
        <nav
        className={cn(
          "border-b transition-colors duration-300",
          scrolled
            ? "border-[var(--hairline)] bg-white/80 backdrop-blur-xl backdrop-saturate-150"
            : "border-transparent bg-transparent",
        )}
      >
        <div className="relative mx-auto flex h-16 max-w-6xl items-center px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-foreground">
            <VanteraLogo className="size-[22px] text-foreground" />
            <span className="text-[16.5px] font-semibold tracking-[-0.02em]">Vantera</span>
          </Link>

          {/* Absolutely centered so the links sit at the true middle of the bar,
              independent of the logo/actions widths on either side. */}
          <ul className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex">
            <ProductsMenu />
            {FLAT_LINKS.map((l) => (
              <li key={l.href}>
                <NavLink href={l.href} className={LINK_CLS}>
                  {l.label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/login"
              className="hidden rounded-md px-3.5 py-2 text-[14px] font-medium text-[var(--ink-2)] transition-colors hover:text-foreground sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-full bg-[#0a0c12] px-4 py-2.5 text-[14px] font-medium text-white shadow-[0_1px_2px_rgba(12,16,26,0.2)] transition-all hover:shadow-[0_8px_24px_-8px_rgba(24,119,242,0.55)]"
            >
              Get started
            </Link>
          </div>
        </div>
        </nav>
      </header>
    </>
  );
}
