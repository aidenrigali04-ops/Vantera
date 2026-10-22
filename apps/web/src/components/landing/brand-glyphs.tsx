/* Shared third-party brand glyphs for the marketing landing. Only publicly-named
   integrations belong here (LinkedIn, Claude, MCP, HubSpot, Salesforce, Slack — the
   CRM and alert destinations in packages/crm-infra);
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

/** HubSpot's sprocket, cut from the official wordmark (brand-logos.tsx) by viewBox,
    for places a wordmark won't fit: icon rows and integration cells. */
export function HubSpotMark({ className }: { className?: string }) {
  return (
    <svg viewBox="374 3 161 163" fill="currentColor" className={className} role="img" aria-label="HubSpot">
      <path d="M496,53.85V34.37a15,15,0,0,0,8.65-13.52v-.45a15,15,0,0,0-15-15h-.45a15,15,0,0,0-15,15v.45a15,15,0,0,0,8.65,13.52V53.85a42.48,42.48,0,0,0-20.2,8.89L409.23,21.13a16.75,16.75,0,0,0,.6-4.21,16.9,16.9,0,1,0-16.92,16.87,16.72,16.72,0,0,0,8.32-2.26l52.61,40.93a42.61,42.61,0,0,0,.65,48l-16,16a13.74,13.74,0,0,0-4-.65,13.88,13.88,0,1,0,13.89,13.89,13.7,13.7,0,0,0-.65-4l15.83-15.83A42.68,42.68,0,1,0,496,53.85m-6.56,64.06A21.9,21.9,0,1,1,511.36,96a21.9,21.9,0,0,1-21.9,21.9" />
    </svg>
  );
}

/** Salesforce's cloud, from Simple Icons (CC0). */
export function SalesforceMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="Salesforce">
      <path d="M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.3 1.35-.45 2.1-.45 2.85 0 5.159 2.34 5.159 5.22s-2.31 5.22-5.176 5.22c-.345 0-.69-.044-1.02-.104a3.75 3.75 0 01-3.3 1.95c-.6 0-1.155-.15-1.65-.375A4.314 4.314 0 018.88 20.4a4.302 4.302 0 01-4.05-2.82c-.27.062-.54.076-.825.076-2.204 0-4.005-1.8-4.005-4.05 0-1.5.811-2.805 2.01-3.51-.255-.57-.39-1.2-.39-1.846 0-2.58 2.1-4.65 4.65-4.65 1.53 0 2.85.705 3.72 1.8" />
    </svg>
  );
}

/** Slack's hash mark, from Simple Icons (CC0), one colour like every glyph here. */
export function SlackMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="Slack">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

