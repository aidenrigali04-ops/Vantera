import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest, requestHeaders?: Headers) {
  // Forward custom request headers (e.g. the CSP nonce from proxy.ts) to the app/Next runtime.
  const next = () =>
    NextResponse.next(requestHeaders ? { request: { headers: requestHeaders } } : { request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // unconfigured local env: skip session handling rather than crash every request
  if (!url || !anonKey) return next();

  let supabaseResponse = next();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = next();
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // required: refreshes expired auth tokens; do not run other logic in between
  await supabase.auth.getUser();

  return supabaseResponse;
}
