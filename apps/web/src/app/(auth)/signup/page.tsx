import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { AuthSplit } from "../auth-split";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  // Production sends already-authenticated users to the app; local dev keeps the page
  // viewable for design review.
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest && process.env.NODE_ENV !== "development") redirect(dest);
  // The URL a visitor typed on the landing page rides in ?site= so the "we'll scan
  // your site" promise carries into signup and (via onboarding pre-fill) is kept.
  const { site } = await searchParams;
  return (
    <AuthSplit>
      <SignupForm initialSite={site} />
    </AuthSplit>
  );
}
