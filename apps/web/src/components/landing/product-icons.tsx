import type { ComponentType, ReactNode } from "react";

/**
 * Custom product-concept icon set — hand-drawn on a 24×24 grid, one metaphor per idea,
 * in a restrained duotone: a soft `currentColor` fill under crisp `currentColor` stroke
 * detail (the Phosphor/Stripe technique). currentColor means each icon inherits the
 * accent of whatever well it sits in. Consistent 1.6 stroke, round caps/joins. Purpose-
 * built so the landing never reads as a bag of generic line icons.
 *
 * These are decorative — every <svg> is aria-hidden; the label text carries the meaning.
 */

export type ProductIcon = ComponentType<{ className?: string }>;

// Shared stroke attributes — spread onto <g> and <path> alike, so kept as a plain
// `as const` literal (no element-specific `ref`) to stay assignable to any SVG element.
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Prospecting — a lens locating the right person: a magnifier with a buyer inside. */
export function ProspectingIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="10.5" cy="10.5" r="6" fill="currentColor" opacity="0.12" />
      <g {...STROKE}>
        <circle cx="10.5" cy="10.5" r="6" />
        <circle cx="10.5" cy="9" r="1.65" />
        <path d="M7.7 13.3c.35-1.45 1.45-2.2 2.8-2.2s2.45.75 2.8 2.2" />
        <path d="m15.2 15.2 3.8 3.8" strokeWidth="1.9" />
      </g>
    </Svg>
  );
}

/** Outreach — a personalized message: a speech bubble with an AI spark inside. */
export function OutreachIcon({ className }: { className?: string }) {
  const bubble =
    "M4 8a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3h-4l-3.5 2.8a.5.5 0 0 1-.8-.4V15H7a3 3 0 0 1-3-3z";
  return (
    <Svg className={className}>
      <path d={bubble} fill="currentColor" opacity="0.1" />
      <path d={bubble} {...STROKE} />
      <path
        d="M12.2 7.4c.32 1.5.88 2.06 2.4 2.4-1.52.34-2.08.9-2.4 2.4-.32-1.5-.88-2.06-2.4-2.4 1.52-.34 2.08-.9 2.4-2.4Z"
        fill="currentColor"
        opacity="0.9"
        stroke="currentColor"
        strokeWidth="0.4"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Safety — a protected account: a shield carrying a steady pacing pulse. */
export function SafetyIcon({ className }: { className?: string }) {
  const shield = "M12 3.4 5.6 6v5.2c0 3.9 2.75 6.45 6.4 7.8 3.65-1.35 6.4-3.9 6.4-7.8V6z";
  return (
    <Svg className={className}>
      <path d={shield} fill="currentColor" opacity="0.12" />
      <g {...STROKE}>
        <path d={shield} />
        <path d="M8 11.6h1.7l1.1-2.2 1.7 4.3 1.1-2.1h1.6" strokeWidth="1.5" />
      </g>
    </Svg>
  );
}

/** Replies — every reply captured: a message dropping into an inbox tray. */
export function RepliesIcon({ className }: { className?: string }) {
  const tray =
    "M4.5 13.2 6.6 9.3a2 2 0 0 1 1.8-1h7.2a2 2 0 0 1 1.8 1l2.1 3.9V16.6a2.2 2.2 0 0 1-2.2 2.1H6.7a2.2 2.2 0 0 1-2.2-2.1z";
  return (
    <Svg className={className}>
      <path
        d="M4.5 13.2H9l1 1.9h4l1-1.9h4.5V16.6a2.2 2.2 0 0 1-2.2 2.1H6.7a2.2 2.2 0 0 1-2.2-2.1z"
        fill="currentColor"
        opacity="0.12"
      />
      <g {...STROKE}>
        <path d={tray} />
        <path d="M4.5 13.2H9l1 1.9h4l1-1.9h4.5" />
        <path d="M12 2.9v5.3m2-2-2 2-2-2" strokeWidth="1.5" />
      </g>
    </Svg>
  );
}

/** CRM sync — closed deals pushed into a CRM record card. */
export function CrmSyncIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="10" y="5" width="9.5" height="14" rx="2.5" fill="currentColor" opacity="0.1" />
      <g {...STROKE}>
        <rect x="10" y="5" width="9.5" height="14" rx="2.5" />
        <path d="M12.8 9h3.9M12.8 12h3.9M12.8 15h2.4" strokeWidth="1.4" />
        <path d="M3 12h6m0 0-2.2-2.2M9 12l-2.2 2.2" strokeWidth="1.5" />
      </g>
    </Svg>
  );
}

/** Claude & MCP — a hub connected to satellites (the protocol wiring things together). */
export function McpIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" opacity="0.16" />
      <g {...STROKE}>
        <path d="M12 9.6V6.3M10.1 13.4 7 15.8M13.9 13.4 17 15.8" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2.4" />
        <circle cx="12" cy="4.6" r="1.7" />
        <circle cx="5.6" cy="16.8" r="1.7" />
        <circle cx="18.4" cy="16.8" r="1.7" />
      </g>
    </Svg>
  );
}

/** Control — full-auto or approve-before-send: a toggle you set. */
export function ControlIcon({ className }: { className?: string }) {
  return (
    <Svg className={className}>
      <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" fill="currentColor" opacity="0.12" />
      <g {...STROKE}>
        <rect x="3.5" y="8.5" width="17" height="7" rx="3.5" />
      </g>
      <circle cx="14.5" cy="12" r="2.4" fill="currentColor" />
    </Svg>
  );
}
