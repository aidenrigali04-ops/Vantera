// Liveness endpoint for the external uptime monitor (production-readiness, rule 10).
// Intentionally cheap + unauthenticated: it proves the app is serving, nothing more.
// Not a readiness probe — it must not touch the DB or any vendor (no load amplification,
// no surface to abuse). Deeper checks belong in dedicated, authenticated diagnostics.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", service: "web", timestamp: new Date().toISOString() },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}
