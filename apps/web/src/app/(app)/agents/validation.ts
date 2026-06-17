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
  links: string[];
  channels: { linkedin: boolean; email: boolean };
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

  const links = String(form.get("links") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (links.some((l) => !/^https?:\/\/\S+$/.test(l))) {
    return { ok: false, error: "Content links must start with http(s)://" };
  }
  if (links.length > 5) return { ok: false, error: "Add at most 5 links." };

  const channels = {
    linkedin: form.get("channelLinkedin") === "on",
    email: form.get("channelEmail") === "on",
  };
  if (!channels.linkedin && !channels.email) {
    return { ok: false, error: "Enable at least one channel." };
  }

  // send mode defaults to review; only review/automatic are valid (rule 08 —
  // manual + user-drafted modes are deferred to a later phase)
  const rawMode = form.get("sendMode");
  const sendMode = rawMode == null || rawMode === "" ? "review" : String(rawMode);
  if (sendMode !== "review" && sendMode !== "automatic") {
    return { ok: false, error: "Pick how this agent sends." };
  }

  return { ok: true, values: { name, cta, links, channels, sendMode } };
}

// ─── Caller agent validation ─────────────────────────────────────────────────

export const TCPA_EARLIEST = "08:00";
export const TCPA_LATEST = "21:00";
const MAX_ATTEMPTS_CEILING = 5;

export interface CallerConfigInput {
  cta: string;
  bookingLink: string;
  voice: { voiceId: string; personaName: string; language: string };
  brandVoice?: string;
  guardrails?: string;
  recordingConsentMode: "one_party" | "two_party";
  callingWindow: { days: string[]; startLocal: string; endLocal: string };
  maxAttempts: number;
}

/** brand voice / guardrails are free text — cap length so a stray paste can't bloat the call prompt */
export const BRAND_FIELD_MAX = 600;

export function clampCallingWindow(w: { days: string[]; startLocal: string; endLocal: string }) {
  const start = w.startLocal < TCPA_EARLIEST ? TCPA_EARLIEST : w.startLocal;
  const end = w.endLocal > TCPA_LATEST ? TCPA_LATEST : w.endLocal;
  return { days: w.days, startLocal: start, endLocal: end };
}

export function validateCallerConfig(c: CallerConfigInput): { ok: boolean; error?: string } {
  if (!c.cta.trim()) return { ok: false, error: "CTA is required" };
  try {
    const u = new URL(c.bookingLink);
    if (u.protocol !== "https:") return { ok: false, error: "Booking link must be https" };
  } catch {
    return { ok: false, error: "Booking link must be a valid URL" };
  }
  if (!c.voice.voiceId || !c.voice.personaName.trim()) return { ok: false, error: "Voice and persona name are required" };
  if (c.callingWindow.days.length === 0) return { ok: false, error: "Pick at least one calling day" };
  if (c.callingWindow.startLocal >= c.callingWindow.endLocal) return { ok: false, error: "Calling window start must precede end" };
  if (c.maxAttempts < 1 || c.maxAttempts > MAX_ATTEMPTS_CEILING) return { ok: false, error: `Max attempts must be 1-${MAX_ATTEMPTS_CEILING}` };
  return { ok: true };
}

export type CallerFormValues = CallerConfigInput & { name: string; links: string[] };

export function parseCallerForm(form: FormData): Result<CallerFormValues> {
  const name = cleanName(form.get("name"));
  if (!name) return { ok: false, error: "Give your agent a name (up to 60 characters)." };

  const cta = String(form.get("cta") ?? "").trim();
  if (!cta) return { ok: false, error: "Describe your call to action." };

  const bookingLink = String(form.get("bookingLink") ?? "").trim();

  const voiceId = String(form.get("voiceId") ?? "").trim();
  const personaName = String(form.get("personaName") ?? "").trim();
  const language = String(form.get("language") ?? "en-US").trim() || "en-US";

  const brandVoice = String(form.get("brandVoice") ?? "").trim().slice(0, BRAND_FIELD_MAX) || undefined;
  const guardrails = String(form.get("guardrails") ?? "").trim().slice(0, BRAND_FIELD_MAX) || undefined;

  const rawConsent = form.get("recordingConsentMode");
  const recordingConsentMode =
    rawConsent === "two_party" ? "two_party" : ("one_party" as const);

  let callingWindowDays: string[];
  try {
    const parsed: unknown = JSON.parse(String(form.get("callingWindowDays") ?? "[]"));
    callingWindowDays = Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    callingWindowDays = [];
  }

  const startLocal = String(form.get("startLocal") ?? "").trim();
  const endLocal = String(form.get("endLocal") ?? "").trim();

  const rawAttempts = form.get("maxAttempts");
  const maxAttempts = rawAttempts != null ? parseInt(String(rawAttempts), 10) : 3;

  const links = String(form.get("links") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (links.some((l) => !/^https?:\/\/\S+$/.test(l))) {
    return { ok: false, error: "Content links must start with http(s)://" };
  }
  if (links.length > 5) return { ok: false, error: "Add at most 5 links." };

  const values: CallerFormValues = {
    name,
    cta,
    bookingLink,
    voice: { voiceId, personaName, language },
    brandVoice,
    guardrails,
    recordingConsentMode,
    callingWindow: { days: callingWindowDays, startLocal, endLocal },
    maxAttempts: isNaN(maxAttempts) ? 3 : maxAttempts,
    links,
  };
  return { ok: true, values };
}

// ─── Responder agent validation (Phase 12 — fast inbound response) ────────────

/** SLA ceiling: a responder must answer fast or it's not a responder. Cap keeps the promise honest. */
export const RESPONDER_SLA_MAX = 1440; // 24h

export type ResponderFormValues = {
  name: string;
  cta: string;
  sendMode: "auto" | "review";
  slaMinutes: number;
  sources: { formFill: boolean; websiteVisitor: boolean; signal: boolean };
};

export function parseResponderForm(form: FormData): Result<ResponderFormValues> {
  const name = cleanName(form.get("name"));
  if (!name) return { ok: false, error: "Give your agent a name (up to 60 characters)." };

  const cta = String(form.get("cta") ?? "").trim();
  if (cta.length < 3 || cta.length > 200) {
    return { ok: false, error: "Describe what a reply should lead to (3–200 characters)." };
  }

  const rawMode = form.get("sendMode");
  const sendMode = rawMode == null || rawMode === "" ? "review" : String(rawMode);
  if (sendMode !== "auto" && sendMode !== "review") {
    return { ok: false, error: "Pick how this agent responds." };
  }

  const rawSla = form.get("slaMinutes");
  const slaMinutes = rawSla != null && String(rawSla) !== "" ? parseInt(String(rawSla), 10) : 5;
  if (isNaN(slaMinutes) || slaMinutes < 1 || slaMinutes > RESPONDER_SLA_MAX) {
    return { ok: false, error: `Response time must be 1–${RESPONDER_SLA_MAX} minutes.` };
  }

  const sources = {
    formFill: form.get("sourceFormFill") === "on",
    websiteVisitor: form.get("sourceWebsiteVisitor") === "on",
    signal: form.get("sourceSignal") === "on",
  };
  if (!sources.formFill && !sources.websiteVisitor && !sources.signal) {
    return { ok: false, error: "Enable at least one inbound source." };
  }

  return { ok: true, values: { name, cta, sendMode, slaMinutes, sources } };
}
