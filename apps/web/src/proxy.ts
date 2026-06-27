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

  const response = await updateSession(request, requestHeaders);
  response.headers.set("Content-Security-Policy-Report-Only", csp);
  return response;
}

export const config = {
  // `auth-panel.html` is a self-contained static animation embedded as an isolated
  // iframe on the auth pages. Excluding it means the strict-dynamic CSP (which would
  // block its inline <script> once enforced) is never applied to that document.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth-panel\\.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
