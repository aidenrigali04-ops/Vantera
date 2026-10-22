/**
 * Single source for the marketing claims that must read IDENTICALLY everywhere they
 * appear (blueprint §8: one time claim, one custody sentence).
 * Every below-fold section imports from here — never restate these inline, so a copy
 * edit lands site-wide at once and the claims can't drift apart.
 *
 * Numbers come from locked product rules, not aspiration:
 * - SETUP:   owner, 2026-10-20 — onboarding takes about 3 minutes. Outreach then runs
 *            on autopilot (no per-message approval), with machine-learned targeting.
 * - CEILING: rules 04/11 — ~100 invites/week, non-configurable below safe thresholds.
 * - Custody: rule 04 — hosted LinkedIn sign-in; white-label, so no vendor is named.
 * - Price:   never hardcoded — flows from @vantera/billing via props (page.tsx).
 */

/** The one time claim: minutes from website to agents at work (onboarding). */
export const ONBOARDING_MINUTES = 3;

/** The one custody sentence (white-label: describes the mechanism, names no vendor). */
export const CUSTODY_SENTENCE =
  "You sign in through LinkedIn's own flow — your password never touches Vantera.";

/** The safety ceiling, stated once (rule 04/11). */
export const CEILING_FACT = "~100 invites / week";

/** CTA label + destination, identical on every below-fold conversion point. */
export const CTA_LABEL = "Get Started Free";
export const CTA_HREF = "/signup";

/** Reassurance line under primary CTAs (two claims max, ` · ` separated). */
export const CTA_REASSURANCE = "Free 7-day trial · Cancel anytime";

/** LinkedIn disclaimer — every page's footer. */
export const LINKEDIN_DISCLAIMER =
  "Vantera is not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.";
