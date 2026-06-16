// Collects CSP violation reports while the policy runs in Report-Only mode (see lib/security/csp.ts).
// Browsers POST here per the report-uri directive. We log a compact line so violations surface in
// Vercel logs; review them, fix the sources, then flip the policy to enforcing.
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const report = (body["csp-report"] as Record<string, unknown>) ?? body;
    const blocked = report["blocked-uri"] ?? report["blockedURI"];
    const directive = report["violated-directive"] ?? report["effectiveDirective"];
    console.warn("[csp-report]", JSON.stringify({ directive, blocked }).slice(0, 500));
  } catch {
    // Malformed report bodies are ignored — never error a beacon.
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
