import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

// Next 16 file convention: proxy.ts replaces middleware.ts
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
