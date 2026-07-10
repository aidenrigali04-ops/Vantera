import type { LifecycleSegment } from "./types";

/**
 * Founder-voice lifecycle messages (0045) — operator-side, NOT prospect outreach. The
 * agent-brains copy path is tuned for cold prospects and its pitch machinery is wrong for
 * our own users, so these are deterministic templates: short, plain, zero dashes, honest,
 * no fake personalization (repositioning copy guard). Count-based lines REQUIRE real
 * per-account counts; leadCount 0 always takes the count-free variant.
 */
export interface LifecycleMergeData {
  firstName: string | null;
  stalledStep: string | null;
  leadCount: number;
  qualifiedCount: number;
}

const greet = (first: string | null) => (first ? `Hey ${first},` : "Hey,");

type Builder = (d: LifecycleMergeData) => string;

// Touch 1 is a FIRST contact: it always says who's messaging (founder identification —
// owner directive 2026-07-09: "this is the CEO of Vantera") and, for stalled signups,
// that everything is saved so they can continue right where they left off.
const TEMPLATES: Record<LifecycleSegment, { touch1: Builder[]; touch2: Builder[] }> = {
  stalled_onboarding: {
    touch1: [
      (d) =>
        `${greet(d.firstName)} Aiden here, I run Vantera. Noticed you started setting up your account but stopped at ${d.stalledStep ?? "the setup"}. Everything is saved, so you can pick up right where you left off at vanterasystem.dev. Anything I can help with?`,
      (d) =>
        `${greet(d.firstName)} this is Aiden, CEO of Vantera. Saw your setup didn't get finished. It takes about 2 more minutes to get your scout hunting, and it resumes right where you left off. If something felt off, tell me and I'll fix it.`,
    ],
    touch2: [
      () =>
        `Quick follow up. Your Vantera account is still sitting there half set up, and it resumes right where you left off at vanterasystem.dev. If something felt confusing I'd genuinely like to know what it was.`,
      () =>
        `Following up once more. Your account is saved and the last steps take a couple of minutes. If the setup lost you somewhere, tell me where and I'll fix it.`,
    ],
  },
  idle_after_onboarding: {
    touch1: [
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} Aiden here, I run Vantera. Your scout agent found ${d.leadCount} leads since you set it up${d.qualifiedCount > 0 ? ` and ${d.qualifiedCount} passed your qualification bar` : ""}. They're in your dashboard when you have a minute.`
          : `${greet(d.firstName)} Aiden here, I run Vantera. You finished setting up but I don't think you've been back in. Anything holding you up? Happy to help you get your first leads flowing.`,
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} this is Aiden, CEO of Vantera. Quick note, there are ${d.leadCount} leads waiting in your dashboard that I don't think you've seen yet. Worth a look.`
          : `${greet(d.firstName)} this is Aiden, CEO of Vantera. You got through the setup but haven't been back since. If something didn't click, I'd like to hear it.`,
    ],
    touch2: [
      () =>
        `Those leads are still waiting in your dashboard. If the product didn't click for you I'd rather hear it straight, it helps me build the right thing.`,
      () =>
        `One more nudge from me. Your agents are set up and working, you just haven't seen the results yet. Log in once and see if it's useful. If not, tell me why.`,
    ],
  },
  trial_lapsed: {
    touch1: [
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} Aiden here, I run Vantera. Your trial wrapped up. While it ran, your scout found ${d.leadCount} leads${d.qualifiedCount > 0 ? ` and ${d.qualifiedCount} qualified` : ""}. They're going cold sitting there. Want me to turn it back on for you?`
          : `${greet(d.firstName)} Aiden here, I run Vantera. Your trial ended before it really got going. If 3 days was too short to see value, tell me and I'll extend it.`,
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} this is Aiden, CEO of Vantera. Your trial ended with ${d.leadCount} leads found${d.qualifiedCount > 0 ? ` and ${d.qualifiedCount} qualified` : ""}. That pipeline is just parked now. Happy to restart it if you want to keep going.`
          : `${greet(d.firstName)} this is Aiden, CEO of Vantera. Your trial expired. If it didn't get a fair shot in 3 days, say the word and I'll extend it.`,
    ],
    touch2: [
      () =>
        `Last note from me. If Vantera wasn't the right fit I'd love to know why, even one line helps. If it was just timing, your account is still here.`,
      () =>
        `Closing the loop on my last message. No pitch, I just want to know what would have made Vantera worth keeping. One line back helps me a lot.`,
    ],
  },
};

/** First name from a display name; single-char junk rejected. */
export function firstNameOf(displayName: string | null): string | null {
  const first = displayName?.trim().split(/\s+/)[0];
  return first && first.length > 1 ? first : null;
}

/** Deterministic per-user variant pick — the same user always sees the same variant. */
export function buildLifecycleMessage(
  segment: LifecycleSegment,
  touchNumber: 1 | 2,
  data: LifecycleMergeData,
  variantSeed: number
): string {
  const variants = TEMPLATES[segment][touchNumber === 1 ? "touch1" : "touch2"];
  return variants[Math.abs(variantSeed) % variants.length]!(data);
}
