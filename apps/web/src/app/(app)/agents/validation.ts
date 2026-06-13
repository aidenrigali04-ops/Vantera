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
  recordingConsentMode: "one_party" | "two_party";
  callingWindow: { days: string[]; startLocal: string; endLocal: string };
  maxAttempts: number;
}

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
