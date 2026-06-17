export type AdFormValues = {
  name: string;
  offer: string;
  targetIcp: string;
  cta: string;
  variants: number;
};

export const AD_VARIANTS_MAX = 5;

type Result<T> = { ok: true; values: T } | { ok: false; error: string };

function field(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** Pure validation for the ad-generation form (rule 13 piece 3). */
export function parseAdForm(form: FormData): Result<AdFormValues> {
  const name = field(form, "name");
  if (name.length < 1 || name.length > 60) {
    return { ok: false, error: "Give your campaign a name (up to 60 characters)." };
  }
  const offer = field(form, "offer");
  if (offer.length < 3 || offer.length > 200) {
    return { ok: false, error: "Describe the offer this ad promotes (3–200 characters)." };
  }
  const targetIcp = field(form, "targetIcp");
  if (targetIcp.length < 3 || targetIcp.length > 200) {
    return { ok: false, error: "Describe who this ad targets (3–200 characters)." };
  }
  const cta = field(form, "cta");
  if (cta.length < 3 || cta.length > 200) {
    return { ok: false, error: "Describe what a click should lead to (3–200 characters)." };
  }
  const rawVariants = form.get("variants");
  const variants = rawVariants != null && String(rawVariants) !== "" ? parseInt(String(rawVariants), 10) : 3;
  if (isNaN(variants) || variants < 1 || variants > AD_VARIANTS_MAX) {
    return { ok: false, error: `Generate between 1 and ${AD_VARIANTS_MAX} concepts.` };
  }
  return { ok: true, values: { name, offer, targetIcp, cta, variants } };
}
