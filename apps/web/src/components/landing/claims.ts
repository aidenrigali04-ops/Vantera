/**
 * Single source for the marketing claims that must read IDENTICALLY everywhere they
 * appear (blueprint §8: one time claim, one custody sentence, one approval sentence).
 * Every below-fold section imports from here — never restate these inline, so a copy
 * edit lands site-wide at once and the claims can't drift apart.
 *
 * Numbers come from locked product rules, not aspiration:
 * - TIME:    rule 08 — a deployed agent's first run starts within ~15 minutes.
 * - CEILING: rules 04/11 — ~100 invites/week, non-configurable below safe thresholds.
 * - Custody: rule 04 — hosted LinkedIn sign-in; white-label, so no vendor is named.
 * - Price:   never hardcoded — flows from @vantera/billing via props (page.tsx).
 */

/** The one time claim. */
export const TIME_CLAIM = "about 15 minutes";

/** The one custody sentence (white-label: describes the mechanism, names no vendor). */
export const CUSTODY_SENTENCE =
  "You sign in through LinkedIn's own flow — your password never touches Vantera.";

/** The one approval sentence. */
export const APPROVAL_SENTENCE = "You approve every send.";

/** The safety ceiling, stated once (rule 04/11). */
export const CEILING_FACT = "~100 invites / week";

/** CTA label + destination, identical on every below-fold conversion point. */
export const CTA_LABEL = "Get started free";
export const CTA_HREF = "/signup";

/** Reassurance line under primary CTAs (two claims max, ` · ` separated). */
export const CTA_REASSURANCE = "Free 3-day trial · Cancel anytime";

/** LinkedIn disclaimer — every page's footer. */
export const LINKEDIN_DISCLAIMER =
  "Vantera is not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.";

/** Caption under every real-component product frame. */
export const FRAME_CAPTION = "Real product layout · Sample data";
