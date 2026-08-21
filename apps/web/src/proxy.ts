import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";
import { buildCsp } from "@/lib/security/csp";

// Next 16 file convention: proxy.ts replaces middleware.ts
export async function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Forward the nonce + the policy to the app via request headers. The ENFORCING header name on
  // the request makes Next apply the nonce to its own inline scripts (so they don't show as false
  // violations); the RESPONSE carries Report-Only so nothing is ever blocked during observation.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  // Forward the requested path (+ query) so a server component that redirects a logged-out
  // visitor to /login can carry it as ?next= (see loginRedirect). Next does not otherwise expose
  // the current path to a layout; this is the same request-header channel the nonce rides.
  requestHeaders.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy-Report-Only", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
