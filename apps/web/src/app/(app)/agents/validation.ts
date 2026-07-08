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

  // Booking link (optional): the agent offers it once a prospect shows interest in talking —
  // without one, interested conversations dead-end at "worth a call?" (0044).
  const bookingUrl = String(form.get("bookingUrl") ?? "").trim();
  if (bookingUrl && !/^https?:\/\/\S+$/.test(bookingUrl)) {
    return { ok: false, error: "The booking link must start with http(s)://" };
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

  return { ok: true, values: { name, cta, bookingUrl: bookingUrl || null, links, channels, sendMode } };
}

// ─── Intent agent validation (Phase 13) ───────────────────────────────────────

export const MAX_WATCH_PER_LIST = 10;

export type IntentFormValues = {
  name: string;
  watch: { creators: string[]; competitors: string[]; keywords: string[]; hashtags: string[] };
  signals: { engagement: boolean; content: boolean };
  runAtTime: string;
  cadence: "daily" | "weekly";
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
  };
  if (!signals.engagement && !signals.content) {
    return { ok: false, error: "Enable at least one intent signal (engagement or content)." };
  }

  const runAtTime = String(form.get("runAtTime") ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(runAtTime)) return { ok: false, error: "Pick a valid run time." };
  const cadence = String(form.get("cadence") ?? "");
  if (cadence !== "daily" && cadence !== "weekly") return { ok: false, error: "Pick a cadence." };
  const timezone = String(form.get("timezone") ?? "").trim() || "UTC";

  return { ok: true, values: { name, watch, signals, runAtTime, cadence, timezone } };
}
