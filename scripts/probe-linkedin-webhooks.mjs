/**
 * Read-only: what webhooks does the provider currently have registered, and for which
 * sources? The stored-event history shows messaging and users events arriving but zero
 * account_status ones — this says whether that source is registered at all.
 *
 * Prints URLs and sources (no secrets).
 *
 *   node --env-file=apps/web/.env.local scripts/probe-linkedin-webhooks.mjs
 */
const { UNIPILE_DSN, UNIPILE_API_KEY } = process.env;
if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
  console.error("UNIPILE_DSN / UNIPILE_API_KEY not set");
  process.exit(1);
}

const res = await fetch(`https://${UNIPILE_DSN}/api/v1/webhooks`, {
  headers: { "x-api-key": UNIPILE_API_KEY, "Content-Type": "application/json" },
  signal: AbortSignal.timeout(15_000),
});
console.log("HTTP", res.status);
if (!res.ok) {
  console.error((await res.text()).slice(0, 300));
  process.exit(1);
}

const body = await res.json();
const items = [...(Array.isArray(body.items) ? body.items : []), ...(Array.isArray(body.webhooks) ? body.webhooks : [])];
console.log("registered webhooks:", items.length, "\n");

for (const w of items) {
  console.log("source:      ", w.source ?? "(none)");
  console.log("request_url: ", w.request_url ?? "(none)");
  console.log("name:        ", w.name ?? "(none)");
  console.log("enabled:     ", w.enabled ?? w.status ?? "(unspecified)");
  console.log("header keys: ", Array.isArray(w.headers) ? w.headers.map((h) => h.key ?? h.name) : Object.keys(w.headers ?? {}));
  console.log("---");
}

const sources = new Set(items.map((w) => w.source));
console.log("\nsources registered:", [...sources]);
for (const required of ["messaging", "users", "account_status"]) {
  console.log(`  ${required}: ${sources.has(required) ? "OK" : "MISSING"}`);
}
