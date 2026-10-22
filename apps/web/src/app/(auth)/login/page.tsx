import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { safeNext } from "@/lib/auth/safe-next";
import { authQueryMessage } from "@/lib/auth/errors";
import { AuthSplit } from "../auth-split";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // Production sends already-authenticated users to the app; local dev keeps the page
  // viewable for design review.
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest && process.env.NODE_ENV !== "development") redirect(dest);
  const { error, next } = await searchParams;
  return (
    <AuthSplit>
      <LoginForm
        linkExpired={error === "link-expired"}
        next={safeNext(next) ?? undefined}
        queryError={error === "link-expired" ? undefined : authQueryMessage(error)}
      />
    </AuthSplit>
  );
}
