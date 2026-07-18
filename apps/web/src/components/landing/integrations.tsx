"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LandingHeading } from "./heading";
import { Reveal, RevealItem, CARD_INTERACTIVE } from "./surface";
import { HubSpotLogo } from "./brand-logos";
import { StatusDot } from "./viz";
import { cn } from "@/lib/utils";

/* ── Brand glyphs ──────────────────────────────────────────────────────────
   lucide dropped its brand icons, so every mark below is inlined. Each renders
   with `fill="currentColor"` so the tile can hold it in one calm monochrome
   slate and light it to the brand's own colour on hover, matching the logo
   cloud in brand-logos.tsx. */

/** LinkedIn brand glyph (the LinkedInMark inline-SVG pattern used across the repo). */
function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="LinkedIn">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Salesforce cloud glyph — simplified cloud silhouette, lit to brand blue on hover. */
function SalesforceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="Salesforce">
      <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
    </svg>
  );
}

/** Claude / Anthropic brand glyph — the radiating sunburst mark (a clean, tasteful
    monochrome burst; never the letters "AI"). Twelve tapered rays from a common
    centre, matching Anthropic's signature spark. */
function ClaudeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="Claude">
      <g transform="translate(12 12)">
        {Array.from({ length: 12 }).map((_, i) => (
          <path
            key={i}
            d="M0 -10.5 L1.15 -3.4 A3.4 3.4 0 0 0 -1.15 -3.4 Z"
            transform={`rotate(${i * 30})`}
          />
        ))}
      </g>
    </svg>
  );
}

type Tile = {
  name: string;
  desc: string;
  logo: (props: { className?: string }) => React.ReactElement;
  status: "Native" | "Connected" | "New";
  brand: string; // hover colour = the brand's own primary
  href?: string; // the Claude/MCP tile deep-links to its dedicated page
  logoClass?: string; // per-mark sizing (wordmarks vs. glyphs)
  metric: string; // decorative sync-status readout (aria-hidden)
};

// T2 honesty: tiles list only integrations the product actually ships (the CRM provider
// set is HubSpot / Salesforce / GoHighLevel — Pipedrive was a claim we couldn't honor),
// and the "Synced 2m ago"-style readouts are gone: no simulated telemetry.
const TILES: Tile[] = [
  {
    name: "HubSpot",
    desc: "Closed deals sync as contacts and deals.",
    logo: HubSpotLogo,
    status: "Native",
    brand: "#FF7A59",
    logoClass: "h-4 w-auto",
    metric: "Closed-won push",
  },
  {
    name: "Salesforce",
    desc: "Won leads land in your pipeline — GoHighLevel too.",
    logo: SalesforceMark,
    status: "Native",
    brand: "#00A1E0",
    logoClass: "size-[26px]",
    metric: "Closed-won push",
  },
  {
    name: "Claude & MCP",
    desc: "Drive Vantera from Claude over the MCP.",
    logo: ClaudeMark,
    status: "New",
    brand: "#D97757",
    href: "/claude-linkedin-mcp",
    logoClass: "h-[22px] w-auto",
    metric: "MCP tools",
  },
  {
    name: "LinkedIn",
    desc: "Your account, connected in one secure step.",
    logo: LinkedinMark,
    status: "Connected",
    brand: "#0A66C2",
    logoClass: "size-[26px]",
    metric: "Secure OAuth",
  },
];

/** Per-status pill treatment — soft tinted surface, legible label, and a matching
    dot. Accent statuses carry a faint glow on the dot, echoing the hero-calendar
    "booked" pill so the whole landing shares one signal language. */
const STATUS_STYLES: Record<Tile["status"], { pill: string; dot: string }> = {
  Native: {
    pill: "bg-[#eafaf0] text-[#1a9e4b] ring-[rgba(26,158,75,0.16)]",
    dot: "bg-[#1a9e4b]",
  },
  Connected: {
    pill: "bg-[var(--cyan-tint)] text-[var(--cyan-strong)] ring-[var(--cyan-line)]",
    dot: "bg-[var(--cyan)]",
  },
  New: {
    pill: "bg-[var(--fb-tint)] text-[var(--fb-strong)] ring-[rgba(24,119,242,0.22)]",
    dot: "bg-[var(--fb)]",
  },
};

/** One integration card. The logo sits in a calm white well with a soft inner
    highlight (the hero-calendar card recipe) and lifts to the brand colour on hover,
    mirroring the brand-logos.tsx cloud convention. Anatomy top→bottom: status pill,
    logo well, name, one-line, and — on the linked tile — a "Learn more" affordance. */
function TileCard({ tile }: { tile: Tile }) {
  const Logo = tile.logo;
  const isLink = Boolean(tile.href);
  const status = STATUS_STYLES[tile.status];
  return (
    <div
      className={cn(
        CARD_INTERACTIVE,
        "group relative flex h-full flex-col p-6 sm:p-7",
        isLink && "cursor-pointer",
      )}
    >
      {/* status pill, top-right — soft tint + hairline ring + matching dot */}
      <span
        className={cn(
          "absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.1em] ring-1 ring-inset",
          status.pill,
        )}
      >
        <span className={cn("size-1.5 rounded-full", status.dot)} />
        {tile.status}
      </span>

      {/* logo well — soft inner highlight at rest, hairline warms to the brand hue and
          the mark lights to its own colour on hover */}
      <span
        className="grid size-14 place-items-center rounded-2xl border border-[var(--hairline)] bg-[#fbfcfd] text-[var(--ink-4)] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),var(--shadow-sm)] transition-[border-color,box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:border-[color-mix(in_srgb,var(--brand)_38%,var(--hairline))]"
        style={{ ["--brand" as string]: tile.brand }}
      >
        <Logo className={cn(tile.logoClass, "transition-colors duration-300 group-hover:text-[var(--brand)]")} />
      </span>

      <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.01em] text-foreground">{tile.name}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--ink-3)]">{tile.desc}</p>

      {/* sync-status footer — a live-looking readout that shows the connection working
          (decorative, aria-hidden); the linked tile also carries its "Learn more" here. */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--hairline)] pt-3.5">
        <span
          aria-hidden
          className="inline-flex min-w-0 items-center gap-1.5 text-[10.5px] font-medium tabular-nums text-[var(--ink-4)]"
        >
          <StatusDot size="sm" pulse={tile.status === "Connected"} />
          <span className="truncate">{tile.metric}</span>
        </span>
        {isLink && (
          <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-[var(--fb-strong)]">
            Learn more
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        )}
      </div>
    </div>
  );
}

export function Integrations() {
  return (
    <section
      id="integrations"
      className="relative border-t border-[var(--hairline)] bg-white py-24 sm:py-28"
    >
      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <LandingHeading
          eyebrow="Integrations"
          title="Closed deals flow straight to your CRM"
          subtitle="Native connections to your CRM, to Claude over MCP, and to the LinkedIn account you already run."
        />

        <Reveal className="mt-14 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {TILES.map((tile) => (
            <RevealItem key={tile.name} className="h-full">
              {tile.href ? (
                <Link
                  href={tile.href}
                  className="block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--fb)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <TileCard tile={tile} />
                </Link>
              ) : (
                <TileCard tile={tile} />
              )}
            </RevealItem>
          ))}
        </Reveal>

        <p className="mt-8 text-center text-[13.5px] text-[var(--ink-4)]">
          Closed deals push straight into your CRM — no exports, no copy-paste.
        </p>
      </div>
    </section>
  );
}
