import Link from "next/link";
import { VanteraLogo } from "./vantera-logo";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#showcase" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Blog", href: "/blog" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create account", href: "/signup" },
      { label: "Sign in", href: "/login" },
      { label: "Book a demo", href: "mailto:sales@vanterasystem.com?subject=Vantera%20demo" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-[var(--hairline)] bg-[var(--tint)] px-6 py-14 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="flex items-center gap-2 text-foreground">
            <VanteraLogo className="size-6 text-foreground" />
            <span className="text-[17px] font-semibold tracking-[-0.02em]">Vantera</span>
          </Link>
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-[var(--ink-3)]">
            The LinkedIn automation power system — find in-market buyers, reach out in your voice,
            and never let a reply slip. You approve every send.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--ink-4)]">
              {col.heading}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[14px] text-[var(--ink-2)] transition-colors hover:text-[var(--cyan-strong)]"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-2 border-t border-[var(--hairline)] pt-6 sm:flex-row">
        <p className="font-mono text-[11px] text-[var(--ink-4)]">
          © {new Date().getFullYear()} Vantera. All rights reserved.
        </p>
        <p className="font-mono text-[11px] text-[var(--ink-4)]/80">Demo runs on sample data.</p>
      </div>
    </footer>
  );
}
