/**
 * Gate for the open-ended openerAngle knob (Stage 1b). The angle is a STYLE directive — it may
 * steer what the opener is angled around, never what is claimed. Anything that could smuggle a
 * number, price, or promise into a draft prompt is rejected here, before it can ever become a
 * challenger. Pure.
 */
const MIN_LEN = 8;
const MAX_LEN = 80;
const CLAIM_WORDS = /\b(guarantee[ds]?|promise[ds]?|proven to|results? in|roi)\b/i;

/** Returns null when the angle is safe to test; otherwise the rejection reason. */
export function validateRecipeAngle(angle: string): string | null {
  const a = angle.trim();
  if (a.length < MIN_LEN || a.length > MAX_LEN) {
    return `angle length must be ${MIN_LEN}-${MAX_LEN} chars`;
  }
  if (/[0-9%$]/.test(a)) return "angle may not contain numbers or money/percent symbols (claim risk)";
  if (CLAIM_WORDS.test(a)) return "angle may not contain claim/guarantee language";
  return null;
}
