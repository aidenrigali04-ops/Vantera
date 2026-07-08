// Business-hours send window (2026-07-08 copy/conversion analysis): 62% of all sends had
// gone out on weekends because nothing gated timing, while the reply data favors weekday
// business hours (weekday sends answered ~2x faster; weekend + late-night automation bursts
// are also a LinkedIn anomaly signal). PROACTIVE sequence sends wait for the prospect's
// working hours; replies to a live prospect and human-typed messages are exempt — answering
// promptly at any hour is human.

/** Mon–Fri, 08:00–16:59 in the PROSPECT's local time. */
export const SEND_WINDOW = { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 17 } as const;

/**
 * Best-effort IANA timezone from the free-text lead location the profile scrape returns
 * ("Doha, Qatar", "Austin, Texas, United States", "Remote"). Keyword table over the markets
 * the accounts actually sell into + the big anglosphere regions; unknown → null (caller
 * falls back to UTC, which keeps the weekend gate and a sane 8–17 UTC band).
 */
const TZ_KEYWORDS: [RegExp, string][] = [
  [/qatar|doha/i, "Asia/Qatar"],
  [/saudi|riyadh|jeddah|ksa/i, "Asia/Riyadh"],
  [/united arab emirates|uae|dubai|abu dhabi/i, "Asia/Dubai"],
  [/kuwait/i, "Asia/Kuwait"],
  [/bahrain/i, "Asia/Bahrain"],
  [/oman|muscat/i, "Asia/Muscat"],
  [/egypt|cairo/i, "Africa/Cairo"],
  [/israel|tel aviv/i, "Asia/Jerusalem"],
  [/india|mumbai|bangalore|bengaluru|delhi|hyderabad|pune|chennai/i, "Asia/Kolkata"],
  [/pakistan|karachi|lahore|islamabad/i, "Asia/Karachi"],
  [/singapore/i, "Asia/Singapore"],
  [/indonesia|jakarta/i, "Asia/Jakarta"],
  [/philippines|manila/i, "Asia/Manila"],
  [/japan|tokyo/i, "Asia/Tokyo"],
  [/australia|sydney|melbourne/i, "Australia/Sydney"],
  [/united kingdom|london|england|scotland|\buk\b/i, "Europe/London"],
  [/ireland|dublin/i, "Europe/Dublin"],
  [/france|paris/i, "Europe/Paris"],
  [/germany|berlin|munich/i, "Europe/Berlin"],
  [/netherlands|amsterdam/i, "Europe/Amsterdam"],
  [/spain|madrid|barcelona/i, "Europe/Madrid"],
  [/italy|milan|rome/i, "Europe/Rome"],
  [/sweden|stockholm/i, "Europe/Stockholm"],
  [/poland|warsaw/i, "Europe/Warsaw"],
  [/brazil|são paulo|sao paulo/i, "America/Sao_Paulo"],
  [/argentina|buenos aires/i, "America/Argentina/Buenos_Aires"],
  [/mexico/i, "America/Mexico_City"],
  // US regions — coarse but right to within an hour, which is all a send window needs
  [/california|san francisco|los angeles|seattle|washington state|oregon|nevada/i, "America/Los_Angeles"],
  [/texas|austin|dallas|houston|chicago|illinois|minnesota|missouri|denver|colorado|utah|arizona|phoenix/i, "America/Chicago"],
  [/new york|boston|massachusetts|florida|miami|atlanta|georgia|virginia|philadelphia|new jersey|north carolina|ohio|michigan|pennsylvania|toronto|ontario|canada/i, "America/New_York"],
  [/united states|usa\b/i, "America/Chicago"], // continental midpoint when only the country is known
];

export function timezoneForLocation(location: string | null | undefined): string | null {
  if (!location) return null;
  for (const [pattern, tz] of TZ_KEYWORDS) {
    if (pattern.test(location)) return tz;
  }
  return null;
}

/** Local weekday (0=Sun) + hour for `now` in `timeZone`, via the Intl database. */
function localParts(now: Date, timeZone: string): { day: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hour12: false });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { day: day === -1 ? 1 : day, hour: hour === 24 ? 0 : hour };
}

/** Is `now` inside the prospect's proactive-send window? Unknown location → UTC. */
export function isWithinSendWindow(now: Date, location: string | null | undefined): boolean {
  const tz = timezoneForLocation(location) ?? "UTC";
  const { day, hour } = localParts(now, tz);
  return (SEND_WINDOW.days as readonly number[]).includes(day) && hour >= SEND_WINDOW.startHour && hour < SEND_WINDOW.endHour;
}
