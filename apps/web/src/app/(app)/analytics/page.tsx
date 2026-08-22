import { redirect } from "next/navigation";

// Analytics consolidated into the Results surface (Surface B). The view now lives at
// /dashboard?view=analytics; this route stays as a redirect so deep links and copilot
// navigation keep resolving. Mirrors the /campaigns → /approvals pattern.
export default function AnalyticsPage() {
  redirect("/dashboard?view=analytics");
}
