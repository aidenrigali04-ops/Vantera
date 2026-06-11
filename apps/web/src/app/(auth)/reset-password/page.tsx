import { redirect } from "next/navigation";
import { getGateData } from "@/lib/auth/context";
import { ResetPasswordForm } from "./reset-password-form";

// Runs inside the recovery session created by the email link — requires a signed-in
// user (do NOT apply the "auth" gate, which would redirect them away).
export default async function ResetPasswordPage() {
  const { user } = await getGateData();
  if (!user) redirect("/login?error=link-expired");
  return <ResetPasswordForm />;
}
