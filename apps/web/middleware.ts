import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Middleware — tenant routing, auth, and branding run here.
 * Implementation added in a later step.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
