import Link from "next/link";

const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "Live pipeline", href: "#simulate" },
      { label: "Agents", href: "#agents" },
      { label: "Outcomes", href: "#outcomes" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create account", href: "/signup" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    heading: "Trust",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
      { label: "Compliance", href: "#" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative border-t border-white/[0.16] px-4 py-12">
      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="font-heading text-lg font-semibold tracking-tight text-foreground">
            Vantera
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Sales intelligence run by SDR agents — prospect, score, and reach out to only
            high-quality leads.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h3 className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
              {col.heading}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-foreground/70 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-5xl flex-col items-center justify-between gap-2 border-t border-white/5 pt-6 sm:flex-row">
        <p className="font-mono text-[11px] text-muted-foreground">
          © {new Date().getFullYear()} Vantera. All rights reserved.
        </p>
        <p className="font-mono text-[11px] text-muted-foreground/70">
          Demo runs on sample data.
        </p>
      </div>
    </footer>
  );
}
