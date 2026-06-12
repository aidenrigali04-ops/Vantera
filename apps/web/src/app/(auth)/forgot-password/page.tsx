import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { AuthShell } from "../auth-shell";
import { ForgotPasswordForm } from "./forgot-password-form";

export default async function ForgotPasswordPage() {
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest) redirect(dest);
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
