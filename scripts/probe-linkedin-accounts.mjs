/**
 * Live shape probe for the provider's accounts endpoint. Not part of CI (needs real
 * credentials — see docs/roadmap.md Phase 5). Prints field names, types and comparisons
 * rather than profile values, to confirm what the wire actually carries: the reconcile's
 * adoption rule depends on created_at, and on the fact that the hosted-auth `name`
 * metadata does NOT survive here (it comes back as the LinkedIn profile name).
 *
 *   node --env-file=apps/web/.env.local scripts/probe-linkedin-accounts.mjs
 */
const { UNIPILE_DSN, UNIPILE_API_KEY } = process.env;
if (!UNIPILE_DSN || !UNIPILE_API_KEY) {
  console.error("UNIPILE_DSN / UNIPILE_API_KEY not set");
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const res = await fetch(`https://${UNIPILE_DSN}/api/v1/accounts`, {
  headers: { "x-api-key": UNIPILE_API_KEY, "Content-Type": "application/json" },
  signal: AbortSignal.timeout(15_000),
});
console.log("HTTP", res.status);
if (!res.ok) {
  console.error((await res.text()).slice(0, 300));
  process.exit(1);
}

const body = await res.json();
console.log("top-level keys:", Object.keys(body));
console.log("has cursor field:", "cursor" in body, "| cursor is null:", body.cursor === null);

const items = Array.isArray(body.items) ? body.items : [];
console.log("items:", items.length);

const linkedin = items.filter((a) => a?.type === "LINKEDIN");
console.log("linkedin items:", linkedin.length);

for (const [i, a] of linkedin.entries()) {
  console.log(`\n--- linkedin account #${i} ---`);
  console.log("keys:", Object.keys(a));
  console.log("name is uuid (tenant attribution present):", typeof a.name === "string" && UUID_RE.test(a.name));
  console.log("name length:", typeof a.name === "string" ? a.name.length : null);
  console.log("created_at:", a.created_at);
  console.log("name === im.username:", a.name === a.connection_params?.im?.username);
  console.log("name === im.publicIdentifier:", a.name === a.connection_params?.im?.publicIdentifier);
  console.log("name === im.id:", a.name === a.connection_params?.im?.id);
  console.log("name looks like a person (has a space):", typeof a.name === "string" && a.name.includes(" "));
  console.log("groups:", JSON.stringify(a.groups));
  console.log("has sources:", "sources" in a, "| sources is array:", Array.isArray(a.sources));
  console.log("source statuses:", Array.isArray(a.sources) ? a.sources.map((s) => s?.status) : null);
  console.log("connection_params keys:", a.connection_params ? Object.keys(a.connection_params) : null);
  console.log("im keys:", a.connection_params?.im ? Object.keys(a.connection_params.im) : null);
  console.log("has publicIdentifier:", Boolean(a.connection_params?.im?.publicIdentifier));
}
