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

  return { ok: true, values: { name, cta, links, channels } };
}
