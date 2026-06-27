import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { AuthSplit } from "../auth-split";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Production sends already-authenticated users to the app; local dev keeps the page
  // viewable for design review.
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest && process.env.NODE_ENV !== "development") redirect(dest);
  const { error } = await searchParams;
  return (
    <AuthSplit>
      <LoginForm linkExpired={error === "link-expired"} />
    </AuthSplit>
  );
}
