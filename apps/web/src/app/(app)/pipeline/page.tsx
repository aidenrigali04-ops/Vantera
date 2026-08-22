import { redirect } from "next/navigation";

// Pipeline consolidated into the Results surface (Surface B). The view now lives at
// /dashboard?view=pipeline; this route stays as a redirect so deep links and copilot
// navigation keep resolving. Mirrors the /campaigns → /approvals pattern.
export default function PipelinePage() {
  redirect("/dashboard?view=pipeline");
}
