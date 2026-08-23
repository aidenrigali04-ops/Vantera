/**
 * Read-only health check on the LinkedIn connect path. Not part of CI (needs real
 * credentials). Answers two questions the code can't answer on its own:
 *
 *   1. Does the status webhook actually carry tenant attribution? The accounts endpoint
 *      does NOT (verified 2026-08-23) — if the webhook doesn't either, attribution is
 *      broken and the reconcile backstop is carrying the whole flow.
 *   2. Did the fixed bugs leave damage behind — null ramp clocks, duplicate seats,
 *      accounts parked in a dead state?
 *
 * Prints counts and shapes, not profile values.
 *
 *   node --env-file=apps/web/.env.local scripts/diagnose-linkedin-state.mjs
 */
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function q(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

console.log("=== 1. status webhooks: is tenant attribution arriving? ===");
const events = await q("webhook_events?source=eq.linkedin&order=received_at.desc&limit=200");
console.log("linkedin webhook events stored:", events.length);

const statusEvents = events.filter((e) => {
  const p = e.payload;
  return p?.account_status || p?.status || p?.AccountStatus || p?.object === "AccountStatus";
});
console.log("look like account_status events:", statusEvents.length);

// What DID arrive, by shape — so "no status events" can't just be a bad guess on my part.
const shapes = new Map();
for (const e of events) {
  const p = e.payload ?? {};
  const key = Object.keys(p).sort().join(",");
  shapes.set(key, (shapes.get(key) ?? 0) + 1);
}
console.log("\nstored payload shapes (keys → count):");
for (const [keys, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${n.toString().padStart(4)}  ${keys.slice(0, 160)}`);
}

if (statusEvents.length === 0) {
  console.log("\n  !! No account_status webhooks have ever been stored.");
  console.log("     Either the provider isn't delivering them, or the route is rejecting them");
  console.log("     before the store. That alone explains connects not showing up.");
} else {
  for (const [i, e] of statusEvents.slice(0, 5).entries()) {
    const p = e.payload ?? {};
    console.log(`\n--- event #${i} (${e.received_at}) ---`);
    console.log("payload keys:", Object.keys(p));
    console.log("has name:", "name" in p);
    console.log("name is a uuid (attribution WORKS here):", typeof p.name === "string" && UUID_RE.test(p.name));
    console.log("name has a space (it's a person, attribution BROKEN):", typeof p.name === "string" && p.name.includes(" "));
    console.log("status field:", p.status ?? p.account_status ?? null);
  }
}

console.log("\n=== 2. connection rows: leftover damage ===");
const rows = await q("linkedin_accounts?select=id,account_id,provider_ref,profile_url,display_name,status,connected_at,created_at");
console.log("total rows:", rows.length);

const byStatus = {};
for (const r of rows) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log("by status:", byStatus);

const nullClock = rows.filter((r) => r.status === "active" && !r.connected_at);
console.log("ACTIVE rows with no connected_at (ramp pinned at day zero):", nullClock.length);
if (nullClock.length) console.log("  → ids:", nullClock.map((r) => r.id));

const uuidNames = rows.filter((r) => typeof r.display_name === "string" && UUID_RE.test(r.display_name));
console.log("rows whose display_name is a uuid (attribution leaked into the UI):", uuidNames.length);

const seen = new Map();
for (const r of rows) {
  if (!r.profile_url) continue;
  const key = `${r.account_id}|${r.profile_url.toLowerCase().replace(/\/+$/, "")}`;
  seen.set(key, (seen.get(key) ?? 0) + 1);
}
const dupes = [...seen.values()].filter((n) => n > 1).length;
console.log("same human held twice by one tenant (duplicate seats):", dupes);

const tenants = new Set(rows.map((r) => r.account_id));
console.log("tenants holding connections:", tenants.size);

// The cross-tenant bug's fingerprint: one provider account claimed by several tenants.
const refOwners = new Map();
for (const r of rows) {
  refOwners.set(r.provider_ref, new Set([...(refOwners.get(r.provider_ref) ?? []), r.account_id]));
}
const shared = [...refOwners.entries()].filter(([, owners]) => owners.size > 1);
console.log("provider refs claimed by MORE THAN ONE tenant:", shared.length);
for (const [ref, owners] of shared) {
  console.log(`  ref ${ref.slice(0, 8)}… claimed by ${owners.size} tenants`);
}

// And whether our rows even point at connections the provider still holds.
if (process.env.UNIPILE_DSN && process.env.UNIPILE_API_KEY) {
  const res = await fetch(`https://${process.env.UNIPILE_DSN}/api/v1/accounts`, {
    headers: { "x-api-key": process.env.UNIPILE_API_KEY },
    signal: AbortSignal.timeout(15_000),
  });
  const live = res.ok ? ((await res.json()).items ?? []) : [];
  const liveRefs = new Set(live.filter((a) => a?.type === "LINKEDIN").map((a) => a.id));
  console.log("\nlive provider LinkedIn accounts:", liveRefs.size);
  const orphans = rows.filter((r) => !liveRefs.has(r.provider_ref));
  console.log("our rows pointing at a connection the provider no longer has:", orphans.length);
  console.log("  by status:", orphans.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {}));
}
console.log(
  "\nNOTE: with >1 tenant, the shared provider workspace is live — the adoption window",
  "\nis what keeps one tenant from picking up another's connection."
);
