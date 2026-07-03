import Link from "next/link";
import { VanteraLogo } from "./vantera-logo";

/**
 * Landing footer — the light Poppins/cyan system, mirrored across the marketing
 * surfaces via marketing-shell.tsx. A left identity block (mark + tagline +
 * copyright) sits beside three grouped link columns (Sections · Product · Info),
 * over a hairline top border. Footer nav links rest muted and resolve to
 * foreground on hover (accent stays reserved). Server component: no hooks, no
 * motion — pure next/link + an inline brand mark.
 */

type FooterLink = { label: string; href: string };

const COLUMNS: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Sections",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    heading: "Product",
    links: [
      { label: "Prospecting", href: "/#features" },
      { label: "Outreach", href: "/#features" },
      { label: "Safety", href: "/#features" },
      { label: "Replies", href: "/#features" },
      { label: "Connect MCP", href: "/claude-linkedin-mcp" },
    ],
  },
  {
    heading: "Info",
    links: [
      { label: "FAQ", href: "/faq" },
      { label: "For AI assistants", href: "/ai-info" },
      { label: "Affiliate Program", href: "/affiliate" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Opt-out", href: "/opt-out" },
      { label: "System Status", href: "/status" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-[var(--hairline)] bg-[var(--tint)] px-6 py-16 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
        {/* Identity block */}
        <div className="max-w-xs">
          <Link
            href="/"
            className="group inline-flex items-center gap-2.5 text-foreground"
          >
            <VanteraLogo className="size-6 text-foreground transition-transform duration-300 ease-out group-hover:scale-105" />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Vantera</span>
          </Link>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-3)]">The AI SDR team for LinkedIn.</p>
          <p className="mt-6 font-mono text-[11px] tracking-[0.02em] text-[var(--ink-4)]">© 2026 Vantera</p>
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

      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-[var(--hairline)] pt-7 sm:flex-row">
        <p className="font-mono text-[11px] tracking-[0.02em] text-[var(--ink-4)]">
          © 2026 Vantera. All rights reserved.
        </p>
        <p className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.02em] text-[var(--ink-4)]">
          <span className="size-1.5 rounded-full bg-[var(--cyan)]" />
          LinkedIn-only · you approve every send
        </p>
      </div>
    </footer>
  );
}
