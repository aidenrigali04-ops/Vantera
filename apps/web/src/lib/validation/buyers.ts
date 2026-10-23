import type { TargetingRules } from "@vantera/agent-brains";
import { parseTargetingForm } from "@/app/(app)/playbook/validation";

/**
 * "Your buyers" — the drafted ICP made editable (onboarding step 2, and later the Playbook
 * targeting page). Pure: no network, no DB, and no runtime import of `@vantera/agent-brains`,
 * so the client editor can share the caps and buckets without pulling a brain into the bundle.
 */

export type BuyersFormValues = {
  name: string;
  criteria: { titles: string[]; industries: string[]; companySizes: string[]; geos: string[]; signals: string[] };
  targeting: TargetingRules;
};

export type BuyersResult<T> = { ok: true; values: T } | { ok: false; error: string };

/** Same caps as the ICP drafter (`packages/agent-brains/src/prospect/icp-draft.ts`). */
export const BUYERS_CAPS = { titles: 6, industries: 4, companySizes: 4, geos: 3, signals: 5, entry: 60 } as const;

/** Mirror of `ICP_SIZE_BUCKETS` (kept in lockstep by buyers.test.ts) — the headcount buckets discovery understands. */
export const BUYERS_SIZE_BUCKETS = ["1-10", "11-50", "51-200", "200+"] as const;

const NAME_MIN = 2;
const NAME_MAX = 80;

type ChipKey = "titles" | "industries" | "companySizes" | "geos" | "signals";

/** Repeated `<key>[]` fields → trimmed, whitespace-collapsed, length-capped, deduped, count-capped. */
function readChips(form: FormData, key: ChipKey): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of form.getAll(`${key}[]`)) {
    if (typeof raw !== "string") continue;
    const v = raw.trim().replace(/\s+/g, " ").slice(0, BUYERS_CAPS.entry).trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= BUYERS_CAPS[key]) break;
  }
  return out;
}

/** Exclusions default ON: only an explicit non-"on" value (the editor sends "off") turns one off. */
function exclusion(form: FormData, key: "excludeAgencies" | "excludeFreelancers"): boolean {
  return form.has(key) ? form.get(key) === "on" : true;
}

export function parseBuyersForm(form: FormData): BuyersResult<BuyersFormValues> {
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return { ok: false, error: `Give your buyer profile a name (${NAME_MIN}–${NAME_MAX} characters).` };
  }

  const allowedSizes = new Set<string>(BUYERS_SIZE_BUCKETS);
  const sizes = form.getAll("companySizes[]").map((s) => String(s).trim()).filter(Boolean);
  if (sizes.some((s) => !allowedSizes.has(s))) {
    return { ok: false, error: `Pick company sizes from ${BUYERS_SIZE_BUCKETS.join(", ")}.` };
  }

  const targeting = parseTargetingForm(form);
  if (!targeting.ok) return targeting;

  return {
    ok: true,
    values: {
      name,
      criteria: {
        titles: readChips(form, "titles"),
        industries: readChips(form, "industries"),
        companySizes: readChips(form, "companySizes"),
        geos: readChips(form, "geos"),
        signals: readChips(form, "signals"),
      },
      targeting: {
        ...targeting.values,
        excludeAgencies: exclusion(form, "excludeAgencies"),
        excludeFreelancers: exclusion(form, "excludeFreelancers"),
      },
    },
  };
}
