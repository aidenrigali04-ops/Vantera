import type { ComponentType } from "react";

type Visual = ComponentType;
type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

/**
 * The pictures one feature page needs, after rankbox.xyz's per-feature visuals.tsx.
 * Every one is decorative sample UI (the section around it carries the meaning and
 * marks it aria-hidden), built from the landing's product-mock vocabulary.
 */
export interface FeatureVisuals {
  /** The product window on the painted sky, under the hero (max-w-5xl wide). */
  Window: Visual;
  /** One per benefit row: fills a h-[17rem] sm:h-[18.5rem] pastel panel. Lay the card
      out with ScreenCard (feature-row.tsx), which runs past the panel's foot. */
  benefits: readonly [Visual, Visual, Visual];
  /** Icons for the three benefit rows' tiles. */
  benefitIcons: readonly [Icon, Icon, Icon];
  /** One per step: a small picture inside a tinted well under the step's copy. */
  steps: readonly [Visual, Visual, Visual];
  /** The top of the window, rising out of the closing band's foot (cropped). */
  Peek: Visual;
}
