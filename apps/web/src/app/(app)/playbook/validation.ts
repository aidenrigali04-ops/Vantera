export const MAX_ICPS = 3;

export type ScoutFormValues = {
  name: string;
  icps: string[];
  runAtTime: string;
  cadence: "daily" | "weekly";
  timezone: string;
};

export type CopyFormValues = {
  name: string;
  cta: string;
  /** optional meeting-booking URL the agent may offer once a prospect shows interest */
  bookingUrl: string | null;
  /** optional destination page (site/portfolio/product) for prospects who'd rather look than book */
  websiteUrl: string | null;
  links: string[];
  channels: { linkedin: boolean };
  sendMode: "review" | "automatic";
};

type Result<T> = { ok: true; values: T } | { ok: false; error: string };

function cleanName(raw: unknown): string | null {
  const name = String(raw ?? "").trim();
  return name.length >= 1 && name.length <= 60 ? name : null;
}

export function parseScoutForm(form: FormData): Result<ScoutFormValues> {
  const name = cleanName(form.get("name"));
  if (!name) return { ok: false, error: "Give your agent a name (up to 60 characters)." };

  let icps: string[];
  try {
    const parsed: unknown = JSON.parse(String(form.get("icps") ?? "[]"));
    icps = Array.isArray(parsed)
      ? [...new Set(parsed.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))]
      : [];
  } catch {
    icps = [];
  }
  if (icps.length === 0) return { ok: false, error: "Pick at least one ICP to target." };
  if (icps.length > MAX_ICPS) return { ok: false, error: `Pick at most ${MAX_ICPS} ICPs.` };
  if (icps.some((i) => i.length > 120)) {
    return { ok: false, error: "Keep each ICP under 120 characters." };
  }

  const runAtTime = String(form.get("runAtTime") ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(runAtTime)) {
    return { ok: false, error: "Pick a valid run time." };
  }

  const cadence = String(form.get("cadence") ?? "");
  if (cadence !== "daily" && cadence !== "weekly") {
    return { ok: false, error: "Pick a cadence." };
  }

  const timezone = String(form.get("timezone") ?? "").trim() || "UTC";

  return { ok: true, values: { name, icps, runAtTime, cadence, timezone } };
}

export function parseCopyForm(form: FormData): Result<CopyFormValues> {
  const name = cleanName(form.get("name"));
  if (!name) return { ok: false, error: "Give your agent a name (up to 60 characters)." };

  const cta = String(form.get("cta") ?? "").trim();
  if (cta.length < 3 || cta.length > 200) {
    return { ok: false, error: "Describe your call to action (3–200 characters)." };
  }

  // Interest destinations (both optional): the agent offers the one matching what the
  // prospect wants — booking when they want to talk, the website when they'd rather look.
  // Traffic-first businesses can run on the website link alone (0044).
  const bookingUrl = String(form.get("bookingUrl") ?? "").trim();
  if (bookingUrl && !/^https?:\/\/\S+$/.test(bookingUrl)) {
    return { ok: false, error: "The booking link must start with http(s)://" };
  }
  const websiteUrl = String(form.get("websiteUrl") ?? "").trim();
  if (websiteUrl && !/^https?:\/\/\S+$/.test(websiteUrl)) {
    return { ok: false, error: "The website link must start with http(s)://" };
  }

  const links = String(form.get("links") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (links.some((l) => !/^https?:\/\/\S+$/.test(l))) {
    return { ok: false, error: "Content links must start with http(s)://" };
  }
  if (links.length > 5) return { ok: false, error: "Add at most 5 links." };

  // LinkedIn is the only channel — always enabled (no per-channel toggle).
  const channels = { linkedin: true };

  // send mode defaults to review; only review/automatic are valid (rule 08 —
  // manual + user-drafted modes are deferred to a later phase)
  const rawMode = form.get("sendMode");
  const sendMode = rawMode == null || rawMode === "" ? "review" : String(rawMode);
  if (sendMode !== "review" && sendMode !== "automatic") {
    return { ok: false, error: "Pick how this agent sends." };
  }

  return {
    ok: true,
    values: { name, cta, bookingUrl: bookingUrl || null, websiteUrl: websiteUrl || null, links, channels, sendMode },
  };
}

// ─── Intent agent validation (Phase 13) ───────────────────────────────────────

export const MAX_WATCH_PER_LIST = 10;

export type IntentFormValues = {
  name: string;
  watch: { creators: string[]; competitors: string[]; keywords: string[]; hashtags: string[] };
  signals: { engagement: boolean; content: boolean; follows: boolean };
  runAtTime: string;
  cadence: "daily" | "weekly" | "intraday";
  timezone: string;
};

function parseList(form: FormData, key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(String(form.get(key) ?? "[]"));
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean))].slice(0, MAX_WATCH_PER_LIST)
      : [];
  } catch {
    return [];
  }
}

export function parseIntentForm(form: FormData): Result<IntentFormValues> {
  const name = cleanName(form.get("name"));
  if (!name) return { ok: false, error: "Give your agent a name (up to 60 characters)." };

  const watch = {
    creators: parseList(form, "creators"),
    competitors: parseList(form, "competitors"),
    keywords: parseList(form, "keywords"),
    hashtags: parseList(form, "hashtags").map((h) => (h.startsWith("#") ? h : `#${h}`)),
  };
  const total = watch.creators.length + watch.competitors.length + watch.keywords.length + watch.hashtags.length;
  if (total === 0) {
    return { ok: false, error: "Add at least one creator, competitor, keyword, or hashtag to watch." };
  }
  // Creators are LinkedIn profile URLs (a specific person's posts). Competitors may be a company
  // NAME or a LinkedIn URL — a name is watched as a search query, a URL profile-watched (intent-scan),
  // so the auto-derived watchlist (competitor names, no URLs) deploys with zero hunting.
  if (watch.creators.some((u) => !/^https?:\/\/(www\.)?linkedin\.com\/in\//i.test(u))) {
    return { ok: false, error: "Creators must be LinkedIn profile URLs (linkedin.com/in/…)." };
  }
  if (watch.competitors.some((c) => c.length > 120)) {
    return { ok: false, error: "Keep each competitor name under 120 characters." };
  }

  const signals = {
    engagement: form.get("signalEngagement") === "on",
    content: form.get("signalContent") === "on",
    follows: form.get("signalFollows") === "on",
  };
  if (!signals.engagement && !signals.content && !signals.follows) {
    return { ok: false, error: "Enable at least one intent signal (engagement, content, or followers)." };
  }

  const runAtTime = String(form.get("runAtTime") ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(runAtTime)) return { ok: false, error: "Pick a valid run time." };
  const cadence = String(form.get("cadence") ?? "");
  if (cadence !== "daily" && cadence !== "weekly" && cadence !== "intraday") return { ok: false, error: "Pick a cadence." };
  const timezone = String(form.get("timezone") ?? "").trim() || "UTC";

  return { ok: true, values: { name, watch, signals, runAtTime, cadence, timezone } };
}

/** The agents.config shape for an Intent agent — one builder for deploy and edit, so the scanner's
 *  reader (getIntentContext) sees identical keys either way. min_score = the rule-06 default bar. */
export function intentConfig(values: Pick<IntentFormValues, "watch" | "signals">) {
  return { watch: values.watch, signals: values.signals, min_score: 70 };
}

/** The wizard's hidden form fields for a set of values — the inverse of parseIntentForm. */
export function intentFormFields(values: IntentFormValues): [string, string][] {
  const fields: [string, string][] = [
    ["name", values.name],
    ["creators", JSON.stringify(values.watch.creators)],
    ["competitors", JSON.stringify(values.watch.competitors)],
    ["keywords", JSON.stringify(values.watch.keywords)],
    ["hashtags", JSON.stringify(values.watch.hashtags)],
  ];
  if (values.signals.engagement) fields.push(["signalEngagement", "on"]);
  if (values.signals.content) fields.push(["signalContent", "on"]);
  if (values.signals.follows) fields.push(["signalFollows", "on"]);
  fields.push(["runAtTime", values.runAtTime], ["cadence", values.cadence], ["timezone", values.timezone]);
  return fields;
}

// ── ML-5 targeting rules (Scout agents.config.targeting) ─────────────────────────────────────
export const TARGETING_LIST_MAX = 50;
export const TARGETING_ENTRY_MAX = 80;
export const TARGETING_GUIDANCE_MAX = 500;

export type TargetingFormValues = {
  excludeAgencies: boolean;
  excludeFreelancers: boolean;
  competitors: string[];
  customers: string[];
  companies: string[];
  keywords: string[];
  guidance: string | null;
};

/** One entry per line (commas also split for keywords — company names keep theirs: "Acme, Inc."),
 *  trimmed + deduped case-insensitively. */
function splitList(raw: unknown, commas: boolean): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of String(raw ?? "").split(commas ? /[\n,]/ : /\n/)) {
    const t = part.trim().replace(/\s+/g, " ");
    if (!t || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
  }
  return out;
}

const LIST_LABELS = { competitors: "competitors", customers: "existing customers", companies: "companies", keywords: "keywords" } as const;

export function parseTargetingForm(form: FormData): Result<TargetingFormValues> {
  const lists = {} as Record<keyof typeof LIST_LABELS, string[]>;
  for (const key of Object.keys(LIST_LABELS) as (keyof typeof LIST_LABELS)[]) {
    const list = splitList(form.get(key), key === "keywords");
    if (list.length > TARGETING_LIST_MAX) {
      return { ok: false, error: `Keep ${LIST_LABELS[key]} to ${TARGETING_LIST_MAX} entries.` };
    }
    if (list.some((e) => e.length > TARGETING_ENTRY_MAX)) {
      return { ok: false, error: `Keep each of your ${LIST_LABELS[key]} under ${TARGETING_ENTRY_MAX} characters.` };
    }
    lists[key] = list;
  }
  const guidance = String(form.get("guidance") ?? "").trim();
  if (guidance.length > TARGETING_GUIDANCE_MAX) {
    return { ok: false, error: `Keep your guidance under ${TARGETING_GUIDANCE_MAX} characters.` };
  }
  return {
    ok: true,
    values: {
      excludeAgencies: form.get("excludeAgencies") === "on",
      excludeFreelancers: form.get("excludeFreelancers") === "on",
      ...lists,
      guidance: guidance || null,
    },
  };
}
