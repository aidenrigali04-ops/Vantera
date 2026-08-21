/* Shared third-party brand glyphs for the marketing landing. Only publicly-named
   integrations belong here (LinkedIn, Claude, MCP — all already on user surfaces);
   white-labeled vendors (rules 03/04/05) must never appear. The LinkedIn path is
   the same inline-SVG used across the landing — new code imports from here instead
   of re-declaring it. */

/** LinkedIn brand glyph — lucide dropped brand icons, so we render it inline. */
export function LinkedinMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="LinkedIn">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

/** Claude / Anthropic brand glyph — the radiating sunburst mark (a clean, tasteful
    monochrome burst; never the letters "AI"). Twelve tapered rays from a common
    centre, matching Anthropic's signature spark. */
export function ClaudeMark({ className }: { className?: string }) {
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

/** MCP (Model Context Protocol) glyph — the interlocked hex-node mark rendered as a
    simple stroke motif: a central node with three spokes, the protocol's "connector"
    read. Monochrome via currentColor like every landing glyph. */
export function McpMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="MCP"
    >
      <circle cx="12" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <path d="M12 9.4V3.6" />
      <path d="M14.25 13.3l5.05 2.9" />
      <path d="M9.75 13.3l-5.05 2.9" />
      <circle cx="12" cy="2.8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19.95" cy="16.6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.05" cy="16.6" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
