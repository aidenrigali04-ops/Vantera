import {
  CalendarCheck,
  ChevronRight,
  CreditCard,
  Link2,
  type LucideIcon,
  MessageSquare,
  PenLine,
  Play,
  Plug,
  Sparkles,
  SquareCheck,
  Unplug,
  UserRound,
  X,
} from "lucide-react";

import type { TileGlyph } from "@/lib/today/tiles";

/**
 * The Today glyph set, addressed by name so server components can hand a glyph to a client
 * component as a plain string (a component reference would not serialize). One stroke
 * weight everywhere (1.75); size is the caller's.
 */

export type GlyphName = TileGlyph | "chevron-right" | "x";

export const GLYPH_STROKE = 1.75;

const GLYPHS: Record<GlyphName, LucideIcon> = {
  unplug: Unplug,
  "credit-card": CreditCard,
  "check-square": SquareCheck,
  "message-square": MessageSquare,
  "user-round": UserRound,
  "calendar-check": CalendarCheck,
  play: Play,
  sparkles: Sparkles,
  "pen-line": PenLine,
  plug: Plug,
  link: Link2,
  "chevron-right": ChevronRight,
  x: X,
};

export function glyphFor(name: GlyphName): LucideIcon {
  return GLYPHS[name];
}

export function Glyph({ name, size, className }: { name: GlyphName; size: number; className?: string }) {
  const Icon = GLYPHS[name];
  return <Icon size={size} strokeWidth={GLYPH_STROKE} className={className} aria-hidden="true" focusable="false" />;
}
