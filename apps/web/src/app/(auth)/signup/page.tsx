import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { AuthSplit } from "../auth-split";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  // Production sends already-authenticated users to the app; local dev keeps the page
  // viewable for design review.
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest && process.env.NODE_ENV !== "development") redirect(dest);
  return (
    <AuthSplit>
      <SignupForm />
    </AuthSplit>
  );
}
