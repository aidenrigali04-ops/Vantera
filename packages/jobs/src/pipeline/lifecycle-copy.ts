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

const TEMPLATES: Record<LifecycleSegment, { touch1: Builder[]; touch2: Builder[] }> = {
  stalled_onboarding: {
    touch1: [
      (d) =>
        `${greet(d.firstName)} saw you started setting up Vantera but stopped at ${d.stalledStep ?? "the setup"}. You're about 2 minutes from your scout agent finding leads for you. Anything trip you up?`,
      (d) =>
        `${greet(d.firstName)} noticed your Vantera setup didn't get finished. It takes about 2 more minutes to get your scout hunting. Happy to walk you through it if something felt off.`,
    ],
    touch2: [
      () =>
        `Quick follow up. Your Vantera account is still sitting there half set up. If something felt confusing I'd genuinely like to know what it was.`,
      () =>
        `Following up once more. Your account is created and the last steps take a couple of minutes. If the setup lost you somewhere, tell me where and I'll fix it.`,
    ],
  },
  idle_after_onboarding: {
    touch1: [
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} your scout agent found ${d.leadCount} leads since you set it up and ${d.qualifiedCount} passed your qualification bar. They're in your dashboard when you have a minute.`
          : `${greet(d.firstName)} you finished setting up Vantera but I don't think you've been back in. Anything holding you up? Happy to help you get your first leads flowing.`,
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} quick note, there are ${d.leadCount} leads waiting in your Vantera dashboard that I don't think you've seen yet. Worth a look.`
          : `${greet(d.firstName)} you got through the Vantera setup but haven't been back since. If something didn't click, I'd like to hear it.`,
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
          ? `${greet(d.firstName)} your Vantera trial wrapped up. While it ran, your scout found ${d.leadCount} leads and ${d.qualifiedCount} qualified. They're going cold sitting there. Want me to turn it back on for you?`
          : `${greet(d.firstName)} your Vantera trial ended before it really got going. If 3 days was too short to see value, tell me and I'll extend it.`,
      (d) =>
        d.leadCount > 0
          ? `${greet(d.firstName)} your trial ended with ${d.leadCount} leads found and ${d.qualifiedCount} qualified. That pipeline is just parked now. Happy to restart it if you want to keep going.`
          : `${greet(d.firstName)} your Vantera trial expired. If it didn't get a fair shot in 3 days, say the word and I'll extend it.`,
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
