import { NextResponse } from "next/server";

// Deploy-identity probe (enterprise-grade-brain spec, WS-4.2): postdeploy-verify polls this
// until the production domain serves the SHA that CI just built — a pinned/stale alias fails
// the workflow instead of silently serving old code. No auth: the SHA is public in the repo.
export const dynamic = "force-dynamic";

export async function GET() {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return NextResponse.json({ sha }, { headers: { "cache-control": "no-store" } });
}
