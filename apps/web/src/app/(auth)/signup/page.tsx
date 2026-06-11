import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { SignupForm } from "./signup-form";

export default async function SignupPage() {
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest) redirect(dest);
  return <SignupForm />;
}
