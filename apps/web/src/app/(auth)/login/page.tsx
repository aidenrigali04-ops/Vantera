import { redirect } from "next/navigation";
import { getGateData, toGateContext } from "@/lib/auth/context";
import { resolveGate } from "@/lib/auth/gate";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const dest = resolveGate("auth", toGateContext(await getGateData()));
  if (dest) redirect(dest);
  const { error } = await searchParams;
  return <LoginForm linkExpired={error === "link-expired"} />;
}
