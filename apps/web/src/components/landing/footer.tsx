import Link from "next/link";
import { VanteraLogo } from "./vantera-logo";
import { LINKEDIN_DISCLAIMER } from "./claims";

/**
 * Landing footer — identity block + four grouped columns (Product · Resources ·
 * Company · Legal), every link a real route. The bottom row carries the LinkedIn
 * disclaimer (blueprint: it belongs on every page) beside the product's one-line
 * promise. Server component: no hooks, no motion.
 */

type FooterLink = { label: string; href: string };

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Approvals", href: "/#approvals" },
      { label: "Account safety", href: "/#safety" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Use cases", href: "/use-cases" },
      { label: "Log in", href: "/login" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Free tools", href: "/tools" },
      { label: "Glossary", href: "/glossary" },
      { label: "FAQ", href: "/faq" },
      { label: "How pacing works", href: "/safety" },
      { label: "For AI assistants", href: "/ai-info" },
      { label: "System status", href: "/status" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Affiliate program", href: "/affiliate" },
      { label: "Claude & MCP", href: "/claude-linkedin-mcp" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Opt-out", href: "/opt-out" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-[var(--hairline)] bg-[var(--tint)] px-6 py-16 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        {/* Identity block */}
        <div className="max-w-xs">
          <Link href="/" className="group inline-flex items-center gap-2.5 text-foreground">
            <VanteraLogo className="size-6 text-foreground transition-transform duration-300 ease-out group-hover:scale-105" />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Vantera</span>
          </Link>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-3)]">
            The AI SDR team for LinkedIn.
          </p>
        </div>

        {/* Link columns */}
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-mono text-[11px] uppercase leading-none tracking-[0.16em] text-[var(--ink-4)]">
              {col.heading}
            </h3>
            <ul className="mt-5 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[14px] text-[var(--ink-3)] transition-colors duration-200 hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-3 border-t border-[var(--hairline)] pt-7 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[11px] tracking-[0.02em] text-[var(--ink-4)]">
          © 2026 Vantera. All rights reserved.
        </p>
        <p className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.02em] text-[var(--ink-4)]">
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--cyan)]" />
          LinkedIn-only · you approve every send
        </p>
      </div>
      <p className="mx-auto mt-4 max-w-6xl text-[11px] leading-relaxed text-[var(--ink-4)]">
        {LINKEDIN_DISCLAIMER}
      </p>
    </footer>
  );
}
